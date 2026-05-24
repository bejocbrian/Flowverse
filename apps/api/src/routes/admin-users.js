import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { adminRoleCheck } from '../middleware/admin-role-check.js';
import rateLimit from 'express-rate-limit';

const router = Router();

const adminRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 50,
	message: { error: 'Too many admin requests, please try again later' },
	validate: { trustProxy: false },
});

router.use(adminRateLimit);
router.use(adminRoleCheck);

// GET /admin/users - Get paginated users with filters
router.get('/', async (req, res) => {
	const { page = 1, limit = 25, search, filter } = req.query;
	const pageNum = parseInt(page) || 1;
	const limitNum = parseInt(limit) || 25;

	try {
		let filterStr = '';

		if (search) {
			const searchTerm = search.toLowerCase();
			filterStr = `(email ~ "${searchTerm}" || name ~ "${searchTerm}")`;
		}

		if (filter) {
			const filterConditions = [];
			if (filter === 'Active') {
				filterConditions.push('banned_at = null');
			} else if (filter === 'Banned') {
				filterConditions.push('banned_at != null');
			} else if (['Free', 'Pro', 'Studio'].includes(filter)) {
				filterConditions.push(`plan = "${filter}"`);
			}

			if (filterConditions.length > 0) {
				const planFilter = filterConditions.join(' && ');
				filterStr = filterStr ? `${filterStr} && ${planFilter}` : planFilter;
			}
		}

		const users = await pb.collection('users').getList(pageNum, limitNum, {
			filter: filterStr || undefined,
			sort: '-created',
		});

		logger.info(`Fetched users page ${pageNum}`);

		res.json({
			users: users.items.map(user => ({
				id: user.id,
				email: user.email,
				name: user.name,
				plan: user.plan || 'Free',
				credits_balance: user.credits_balance,
				banned_at: user.banned_at,
				created: user.created,
				updated: user.updated,
			})),
			totalItems: users.totalItems,
			totalPages: users.totalPages,
			currentPage: users.page,
		});
	} catch (error) {
		logger.error('Fetch users error:', error.message);
		throw error;
	}
});

// POST /admin/users/:id/credits - Add/deduct credits
router.post('/:id/credits', async (req, res) => {
	const { id } = req.params;
	const { amount, reason } = req.body;

	if (!amount || typeof amount !== 'number') {
		return res.status(400).json({ error: 'amount is required and must be a number' });
	}

	if (!reason) {
		return res.status(400).json({ error: 'reason is required' });
	}

	try {
		const user = await pb.collection('users').getOne(id);
		const newBalance = user.credits_balance + amount;

		if (newBalance < 0) {
			return res.status(400).json({ error: 'Insufficient credits' });
		}

		const updatedUser = await pb.collection('users').update(id, {
			credits_balance: newBalance,
		});

		// Create transaction record
		await pb.collection('transactions').create({
			user_id: id,
			type: amount > 0 ? 'credit' : 'debit',
			amount: Math.abs(amount),
			description: `Admin adjustment: ${reason}`,
		});

		logger.info(`Credits adjusted for user ${id}: ${amount}`);

		res.json({
			user: {
				id: updatedUser.id,
				email: updatedUser.email,
				name: updatedUser.name,
				credits_balance: updatedUser.credits_balance,
			},
		});
	} catch (error) {
		logger.error('Adjust credits error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'User not found' });
		}
		throw error;
	}
});

// POST /admin/users/:id/ban - Ban user
router.post('/:id/ban', async (req, res) => {
	const { id } = req.params;

	try {
		const updatedUser = await pb.collection('users').update(id, {
			banned_at: new Date().toISOString(),
		});

		logger.info(`User banned: ${id}`);

		res.json({
			user: {
				id: updatedUser.id,
				email: updatedUser.email,
				name: updatedUser.name,
				banned_at: updatedUser.banned_at,
			},
		});
	} catch (error) {
		logger.error('Ban user error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'User not found' });
		}
		throw error;
	}
});

// POST /admin/users/:id/unban - Unban user
router.post('/:id/unban', async (req, res) => {
	const { id } = req.params;

	try {
		const updatedUser = await pb.collection('users').update(id, {
			banned_at: null,
		});

		logger.info(`User unbanned: ${id}`);

		res.json({
			user: {
				id: updatedUser.id,
				email: updatedUser.email,
				name: updatedUser.name,
				banned_at: updatedUser.banned_at,
			},
		});
	} catch (error) {
		logger.error('Unban user error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'User not found' });
		}
		throw error;
	}
});

// DELETE /admin/users/:id - Delete user
router.delete('/:id', async (req, res) => {
	const { id } = req.params;

	try {
		await pb.collection('users').delete(id);
		logger.info(`User deleted: ${id}`);
		res.json({ success: true });
	} catch (error) {
		logger.error('Delete user error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'User not found' });
		}
		throw error;
	}
});

export default router;
