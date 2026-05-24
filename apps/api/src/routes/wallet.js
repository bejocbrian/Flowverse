import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

router.use(pocketbaseAuth);

// GET /wallet/balance - Get user's credit balance and recent transactions
router.get('/balance', async (req, res) => {
	if (!req.pocketbaseUserId) {
		return res.status(401).json({ error: 'Authentication required' });
	}

	try {
		const user = await pb.collection('users').getOne(req.pocketbaseUserId);

		const transactions = await pb.collection('transactions').getList(1, 20, {
			filter: `user_id = "${req.pocketbaseUserId}"`,
			sort: '-created',
		});

		logger.info(`Fetched wallet for user: ${req.pocketbaseUserId}`);

		res.json({
			balance: user.credits_balance || 0,
			transactions: transactions.items.map(t => ({
				id: t.id,
				type: t.type,
				amount: t.amount,
				description: t.description,
				created: t.created,
			})),
		});
	} catch (error) {
		logger.error('Fetch wallet error:', error.message);
		throw error;
	}
});

// GET /wallet/transactions - Get paginated transaction history
router.get('/transactions', async (req, res) => {
	if (!req.pocketbaseUserId) {
		return res.status(401).json({ error: 'Authentication required' });
	}

	const { page = 1, perPage = 20 } = req.query;

	try {
		const transactions = await pb.collection('transactions').getList(
			parseInt(page),
			parseInt(perPage),
			{
				filter: `user_id = "${req.pocketbaseUserId}"`,
				sort: '-created',
			}
		);

		res.json({
			items: transactions.items.map(t => ({
				id: t.id,
				type: t.type,
				amount: t.amount,
				description: t.description,
				video_id: t.video_id,
				created: t.created,
			})),
			totalItems: transactions.totalItems,
			totalPages: transactions.totalPages,
			currentPage: transactions.page,
		});
	} catch (error) {
		logger.error('Fetch transactions error:', error.message);
		throw error;
	}
});

export default router;
