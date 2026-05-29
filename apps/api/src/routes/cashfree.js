import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import { getPaymentMethods } from '../utils/paymentMethods.js';

const router = Router();

router.use(pocketbaseAuth);

const cashfreeRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	message: { error: 'Too many checkout requests, please try again later' },
	validate: { trustProxy: false },
});

// PROD: https://api.cashfree.com/pg
// SANDBOX: https://sandbox.cashfree.com/pg
function cashfreeBaseUrl() {
	const mode = (process.env.CASHFREE_ENV || 'sandbox').toLowerCase();
	return mode === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
}

function cashfreeHeaders() {
	return {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		'x-api-version': '2023-08-01',
		'x-client-id': process.env.CASHFREE_APP_ID || '',
		'x-client-secret': process.env.CASHFREE_SECRET_KEY || '',
	};
}

function isConfigured() {
	return Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
}

/**
 * POST /cashfree/create-order
 * Body: { creditAmount, price, currency, successUrl }
 *  - creditAmount: how many credits the user gets if payment succeeds
 *  - price: amount to charge
 *  - currency: ISO code, defaults to "INR" since Cashfree primarily accepts INR
 *  - successUrl: where to redirect after payment (Cashfree appends ?order_id=...)
 */
router.post('/create-order', cashfreeRateLimit, async (req, res) => {
	const methods = await getPaymentMethods();
	if (!methods.cashfree) {
		return res.status(503).json({ error: 'Cashfree payments are currently disabled' });
	}
	if (!isConfigured()) {
		logger.warn('Cashfree create-order requested but credentials are missing');
		return res.status(503).json({ error: 'Cashfree is not configured on the server' });
	}

	const { creditAmount, price, currency = 'INR', successUrl } = req.body || {};

	if (!creditAmount || !price || !successUrl) {
		return res
			.status(400)
			.json({ error: 'creditAmount, price, and successUrl are required' });
	}
	if (typeof price !== 'number' || price <= 0) {
		return res.status(400).json({ error: 'price must be a positive number' });
	}
	if (typeof creditAmount !== 'number' || creditAmount <= 0) {
		return res.status(400).json({ error: 'creditAmount must be a positive number' });
	}

	const userId = req.pocketbaseUserId;
	if (!userId) {
		return res.status(401).json({ error: 'Authentication required' });
	}

	try {
		// Pull the user so we can populate Cashfree's required customer fields.
		const user = req.pocketbaseUser
			? req.pocketbaseUser
			: await pb.collection('users').getOne(userId);

		// Cashfree requires a phone number on the customer. Many of our users
		// don't have one. Fall back to a placeholder; Cashfree accepts it for
		// most flows but UPI/netbanking may surface a "real number" prompt
		// during checkout.
		const phone = user.phone || user.phone_number || '9999999999';

		const orderId = `cf_${userId.slice(0, 8)}_${Date.now().toString(36)}_${randomUUID().slice(0, 6)}`;

		const body = {
			order_id: orderId,
			order_amount: Number(price.toFixed(2)),
			order_currency: currency,
			customer_details: {
				customer_id: userId,
				customer_email: user.email || `${userId}@aether.local`,
				customer_phone: phone,
				customer_name: user.name || 'Aether User',
			},
			order_meta: {
				return_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}cf_order_id={order_id}`,
				notify_url: process.env.CASHFREE_WEBHOOK_URL || undefined,
			},
			order_tags: {
				user_id: userId,
				credit_amount: String(creditAmount),
				source: 'aether-video',
			},
			order_note: `Aether credits: ${creditAmount}`,
		};

		let cfResponse;
		try {
			cfResponse = await fetch(`${cashfreeBaseUrl()}/orders`, {
				method: 'POST',
				headers: cashfreeHeaders(),
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(15000),
			});
		} catch (netErr) {
			logger.error(`Cashfree create-order network error: ${netErr.message}`);
			return res.status(502).json({
				error: 'Could not reach Cashfree. Please try again.',
				detail: netErr.message,
			});
		}

		const cfData = await cfResponse.json().catch(() => ({}));

		if (!cfResponse.ok) {
			// Surface Cashfree's real reason. Common causes: wrong/missing
			// API keys, sandbox keys used against the production endpoint
			// (or vice-versa), or an unsupported x-api-version.
			const reason =
				cfData?.message ||
				cfData?.error_description ||
				cfData?.type ||
				`Cashfree returned HTTP ${cfResponse.status}`;
			logger.error(
				`Cashfree create-order failed (${cfResponse.status}) env=${process.env.CASHFREE_ENV || 'sandbox'}: ${JSON.stringify(cfData)}`,
			);
			return res.status(502).json({
				error: reason,
				cashfree_status: cfResponse.status,
				cashfree_code: cfData?.code || null,
			});
		}

		logger.info(`Cashfree order created: ${orderId} for user ${userId}, credits ${creditAmount}`);

		res.json({
			order_id: cfData.order_id || orderId,
			payment_session_id: cfData.payment_session_id,
			amount: cfData.order_amount,
			currency: cfData.order_currency,
		});
	} catch (error) {
		logger.error('Cashfree create-order error:', error.message);
		throw error;
	}
});

/**
 * GET /cashfree/order/:orderId
 * Fetches order status. Used by the success page to show a confirmation.
 */
router.get('/order/:orderId', async (req, res) => {
	const { orderId } = req.params;
	if (!orderId) return res.status(400).json({ error: 'orderId is required' });
	if (!isConfigured()) {
		return res.status(503).json({ error: 'Cashfree is not configured on the server' });
	}

	try {
		const cfResponse = await fetch(`${cashfreeBaseUrl()}/orders/${encodeURIComponent(orderId)}`, {
			method: 'GET',
			headers: cashfreeHeaders(),
		});
		const cfData = await cfResponse.json().catch(() => ({}));

		if (!cfResponse.ok) {
			if (cfResponse.status === 404) {
				return res.status(404).json({ error: 'Order not found' });
			}
			logger.error(`Cashfree get-order failed (${cfResponse.status}): ${JSON.stringify(cfData)}`);
			return res.status(502).json({ error: cfData?.message || 'Failed to fetch order' });
		}

		// Authorization: only let the user who created the order see it.
		if (cfData?.order_tags?.user_id && cfData.order_tags.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Not your order' });
		}

		res.json({
			id: cfData.order_id,
			status: cfData.order_status, // ACTIVE | PAID | EXPIRED | TERMINATED
			amount: cfData.order_amount,
			currency: cfData.order_currency,
			creditAmount: cfData?.order_tags?.credit_amount
				? parseInt(cfData.order_tags.credit_amount, 10)
				: null,
			customerEmail: cfData?.customer_details?.customer_email,
		});
	} catch (error) {
		logger.error('Cashfree get-order error:', error.message);
		throw error;
	}
});

export default router;
