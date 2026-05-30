import { Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { fetchCashfreeOrder } from '../utils/cashfreeClient.js';

const router = Router();

/**
 * Cashfree webhook signature verification.
 *
 * Per docs, signature = base64(HMAC-SHA256(secretKey, timestamp + rawBody)).
 * Both `t` (timestamp) and `signature` are sent as headers.
 *
 * The raw body bytes are required - if Express has parsed the body to JSON
 * already, the bytes won't match what Cashfree signed. main.js stashes the
 * raw bytes into req.rawBody for this route via express.json's `verify`
 * callback.
 */
function verifySignature(timestamp, rawBody, providedSignature) {
	const secret = process.env.CASHFREE_SECRET_KEY;
	if (!secret) return false;
	if (!timestamp || !rawBody || !providedSignature) return false;

	const computed = createHmac('sha256', secret)
		.update(timestamp + rawBody.toString('utf8'))
		.digest('base64');

	const a = Buffer.from(computed);
	const b = Buffer.from(providedSignature);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

const PAID_STATUSES = new Set(['SUCCESS', 'PAID']);
const FAILED_STATUSES = new Set(['FAILED', 'USER_DROPPED', 'CANCELLED']);

router.post('/cashfree', async (req, res) => {
	const timestamp = req.header('x-webhook-timestamp');
	const signature = req.header('x-webhook-signature');
	const rawBody = req.rawBody; // captured in main.js

	if (process.env.CASHFREE_SECRET_KEY) {
		if (!verifySignature(timestamp, rawBody, signature)) {
			logger.warn('Cashfree webhook: signature verification failed');
			return res.status(401).json({ error: 'Invalid signature' });
		}
	} else {
		logger.warn(
			'Cashfree webhook: CASHFREE_SECRET_KEY not set, skipping signature verification (dev only)',
		);
	}

	// Parse the payload from the verified raw bytes when available, so we
	// don't depend on which body parser ran (json vs raw fallback). Fall
	// back to req.body if it's already a parsed object.
	let payload = {};
	if (rawBody && rawBody.length) {
		try {
			payload = JSON.parse(rawBody.toString('utf8'));
		} catch {
			payload = (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) ? req.body : {};
		}
	} else if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
		payload = req.body;
	}

	const eventType = payload?.type || payload?.event_type;
	const data = payload?.data || {};
	const order = data.order || {};
	const paymentInfo = data.payment || {};
	const orderId = order.order_id || data.order_id;
	let orderTags = order.order_tags || data.order_tags || {};
	const paymentStatus = paymentInfo.payment_status || data.payment_status;

	logger.info(
		`Cashfree webhook: type=${eventType} order=${orderId} status=${paymentStatus}`,
	);

	try {
		if (PAID_STATUSES.has(paymentStatus)) {
			// Cashfree's PAYMENT_SUCCESS webhook does NOT reliably include
			// order_tags. If they're missing, fetch the order from Cashfree's
			// API (server-side source of truth) to recover user_id and
			// credit_amount, and to confirm the order is actually PAID.
			if (!orderTags?.user_id || !orderTags?.credit_amount) {
				const fetched = await fetchCashfreeOrder(orderId);
				if (fetched?.order_tags) {
					orderTags = fetched.order_tags;
				}
				// Extra safety: only credit if Cashfree says the order is PAID.
				if (fetched && fetched.order_status && fetched.order_status !== 'PAID') {
					logger.warn(
						`Cashfree webhook: order ${orderId} status is ${fetched.order_status}, not crediting`,
					);
					return res.status(200).json({ received: true });
				}
			}

			await handlePaymentSuccess({
				orderId,
				orderTags,
				orderAmount: order.order_amount || data.order_amount,
				paymentInfo,
			});
		} else if (FAILED_STATUSES.has(paymentStatus)) {
			logger.info(`Cashfree payment ${paymentStatus} for order ${orderId} - no credits granted`);
		} else {
			logger.info(`Cashfree webhook: ignoring status ${paymentStatus}`);
		}
	} catch (error) {
		logger.error('Cashfree webhook handler error:', error.message);
	}

	res.status(200).json({ received: true });
});

async function handlePaymentSuccess({ orderId, orderTags, orderAmount, paymentInfo }) {
	const userId = orderTags?.user_id;
	const creditAmount = parseInt(orderTags?.credit_amount, 10);

	if (!userId || !Number.isFinite(creditAmount) || creditAmount <= 0) {
		logger.warn(
			`Cashfree webhook: missing/invalid order_tags for order ${orderId} (even after fetch): ${JSON.stringify(orderTags)}`,
		);
		return;
	}

	// Idempotency: if we already wrote a transaction for this order, do
	// nothing. Cashfree may deliver the same event multiple times.
	try {
		const existing = await pb
			.collection('transactions')
			.getFirstListItem(
				`user_id = "${userId}" && type = "purchase" && description = "Cashfree order ${orderId}"`,
			);
		if (existing) {
			logger.info(`Cashfree webhook: order ${orderId} already credited (tx ${existing.id})`);
			return;
		}
	} catch (e) {
		if (e?.status !== 404 && !e.message?.includes('not found')) {
			throw e;
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
		description: `Cashfree order ${orderId}`,
	});

	logger.info(
		`Cashfree credits applied: user=${userId} order=${orderId} credits=${creditAmount} amount=${orderAmount} payment_id=${paymentInfo?.cf_payment_id || 'n/a'}`,
	);
}

export default router;
