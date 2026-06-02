import { Router } from 'express';
import Stripe from 'stripe';
import logger from '../utils/logger.js';
import { creditStripeSession } from '../utils/creditOrder.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * POST /webhooks/stripe
 *
 * Stripe sends a signed event when a checkout session completes. We verify the
 * signature with the STRIPE_WEBHOOK_SECRET env var, then delegate to
 * creditStripeSession() — same function the success-page hits, so whichever
 * fires first credits and the other is a no-op.
 *
 * IMPORTANT: This route must receive the raw request body for signature
 * verification. main.js captures rawBody on every request, so req.rawBody is
 * available here. Stripe rejects any request where the body was parsed or
 * modified before verification.
 */
router.post('/stripe', async (req, res) => {
	const sig = req.headers['stripe-signature'];
	const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
	const rawBody = req.rawBody;

	let event;

	if (webhookSecret && sig && rawBody) {
		try {
			event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
		} catch (err) {
			logger.warn(`Stripe webhook signature verification failed: ${err.message}`);
			return res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
		}
	} else {
		// No secret configured or missing sig/body — fall back to parsing the
		// already-parsed body. Only acceptable in local dev; prod must configure
		// STRIPE_WEBHOOK_SECRET.
		if (webhookSecret) {
			logger.warn(
				`Stripe webhook: missing signature or rawBody ` +
				`(hasSig=${!!sig} hasRaw=${!!rawBody}). ` +
				`Cannot verify — falling back to unverified body.`,
			);
		}
		event = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)
			? req.body
			: {};
	}

	const eventType = event?.type;
	logger.info(`Stripe webhook: ${eventType}`);

	if (eventType === 'checkout.session.completed') {
		const session = event.data?.object;
		const sessionId = session?.id;

		if (session?.payment_status === 'paid' && sessionId) {
			try {
				const outcome = await creditStripeSession(sessionId, { knownSession: session });
				logger.info(`Stripe webhook credit outcome for ${sessionId}: ${JSON.stringify(outcome)}`);
			} catch (err) {
				logger.error(`Stripe webhook credit error for ${sessionId}: ${err.message}`);
				// Return 200 so Stripe doesn't retry indefinitely. The success-page
				// polling path serves as the fallback.
			}
		}
	}

	res.status(200).json({ received: true });
});

export default router;
