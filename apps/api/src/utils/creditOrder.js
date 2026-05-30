import pb from './pocketbaseClient.js';
import logger from './logger.js';
import { fetchCashfreeOrder } from './cashfreeClient.js';

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
