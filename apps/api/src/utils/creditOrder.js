import pb from './pocketbaseClient.js';
import logger from './logger.js';
import { fetchCashfreeOrder } from './cashfreeClient.js';

/**
 * Idempotently credit a user for a PAID Cashfree order.
 *
 * This is the single source of truth for crediting, called from BOTH:
 *   - the webhook (server-to-server, may arrive first)
 *   - the success-page order lookup (user returns to the app)
 *
 * Whichever fires first credits; the other is a no-op thanks to the
 * transaction-based idempotency guard. We always re-verify the order
 * against Cashfree's API (authoritative) so we never credit an order
 * Cashfree hasn't actually marked PAID.
 *
 * Returns { credited, reason, balance }.
 */
export async function creditCashfreeOrder(orderId, { knownOrder = null } = {}) {
	if (!orderId) return { credited: false, reason: 'no_order_id' };

	const order = knownOrder || (await fetchCashfreeOrder(orderId));
	if (!order) return { credited: false, reason: 'order_fetch_failed' };

	if (order.order_status !== 'PAID') {
		return { credited: false, reason: `not_paid:${order.order_status}` };
	}

	const tags = order.order_tags || {};
	const userId = tags.user_id;
	const creditAmount = parseInt(tags.credit_amount, 10);

	if (!userId || !Number.isFinite(creditAmount) || creditAmount <= 0) {
		logger.warn(`creditCashfreeOrder: missing/invalid tags for ${orderId}: ${JSON.stringify(tags)}`);
		return { credited: false, reason: 'invalid_tags' };
	}

	const description = `Cashfree order ${orderId}`;

	// Idempotency: one transaction per order.
	try {
		const existing = await pb
			.collection('transactions')
			.getFirstListItem(`user_id = "${userId}" && description = "${description}"`);
		if (existing) {
			logger.info(`creditCashfreeOrder: ${orderId} already credited (tx ${existing.id})`);
			return { credited: false, reason: 'already_credited' };
		}
	} catch (e) {
		// 404 = not found = good, proceed. Any other error is real.
		if (e?.status !== 404 && !e.message?.includes('not found') && !e.message?.includes("wasn't found")) {
			logger.error(`creditCashfreeOrder: idempotency check error for ${orderId}: ${e.message}`);
			return { credited: false, reason: 'idempotency_check_failed' };
		}
	}

	const user = await pb.collection('users').getOne(userId);
	const newBalance = (user.credits_balance || 0) + creditAmount;

	await pb.collection('users').update(userId, { credits_balance: newBalance });
	await pb.collection('transactions').create({
		user_id: userId,
		type: 'purchase',
		amount: creditAmount,
		balance_after: newBalance,
		description,
	});

	logger.info(`creditCashfreeOrder: credited user=${userId} order=${orderId} +${creditAmount} -> ${newBalance}`);
	return { credited: true, reason: 'credited', balance: newBalance, creditAmount };
}
