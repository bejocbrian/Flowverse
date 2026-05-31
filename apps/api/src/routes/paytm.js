import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import { getPaymentMethods } from '../utils/paymentMethods.js';
import {
	paytmBaseUrl,
	paytmConfigured,
	paytmMid,
	paytmWebsite,
	paytmMode,
	paytmSignedPost,
	fetchPaytmOrder,
	frontendOrigin,
	PAYTM_SUCCESS_STATUS,
} from '../utils/paytmClient.js';
import { creditPaytmOrder } from '../utils/creditOrder.js';
import { CREDIT_PACKS, getCreditPack } from '../constants/creditPacks.js';

const router = Router();

router.use(pocketbaseAuth);

const paytmRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	message: { error: 'Too many checkout requests, please try again later' },
	validate: { trustProxy: false },
});

// GET /paytm/packs - public list of credit packs for the wallet UI.
// Mirrors /cashfree/packs so the wallet renders identical pricing.
router.get('/packs', (_req, res) => {
	res.json({ packs: CREDIT_PACKS, currency: 'INR' });
});

// GET /paytm/config - non-secret values the frontend SDK needs to render the
// hosted checkout (mid + environment). The merchant key NEVER leaves the server.
router.get('/config', async (_req, res) => {
	res.json({ mid: paytmMid(), mode: paytmMode(), configured: paytmConfigured() });
});

/**
 * POST /paytm/create-order
 * Body: { packId, successUrl }
 *
 * SECURITY: price and credits come from the server-side pack table, never
 * from the client. We persist a `paytm_orders` row (order_id -> user,
 * pack, expected amount) BEFORE redirecting, so crediting later is driven by
 * trusted server state, not by anything the client or Paytm echoes back.
 */
router.post('/create-order', paytmRateLimit, async (req, res) => {
	const methods = await getPaymentMethods();
	if (!methods.paytm) {
		return res.status(503).json({ error: 'Paytm payments are currently disabled' });
	}
	if (!paytmConfigured()) {
		logger.warn('Paytm create-order requested but credentials are missing');
		return res.status(503).json({ error: 'Paytm is not configured on the server' });
	}

	const { packId } = req.body || {};
	if (!packId) {
		return res.status(400).json({ error: 'packId is required' });
	}

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

	// Paytm orderId: alphanumeric + @ - _ . only. Keep it unique and short.
	const orderId = `ptm_${userId.slice(0, 8)}_${Date.now().toString(36)}_${randomUUID().slice(0, 6)}`;
	const amountStr = price.toFixed(2);

	try {
		// 1) Persist the pending order FIRST. If we crash before Paytm responds,
		//    we simply never redirect - no money moves, no orphan credit.
		await pb.collection('paytm_orders').create({
			order_id: orderId,
			user_id: userId,
			pack_id: pack.id,
			credit_amount: creditAmount,
			expected_amount: Number(amountStr),
			currency: 'INR',
			status: 'CREATED',
		});

		// 2) Build the callback URL Paytm form-POSTs the result to. This must be
		//    a server endpoint reachable by the browser (it's a full-page POST,
		//    NOT an XHR), so it cannot carry our auth header - it lives on the
		//    unauthenticated webhook router and re-verifies with Paytm before
		//    crediting. If PAYTM_CALLBACK_URL is set we use it; otherwise we
		//    derive it from the incoming request host (works in dev and prod).
		const callbackUrl =
			(process.env.PAYTM_CALLBACK_URL || '').trim() ||
			`${req.protocol}://${req.get('host')}/webhooks/paytm/callback`;

		// 3) Initiate the transaction with Paytm to obtain a txnToken.
		const initBody = {
			requestType: 'Payment',
			mid: paytmMid(),
			websiteName: paytmWebsite(),
			orderId,
			txnAmount: { value: amountStr, currency: 'INR' },
			userInfo: { custId: userId },
			callbackUrl,
		};

		let initResp;
		try {
			initResp = await paytmSignedPost(
				`${paytmBaseUrl()}/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(paytmMid())}&orderId=${encodeURIComponent(orderId)}`,
				initBody,
			);
		} catch (netErr) {
			logger.error(`Paytm initiateTransaction network error: ${netErr.message}`);
			return res.status(502).json({ error: 'Could not reach Paytm. Please try again.', detail: netErr.message });
		}

		const resultInfo = initResp.data?.body?.resultInfo || {};
		const txnToken = initResp.data?.body?.txnToken;
		const okStatus = resultInfo.resultStatus === 'S';

		if (!initResp.ok || !okStatus || !txnToken) {
			logger.error(
				`Paytm initiateTransaction failed (${initResp.status}) env=${paytmMode()}: ${JSON.stringify(initResp.data?.body?.resultInfo || initResp.data)}`,
			);
			return res.status(502).json({
				error: resultInfo.resultMsg || `Paytm returned HTTP ${initResp.status}`,
				paytm_code: resultInfo.resultCode || null,
			});
		}

		logger.info(`Paytm order created: ${orderId} for user ${userId}, credits ${creditAmount}`);

		// 4) Return what the frontend needs to do a full-page form POST to
		//    Paytm's hosted payment page (Show Payment Page flow). We use a
		//    redirect - NOT the Blink iframe SDK - because this app sets a
		//    Cross-Origin-Embedder-Policy that blocks Paytm's cross-origin
		//    iframe, leaving the SDK hanging silently.
		const paymentUrl =
			`${paytmBaseUrl()}/theia/api/v1/showPaymentPage` +
			`?mid=${encodeURIComponent(paytmMid())}&orderId=${encodeURIComponent(orderId)}`;

		res.json({
			order_id: orderId,
			txn_token: txnToken,
			mid: paytmMid(),
			amount: amountStr,
			currency: 'INR',
			mode: paytmMode(),
			payment_url: paymentUrl,
		});
	} catch (error) {
		logger.error('Paytm create-order error:', error.message);
		throw error;
	}
});

/**
 * GET /paytm/order/:orderId
 * Used by the success page. Re-verifies with Paytm and credits on success
 * (idempotent). Authorization: only the user who created the order can read it.
 */
router.get('/order/:orderId', async (req, res) => {
	const { orderId } = req.params;
	if (!orderId) return res.status(400).json({ error: 'orderId is required' });
	if (!paytmConfigured()) {
		return res.status(503).json({ error: 'Paytm is not configured on the server' });
	}

	try {
		// Load our pending record to enforce ownership and know the pack.
		let pending = null;
		try {
			pending = await pb.collection('paytm_orders').getFirstListItem(`order_id = "${orderId}"`);
		} catch {
			pending = null;
		}
		if (!pending) {
			return res.status(404).json({ error: 'Order not found' });
		}
		if (pending.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Not your order' });
		}

		const order = await fetchPaytmOrder(orderId);
		if (!order) {
			return res.status(502).json({ error: 'Failed to fetch order from Paytm' });
		}

		const status = order?.resultInfo?.resultStatus;

		// Credit-on-return: if SUCCESS, credit now (idempotent + amount-checked).
		if (status === PAYTM_SUCCESS_STATUS) {
			try {
				await creditPaytmOrder(orderId, { knownOrder: order });
			} catch (creditErr) {
				logger.error(`Paytm credit-on-return failed for ${orderId}: ${creditErr.message}`);
			}
		}

		res.json({
			id: orderId,
			status, // TXN_SUCCESS | TXN_FAILURE | PENDING
			amount: order.txnAmount != null ? Number(order.txnAmount) : pending.expected_amount,
			currency: 'INR',
			creditAmount: pending.credit_amount != null ? parseInt(pending.credit_amount, 10) : null,
		});
	} catch (error) {
		logger.error('Paytm get-order error:', error.message);
		throw error;
	}
});

export default router;
