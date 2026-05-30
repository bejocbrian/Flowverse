import { Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import logger from '../utils/logger.js';
import { creditCashfreeOrder } from '../utils/creditOrder.js';

const router = Router();

/**
 * Cashfree webhook signature verification.
 * signature = base64(HMAC-SHA256(timestamp + rawBody, secretKey))
 */
function verifySignature(timestamp, rawBody, providedSignature) {
	const secret = (process.env.CASHFREE_SECRET_KEY || '').trim();
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

router.post('/cashfree', async (req, res) => {
	const timestamp = req.header('x-webhook-timestamp');
	const signature = req.header('x-webhook-signature');
	const rawBody = req.rawBody;

	const signatureValid = verifySignature(timestamp, rawBody, signature);
	if (!signatureValid) {
		logger.warn(
			`Cashfree webhook: signature not verified ` +
			`(hasRawBody=${!!rawBody} len=${rawBody?.length || 0} ` +
			`hasTs=${!!timestamp} hasSig=${!!signature}). ` +
			`Proceeding with authoritative Cashfree API verification.`,
		);
	}

	// Parse payload from verified raw bytes when available.
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

	const data = payload?.data || {};
	const order = data.order || {};
	const paymentInfo = data.payment || {};
	const orderId = order.order_id || data.order_id;
	const paymentStatus = paymentInfo.payment_status || data.payment_status;

	logger.info(
		`Cashfree webhook: order=${orderId} status=${paymentStatus} sigValid=${signatureValid}`,
	);

	// Always re-verify against Cashfree's API and credit there (single source
	// of truth, idempotent). We never trust the webhook body to grant credits.
	let outcome = { credited: false, reason: 'not_paid_status' };
	try {
		if (orderId && PAID_STATUSES.has(paymentStatus)) {
			outcome = await creditCashfreeOrder(orderId);
		}
	} catch (error) {
		logger.error('Cashfree webhook handler error:', error.message);
		outcome = { credited: false, reason: 'handler_error' };
	}

	// Echo the outcome in the response so it shows in Cashfree's webhook
	// delivery log - makes diagnosing prod issues possible without server logs.
	res.status(200).json({ received: true, order_id: orderId, ...outcome });
});

export default router;
