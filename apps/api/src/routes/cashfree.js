import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import { getPaymentMethods } from '../utils/paymentMethods.js';
import { cashfreeBaseUrl, cashfreeHeaders, cashfreeConfigured } from '../utils/cashfreeClient.js';
import { creditCashfreeOrder } from '../utils/creditOrder.js';
import { CREDIT_PACKS, getCreditPack } from '../constants/creditPacks.js';
import { cheapestVideoCost } from '../utils/creditCalculator.js';

const router = Router();

router.use(pocketbaseAuth);

const cashfreeRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	message: { error: 'Too many checkout requests, please try again later' },
	validate: { trustProxy: false },
});

function isConfigured() {
	return cashfreeConfigured();
}

// GET /cashfree/packs - public list of credit packs for the wallet UI.
// The wallet renders from this so price/credits always match the server.
// `videoUnitCredits` is the cheapest per-video cost so the UI can show how
// many videos each pack is worth.
router.get('/packs', async (_req, res) => {
	res.json({ packs: CREDIT_PACKS, currency: 'INR', videoUnitCredits: await cheapestVideoCost() });
});

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

	const { packId, currency = 'INR', successUrl } = req.body || {};

	if (!packId || !successUrl) {
		return res.status(400).json({ error: 'packId and successUrl are required' });
	}

	// SECURITY: price and credits come from the server-side pack table, never
	// from the client. A user can only pick a pack id; they cannot set their
	// own price or credit amount.
	const pack = getCreditPack(packId);
	if (!pack) {
		return res.status(400).json({ error: 'Unknown credit pack' });
	}
	const price = pack.priceINR;
	const creditAmount = pack.credits;

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
				pack_id: pack.id,
				source: 'aether-video',
			},
			order_note: `Aether ${pack.id}: ${creditAmount} credits`,
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

		// Credit-on-return: if this order is PAID, credit the user now. This
		// is the reliable path - it does not depend on the webhook arriving
		// or its signature verifying. Idempotent: if the webhook already
		// credited (or this runs twice), it's a no-op.
		if (cfData?.order_status === 'PAID') {
			try {
				await creditCashfreeOrder(orderId, { knownOrder: cfData });
			} catch (creditErr) {
				logger.error(`Credit-on-return failed for ${orderId}: ${creditErr.message}`);
			}
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
