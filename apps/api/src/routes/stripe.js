import { Router } from 'express';
import Stripe from 'stripe';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import logger from '../utils/logger.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const stripeRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	message: { error: 'Too many checkout requests, please try again later' },
	validate: { trustProxy: false },
});

router.use(pocketbaseAuth);

// POST /stripe/create-checkout-session
router.post('/create-checkout-session', stripeRateLimit, async (req, res) => {
	const { creditAmount, price, successUrl, cancelUrl } = req.body;

	if (!creditAmount || !price || !successUrl || !cancelUrl) {
		return res.status(400).json({ error: 'creditAmount, price, successUrl, and cancelUrl are required' });
	}

	if (typeof price !== 'number' || price <= 0) {
		return res.status(400).json({ error: 'price must be a positive number' });
	}

	try {
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: [
				{
					price_data: {
						currency: 'usd',
						product_data: {
							name: 'Video Credits',
							description: `${creditAmount} credits for video generation`,
						},
						unit_amount: Math.round(price * 100),
					},
					quantity: 1,
				},
			],
			mode: 'payment',
			success_url: successUrl,
			cancel_url: cancelUrl,
			metadata: {
				user_id: req.pocketbaseUserId,
				credit_amount: creditAmount.toString(),
			},
		});

		logger.info(`Checkout session created for user: ${req.pocketbaseUserId}, credits: ${creditAmount}`);

		res.json({ url: session.url });
	} catch (error) {
		logger.error('Create checkout session error:', error.message);
		throw error;
	}
});

// GET /stripe/session/:sessionId
router.get('/session/:sessionId', async (req, res) => {
	const { sessionId } = req.params;

	if (!sessionId) {
		return res.status(400).json({ error: 'sessionId is required' });
	}

	try {
		const session = await stripe.checkout.sessions.retrieve(sessionId);

		logger.info(`Retrieved checkout session: ${sessionId}`);

		res.json({
			id: session.id,
			status: session.payment_status,
			amountTotal: session.amount_total,
			customerEmail: session.customer_details?.email,
			creditAmount: session.metadata?.credit_amount ? parseInt(session.metadata.credit_amount) : null,
		});
	} catch (error) {
		logger.error('Retrieve session error:', error.message);
		if (error.message.includes('No such checkout.session')) {
			return res.status(404).json({ error: 'Session not found' });
		}
		throw error;
	}
});

export default router;
