import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

router.use(pocketbaseAuth);

// GET /credits/balance - Get user's credit balance
router.get('/balance', async (req, res) => {
	try {
		const user = await pb.collection('users').getOne(req.pocketbaseUserId);
		logger.info(`Fetched balance for user: ${req.pocketbaseUserId}`);

		res.json({
			balance: user.credits_balance,
		});
	} catch (error) {
		logger.error('Fetch balance error:', error.message);
		throw error;
	}
});

// POST /credits/deduct - Deduct credits (internal use)
router.post('/deduct', async (req, res) => {
	const { amount } = req.body;

	if (!amount || amount <= 0) {
		return res.status(400).json({ error: 'Valid amount is required' });
	}

	try {
		const user = await pb.collection('users').getOne(req.pocketbaseUserId);

		if (user.credits_balance < amount) {
			return res.status(400).json({ error: 'Insufficient credits' });
		}

		const newBalance = user.credits_balance - amount;
		await pb.collection('users').update(req.pocketbaseUserId, {
			credits_balance: newBalance,
		});

		// Create transaction record
		await pb.collection('transactions').create({
			user_id: req.pocketbaseUserId,
			type: 'debit',
			amount,
			description: 'Manual credit deduction',
		});

		logger.info(`Credits deducted for user: ${req.pocketbaseUserId}, amount: ${amount}`);

		res.json({
			newBalance,
		});
	} catch (error) {
		logger.error('Deduct credits error:', error.message);
		throw error;
	}
});

// POST /credits/purchase - Purchase credits (mock)
router.post('/purchase', async (req, res) => {
	const { package: creditPackage } = req.body;

	const validPackages = {
		50: 4.99,
		100: 8.99,
		500: 39.99,
	};

	if (!validPackages[creditPackage]) {
		return res.status(400).json({ error: 'Invalid package. Choose 50, 100, or 500' });
	}

	try {
		const user = await pb.collection('users').getOne(req.pocketbaseUserId);
		const newBalance = user.credits_balance + creditPackage;

		// Update user balance
		await pb.collection('users').update(req.pocketbaseUserId, {
			credits_balance: newBalance,
		});

		// Create purchase transaction
		const transaction = await pb.collection('transactions').create({
			user_id: req.pocketbaseUserId,
			type: 'credit',
			amount: creditPackage,
			description: `Credit purchase: ${creditPackage} credits`,
			price: validPackages[creditPackage],
		});

		logger.info(`Credits purchased for user: ${req.pocketbaseUserId}, amount: ${creditPackage}`);

		res.json({
			newBalance,
			transaction: {
				id: transaction.id,
				type: transaction.type,
				amount: transaction.amount,
				price: transaction.price,
				description: transaction.description,
				created: transaction.created,
			},
		});
	} catch (error) {
		logger.error('Purchase credits error:', error.message);
		throw error;
	}
});

export default router;
