import { Router } from 'express';
import logger from '../utils/logger.js';
import { creditPaytmOrder } from '../utils/creditOrder.js';
import { frontendOrigin } from '../utils/paytmClient.js';

const router = Router();

/**
 * Paytm posts the transaction result to our callbackUrl. The body may arrive
 * as JSON ({ body, head }) or as form-urlencoded key/value pairs depending on
 * the flow. EITHER WAY we never trust it to grant credits: we only extract
 * the orderId and then re-verify authoritatively via Paytm's
 * /v3/order/status API inside creditPaytmOrder(). This mirrors the Cashfree
 * webhook's "API is the single source of truth" model.
 */
function extractOrderId(req) {
	const b = req.body || {};
	// JSON envelope shape: { body: { orderId, ... }, head: {...} }
	if (b.body && typeof b.body === 'object') {
		return b.body.orderId || b.body.ORDERID || null;
	}
	// Buffer (raw parser) - try to parse JSON.
	if (Buffer.isBuffer(b) && b.length) {
		try {
			const parsed = JSON.parse(b.toString('utf8'));
			return parsed?.body?.orderId || parsed?.ORDERID || parsed?.orderId || null;
		} catch {
			/* fall through */
		}
	}
	// Flat shape (Show Payment Page callback is form-urlencoded): { ORDERID, ... }
	return b.ORDERID || b.orderId || null;
}

/**
 * POST /webhooks/paytm
 * Pure server-to-server webhook (no browser involved). Credits idempotently
 * and replies JSON. Used when PAYTM_CALLBACK_URL points here directly.
 */
router.post('/paytm', async (req, res) => {
	const orderId = extractOrderId(req);
	logger.info(`Paytm webhook: order=${orderId}`);

	let outcome = { credited: false, reason: 'no_order_id' };
	try {
		if (orderId) {
			outcome = await creditPaytmOrder(orderId);
		}
	} catch (error) {
		logger.error('Paytm webhook handler error:', error.message);
		outcome = { credited: false, reason: 'handler_error' };
	}

	res.status(200).json({ received: true, order_id: orderId, ...outcome });
});

/**
 * POST /webhooks/paytm/callback
 * The "Show Payment Page" redirect target. Paytm completes payment on its
 * hosted page, then does a full-page form POST of the result here (in the
 * user's browser). We:
 *   1) extract the orderId (never trust the posted status/amount),
 *   2) credit idempotently after re-verifying with Paytm's status API,
 *   3) 302-redirect the browser back to the SPA wallet success page.
 *
 * This endpoint is intentionally unauthenticated: it's a browser navigation
 * from Paytm, so it can't carry our auth header. Crediting is keyed on the
 * server-side pending order + Paytm's authoritative status, so no auth is
 * needed to make it safe.
 */
router.post('/paytm/callback', async (req, res) => {
	const orderId = extractOrderId(req);
	logger.info(`Paytm callback: order=${orderId}`);

	try {
		if (orderId) {
			await creditPaytmOrder(orderId);
		}
	} catch (error) {
		logger.error('Paytm callback handler error:', error.message);
	}

	// Send the user back to the wallet success page, which will fetch the
	// authoritative status via GET /paytm/order/:orderId and show the result.
	const base = frontendOrigin();
	const target = orderId
		? `${base}/app/wallet/success?paytm_order_id=${encodeURIComponent(orderId)}`
		: `${base}/app/wallet`;

	return res.redirect(302, target);
});

export default router;
