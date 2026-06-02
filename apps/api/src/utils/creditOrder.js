import pb from './pocketbaseClient.js';
import logger from './logger.js';
import Stripe from 'stripe';
import { fetchCashfreeOrder } from './cashfreeClient.js';
import { fetchPaytmOrder, PAYTM_SUCCESS_STATUS } from './paytmClient.js';

/**
 * Idempotently credit a user for a PAID Cashfree order.
 *
 * Called from BOTH the webhook and the success-page order lookup. Whichever
 * fires first credits; the other is a guaranteed no-op.
 *
 * Safety / exactly-once:
 *   - We always re-verify the order against Cashfree's API (authoritative).
 *     Credits are only granted when Cashfree itself reports order_status=PAID,
 *     so a forged/unauthenticated webhook cannot grant credits.
 *   - The `transactions.cashfree_order_id` column has a UNIQUE index. The
 *     credit transaction is written FIRST; if a concurrent request already
 *     wrote it, the DB rejects the duplicate (validation_not_unique) and we
 *     treat it as already-credited. This makes double-crediting impossible
 *     even under a webhook/success-page race - the database is the guard,
 *     not application timing.
 *
 * Returns { credited, reason, balance }.
 */

function isUniqueViolation(error) {
	if (!error) return false;
	if (error.status !== 400) return false;
	const data = error?.data?.data || error?.response?.data || {};
	const field = data?.cashfree_order_id;
	return field?.code === 'validation_not_unique';
}

function isUniqueViolationOn(error, fieldName) {
	if (!error) return false;
	if (error.status !== 400) return false;
	const data = error?.data?.data || error?.response?.data || {};
	const field = data?.[fieldName];
	return field?.code === 'validation_not_unique';
}

export async function creditCashfreeOrder(orderId, { knownOrder = null } = {}) {
	if (!orderId) return { credited: false, reason: 'no_order_id' };

	// Authoritative verification against Cashfree.
	const order = knownOrder || (await fetchCashfreeOrder(orderId));
	if (!order) return { credited: false, reason: 'order_fetch_failed' };
	if (order.order_status !== 'PAID') {
		return { credited: false, reason: `not_paid:${order.order_status}` };
	}

	const tags = order.order_tags || {};
	const userId = tags.user_id;
	const creditAmount = parseInt(tags.credit_amount, 10);
	if (!userId || !Number.isFinite(creditAmount) || creditAmount <= 0) {
		logger.warn(`creditCashfreeOrder: invalid tags for ${orderId}: ${JSON.stringify(tags)}`);
		return { credited: false, reason: 'invalid_tags' };
	}

	// Fast-path idempotency check (avoids a needless balance read on the
	// common "already credited" replay). The unique index below is the
	// authoritative guard.
	try {
		const existing = await pb
			.collection('transactions')
			.getFirstListItem(`cashfree_order_id = "${orderId}"`);
		if (existing) {
			logger.info(`creditCashfreeOrder: ${orderId} already credited (tx ${existing.id})`);
			return { credited: false, reason: 'already_credited' };
		}
	} catch (e) {
		const notFound =
			e?.status === 404 ||
			(e?.message || '').includes('not found') ||
			(e?.message || '').includes("wasn't found");
		if (!notFound) {
			logger.error(`creditCashfreeOrder: idempotency check error for ${orderId}: ${e.message}`);
			return { credited: false, reason: 'idempotency_check_failed' };
		}
	}

	const user = await pb.collection('users').getOne(userId);
	const newBalance = (user.credits_balance || 0) + creditAmount;

	// Write the audit transaction FIRST. Its UNIQUE cashfree_order_id makes
	// this the atomic exactly-once gate: a racing request fails here.
	try {
		await pb.collection('transactions').create({
			user_id: userId,
			type: 'purchase',
			amount: creditAmount,
			balance_after: newBalance,
			description: `Cashfree order ${orderId}`,
			cashfree_order_id: orderId,
		});
	} catch (e) {
		if (isUniqueViolation(e)) {
			logger.info(`creditCashfreeOrder: ${orderId} already credited (unique index)`);
			return { credited: false, reason: 'already_credited' };
		}
		logger.error(`creditCashfreeOrder: tx create failed for ${orderId}: ${e.message}`);
		throw e;
	}

	// Only now bump the balance - the transaction row succeeded, so this
	// order is guaranteed to be credited exactly once.
	await pb.collection('users').update(userId, { credits_balance: newBalance });

	logger.info(`creditCashfreeOrder: credited user=${userId} order=${orderId} +${creditAmount} -> ${newBalance}`);
	return { credited: true, reason: 'credited', balance: newBalance, creditAmount };
}

/**
 * Idempotently credit a user for a SUCCESSFUL Paytm order.
 *
 * Called from BOTH the Paytm webhook/callback and the success-page order
 * lookup. Whichever fires first credits; the other is a guaranteed no-op.
 *
 * Safety / exactly-once / NO PAYMENT MISMATCH:
 *   - Unlike Cashfree, Paytm's status API does NOT echo back our custom
 *     metadata (user_id, credit_amount). So we store a server-side
 *     `paytm_orders` record at create time (orderId -> user, pack, expected
 *     amount) and credit strictly from THAT record. The client can never
 *     influence the credited amount.
 *   - We always re-verify against Paytm's /v3/order/status API
 *     (authoritative). Credits are only granted when Paytm itself reports
 *     resultStatus=TXN_SUCCESS, so a forged/unauthenticated webhook cannot
 *     grant credits.
 *   - We assert Paytm's confirmed txnAmount EXACTLY equals the expected
 *     amount stored on the pending order. Any mismatch aborts crediting and
 *     is logged - this is the guard against a tampered or wrong-amount
 *     payment ever being credited.
 *   - The `transactions.paytm_order_id` column has a PARTIAL UNIQUE index.
 *     The credit transaction is written FIRST; a concurrent duplicate is
 *     rejected by the DB (validation_not_unique). Double-crediting is
 *     impossible regardless of which path (webhook vs success-page) wins.
 *
 * Returns { credited, reason, balance }.
 */
export async function creditPaytmOrder(orderId, { knownOrder = null } = {}) {
	if (!orderId) return { credited: false, reason: 'no_order_id' };

	// 1) Load our server-side pending order - the ONLY source of truth for
	//    who gets credited and how much.
	let pending;
	try {
		pending = await pb.collection('paytm_orders').getFirstListItem(`order_id = "${orderId}"`);
	} catch (e) {
		const notFound =
			e?.status === 404 ||
			(e?.message || '').includes('not found') ||
			(e?.message || '').includes("wasn't found");
		if (notFound) {
			logger.warn(`creditPaytmOrder: no pending order record for ${orderId}`);
			return { credited: false, reason: 'unknown_order' };
		}
		logger.error(`creditPaytmOrder: pending lookup error for ${orderId}: ${e.message}`);
		return { credited: false, reason: 'pending_lookup_failed' };
	}

	const userId = pending.user_id;
	const creditAmount = parseInt(pending.credit_amount, 10);
	const expectedAmount = Number(pending.expected_amount);
	if (!userId || !Number.isFinite(creditAmount) || creditAmount <= 0 || !Number.isFinite(expectedAmount)) {
		logger.warn(`creditPaytmOrder: invalid pending record for ${orderId}: ${JSON.stringify({ userId, creditAmount, expectedAmount })}`);
		return { credited: false, reason: 'invalid_pending_record' };
	}

	// 2) Authoritative verification against Paytm.
	const order = knownOrder || (await fetchPaytmOrder(orderId));
	if (!order) return { credited: false, reason: 'order_fetch_failed' };

	const status = order?.resultInfo?.resultStatus;
	if (status !== PAYTM_SUCCESS_STATUS) {
		return { credited: false, reason: `not_paid:${status || 'unknown'}` };
	}

	// 3) NO MISMATCH: Paytm's confirmed amount must equal what we expected for
	//    this pack. Compare in paise to avoid float drift.
	const paidAmount = Number(order.txnAmount);
	if (!Number.isFinite(paidAmount) || Math.round(paidAmount * 100) !== Math.round(expectedAmount * 100)) {
		logger.error(
			`creditPaytmOrder: AMOUNT MISMATCH for ${orderId} ` +
			`paid=${paidAmount} expected=${expectedAmount} - NOT crediting`,
		);
		return { credited: false, reason: 'amount_mismatch' };
	}

	// 4) Fast-path idempotency check (the unique index below is authoritative).
	try {
		const existing = await pb
			.collection('transactions')
			.getFirstListItem(`paytm_order_id = "${orderId}"`);
		if (existing) {
			logger.info(`creditPaytmOrder: ${orderId} already credited (tx ${existing.id})`);
			return { credited: false, reason: 'already_credited' };
		}
	} catch (e) {
		const notFound =
			e?.status === 404 ||
			(e?.message || '').includes('not found') ||
			(e?.message || '').includes("wasn't found");
		if (!notFound) {
			logger.error(`creditPaytmOrder: idempotency check error for ${orderId}: ${e.message}`);
			return { credited: false, reason: 'idempotency_check_failed' };
		}
	}

	const user = await pb.collection('users').getOne(userId);
	const newBalance = (user.credits_balance || 0) + creditAmount;

	// 5) Write the audit transaction FIRST. Its PARTIAL UNIQUE paytm_order_id
	//    makes this the atomic exactly-once gate: a racing request fails here.
	try {
		await pb.collection('transactions').create({
			user_id: userId,
			type: 'purchase',
			amount: creditAmount,
			balance_after: newBalance,
			description: `Paytm order ${orderId}`,
			paytm_order_id: orderId,
		});
	} catch (e) {
		if (isUniqueViolationOn(e, 'paytm_order_id')) {
			logger.info(`creditPaytmOrder: ${orderId} already credited (unique index)`);
			return { credited: false, reason: 'already_credited' };
		}
		logger.error(`creditPaytmOrder: tx create failed for ${orderId}: ${e.message}`);
		throw e;
	}

	// 6) Only now bump the balance - the transaction row succeeded, so this
	//    order is guaranteed to be credited exactly once.
	await pb.collection('users').update(userId, { credits_balance: newBalance });

	// 7) Best-effort: mark the pending order paid for observability. Never
	//    affects crediting correctness.
	try {
		await pb.collection('paytm_orders').update(pending.id, {
			status: 'PAID',
			txn_id: order.txnId || '',
		});
	} catch (e) {
		logger.warn(`creditPaytmOrder: could not update pending order ${orderId}: ${e.message}`);
	}

	logger.info(`creditPaytmOrder: credited user=${userId} order=${orderId} +${creditAmount} -> ${newBalance}`);
	return { credited: true, reason: 'credited', balance: newBalance, creditAmount };
}

/**
 * Idempotently credit a user for a PAID Stripe Checkout session.
 *
 * Called from BOTH the Stripe webhook and the success-page session lookup.
 * Whichever fires first credits; the other is a guaranteed no-op.
 *
 * Safety / exactly-once:
 *   - We always use the Stripe SDK to retrieve the session (authoritative).
 *     Credits are only granted when Stripe reports payment_status=paid.
 *   - The `transactions.stripe_session_id` column must have a UNIQUE index in
 *     PocketBase. The credit transaction is written FIRST; a concurrent
 *     duplicate is rejected by the DB (validation_not_unique). This makes
 *     double-crediting impossible regardless of whether the webhook or the
 *     success-page lookup wins the race.
 *
 * Returns { credited, reason, balance }.
 */

const _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function creditStripeSession(sessionId, { knownSession = null } = {}) {
	if (!sessionId) return { credited: false, reason: 'no_session_id' };

	// Authoritative verification against Stripe.
	const session = knownSession || await _stripe.checkout.sessions.retrieve(sessionId);
	if (!session) return { credited: false, reason: 'session_fetch_failed' };
	if (session.payment_status !== 'paid') {
		return { credited: false, reason: `not_paid:${session.payment_status}` };
	}

	const userId = session.metadata?.user_id;
	const creditAmount = parseInt(session.metadata?.credit_amount, 10);
	if (!userId || !Number.isFinite(creditAmount) || creditAmount <= 0) {
		logger.warn(`creditStripeSession: invalid metadata for ${sessionId}: ${JSON.stringify(session.metadata)}`);
		return { credited: false, reason: 'invalid_metadata' };
	}

	// Fast-path idempotency check (the unique index below is authoritative).
	try {
		const existing = await pb
			.collection('transactions')
			.getFirstListItem(`stripe_session_id = "${sessionId}"`);
		if (existing) {
			logger.info(`creditStripeSession: ${sessionId} already credited (tx ${existing.id})`);
			return { credited: false, reason: 'already_credited' };
		}
	} catch (e) {
		const notFound =
			e?.status === 404 ||
			(e?.message || '').includes('not found') ||
			(e?.message || '').includes("wasn't found");
		if (!notFound) {
			logger.error(`creditStripeSession: idempotency check error for ${sessionId}: ${e.message}`);
			return { credited: false, reason: 'idempotency_check_failed' };
		}
	}

	const user = await pb.collection('users').getOne(userId);
	const newBalance = (user.credits_balance || 0) + creditAmount;

	// Write the audit transaction FIRST. Its UNIQUE stripe_session_id makes
	// this the atomic exactly-once gate: a racing request fails here.
	try {
		await pb.collection('transactions').create({
			user_id: userId,
			type: 'purchase',
			amount: creditAmount,
			balance_after: newBalance,
			description: `Stripe session ${sessionId}`,
			stripe_session_id: sessionId,
		});
	} catch (e) {
		if (isUniqueViolationOn(e, 'stripe_session_id')) {
			logger.info(`creditStripeSession: ${sessionId} already credited (unique index)`);
			return { credited: false, reason: 'already_credited' };
		}
		logger.error(`creditStripeSession: tx create failed for ${sessionId}: ${e.message}`);
		throw e;
	}

	// Only now bump the balance.
	await pb.collection('users').update(userId, { credits_balance: newBalance });

	logger.info(`creditStripeSession: credited user=${userId} session=${sessionId} +${creditAmount} -> ${newBalance}`);
	return { credited: true, reason: 'credited', balance: newBalance, creditAmount };
}
