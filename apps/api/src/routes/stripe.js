import { Router } from 'express';
import Stripe from 'stripe';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import logger from '../utils/logger.js';
import rateLimit from 'express-rate-limit';
import { getPaymentMethods } from '../utils/paymentMethods.js';
import { getCreditPack, CREDIT_PACKS } from '../constants/creditPacks.js';
import { creditStripeSession } from '../utils/creditOrder.js';
import { cheapestVideoCost } from '../utils/creditCalculator.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const stripeRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	message: { error: 'Too many checkout requests, please try again later' },
	validate: { trustProxy: false },
});

router.use(pocketbaseAuth);

// GET /stripe/packs - public list of credit packs for the wallet UI (USD pricing).
// Price is derived from the INR pack price at a fixed rate. The wallet renders
// from this so displayed price always matches what Stripe will charge.
router.get('/packs', (_req, res) => {
	// USD prices are stored as priceUSD on packs if present, or derived from INR.
	// We expose them so the frontend never hard-codes amounts.
	res.json({ packs: CREDIT_PACKS, currency: 'USD', videoUnitCredits: cheapestVideoCost() });
});

// POST /stripe/create-checkout-session
// Body: { packId, successUrl?, cancelUrl? }
// SECURITY: price and credits are derived server-side from the pack id.
// The client only sends a pack id; it cannot influence the charged amount.
router.post('/create-checkout-session', stripeRateLimit, async (req, res) => {
	const methods = await getPaymentMethods();
	if (!methods.stripe) {
		return res.status(503).json({ error: 'Stripe payments are currently disabled' });
	}

	const { packId } = req.body || {};

	if (!packId) {
		return res.status(400).json({ error: 'packId is required' });
	}

	// SECURITY: price and credits come from the server-side pack table, never
	// from the client. A user can only pick a pack id; they cannot set their
	// own price or credit amount.
	const pack = getCreditPack(packId);
	if (!pack) {
		return res.status(400).json({ error: 'Unknown credit pack' });
	}

	// Use pack.priceUSD if defined, otherwise convert from INR at a fixed rate.
	// Stripe charges in the smallest currency unit (cents), so multiply by 100.
	const priceUSD = pack.priceUSD ?? +(pack.priceINR / 83).toFixed(2);
	const creditAmount = pack.credits;
	const userId = req.pocketbaseUserId;

	const origin = process.env.FRONTEND_URL ||
		(req.headers.origin ? req.headers.origin : 'http://localhost:5173');
	const successUrl = `${origin}/app/wallet/success?session_id={CHECKOUT_SESSION_ID}`;
	const cancelUrl = `${origin}/app/wallet/cancel`;

	try {
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: [
				{
					price_data: {
						currency: 'usd',
						product_data: {
							name: `${pack.id.charAt(0).toUpperCase() + pack.id.slice(1)} Credits`,
							description: `${creditAmount} credits for video generation`,
						},
						unit_amount: Math.round(priceUSD * 100),
					},
					quantity: 1,
				},
			],
			mode: 'payment',
			success_url: successUrl,
			cancel_url: cancelUrl,
			metadata: {
				user_id: userId,
				credit_amount: String(creditAmount),
				pack_id: pack.id,
			},
		});

		logger.info(`Stripe checkout session created for user ${userId}, pack=${pack.id}, credits=${creditAmount}`);
		res.json({ url: session.url });
	} catch (error) {
		logger.error('Create checkout session error:', error.message);
		throw error;
	}
});

// GET /stripe/session/:sessionId
// Used by the success page to confirm payment and grant credits.
// Like the Cashfree success-page endpoint, this triggers credit granting
// so credits land immediately without depending solely on the webhook.
router.get('/session/:sessionId', async (req, res) => {
	const { sessionId } = req.params;

	if (!sessionId) {
		return res.status(400).json({ error: 'sessionId is required' });
	}

	try {
		const session = await stripe.checkout.sessions.retrieve(sessionId);

		// Authorization: only let the purchasing user see this session.
		if (session.metadata?.user_id && session.metadata.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Not your session' });
		}

		// Credit-on-return: if paid, grant credits idempotently now. This mirrors
		// the Cashfree success-page flow and makes credits available immediately
		// without waiting for the webhook. Safe to call multiple times.
		if (session.payment_status === 'paid') {
			try {
				await creditStripeSession(sessionId, { knownSession: session });
			} catch (creditErr) {
				logger.error(`Stripe credit-on-return failed for ${sessionId}: ${creditErr.message}`);
			}
		}

		logger.info(`Stripe session retrieved: ${sessionId} status=${session.payment_status}`);

		res.json({
			id: session.id,
			status: session.payment_status,
			amountTotal: session.amount_total,
			customerEmail: session.customer_details?.email,
			creditAmount: session.metadata?.credit_amount
				? parseInt(session.metadata.credit_amount, 10)
				: null,
		});
	} catch (error) {
		logger.error('Retrieve session error:', error.message);
		if (error.code === 'resource_missing') {
			return res.status(404).json({ error: 'Session not found' });
		}
		throw error;
	}
});

export default router;
