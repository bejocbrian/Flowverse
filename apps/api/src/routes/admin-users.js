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

function publicUser(u) {
	return {
		id: u.id,
		email: u.email,
		name: u.name,
		role: u.role,
		credits_balance: u.credits_balance ?? 0,
		banned_at: u.banned_at || null,
		created: u.created,
		updated: u.updated,
	};
}

// Escape any character that has meaning in PocketBase filter strings.
function escapeFilter(value) {
	return String(value).replace(/["\\]/g, (m) => `\\${m}`);
}

// GET /admin/users - Paginated users with filters
router.get('/', async (req, res) => {
	const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
	const limitNum = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
	const search = (req.query.search || '').trim();
	const filter = (req.query.filter || 'All').trim();

	try {
		const conditions = [];

		if (search) {
			const safe = escapeFilter(search);
			conditions.push(`(email ~ "${safe}" || name ~ "${safe}")`);
		}

		if (filter === 'Active') {
			conditions.push('banned_at = null');
		} else if (filter === 'Banned') {
			conditions.push('banned_at != null');
		}
		// Note: there is intentionally no plan/tier filter here. The users
		// collection has no `plan` field. If/when one is added, restore it.

		const filterStr = conditions.length ? conditions.join(' && ') : undefined;

		const result = await pb.collection('users').getList(pageNum, limitNum, {
			filter: filterStr,
			sort: '-created',
		});

		logger.info(`Fetched users page ${pageNum}`);

		res.json({
			users: result.items.map(publicUser),
			totalItems: result.totalItems,
			totalPages: result.totalPages,
			currentPage: result.page,
		});
	} catch (error) {
		logger.error('Fetch users error:', error.message);
		throw error;
	}
});

// POST /admin/users/:id/credits - Add or deduct credits
router.post('/:id/credits', async (req, res) => {
	const { id } = req.params;
	const { amount, reason } = req.body || {};

	if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) {
		return res.status(400).json({ error: 'amount must be a non-zero number' });
	}

	if (!reason || typeof reason !== 'string' || !reason.trim()) {
		return res.status(400).json({ error: 'reason is required' });
	}

	try {
		const user = await pb.collection('users').getOne(id);
		const currentBalance = user.credits_balance ?? 0;
		const newBalance = currentBalance + amount;

		if (newBalance < 0) {
			return res.status(400).json({ error: 'Insufficient credits' });
		}

		const updatedUser = await pb.collection('users').update(id, {
			credits_balance: newBalance,
		});

		// `transactions.type` only allows: purchase | generation | refund.
		// Admin grants map to `purchase`; admin debits map to `refund` (negative
		// amount), which keeps the audit trail consistent with the schema.
		const txType = amount > 0 ? 'purchase' : 'refund';

		try {
			await pb.collection('transactions').create({
				user_id: id,
				type: txType,
				amount,
				balance_after: newBalance,
			});
		} catch (txError) {
			// Don't roll back the credit change just because the audit row
			// failed - log loudly so it can be investigated.
			logger.error(
				`Credits adjusted but transaction record failed for user ${id}: ${txError.message}`,
			);
		}

		logger.info(
			`Credits adjusted for user ${id}: ${amount} (reason: ${reason.trim()})`,
		);

		res.json({ user: publicUser(updatedUser) });
	} catch (error) {
		logger.error('Adjust credits error:', error.message);
		if (error?.status === 404 || error.message.includes('not found')) {
			return res.status(404).json({ error: 'User not found' });
		}
		throw error;
	}
});

// POST /admin/users/:id/ban
router.post('/:id/ban', async (req, res) => {
	try {
		const updated = await pb.collection('users').update(req.params.id, {
			banned_at: new Date().toISOString(),
		});
		logger.info(`User banned: ${req.params.id}`);
		res.json({ user: publicUser(updated) });
	} catch (error) {
		logger.error('Ban user error:', error.message);
		if (error?.status === 404 || error.message.includes('not found')) {
			return res.status(404).json({ error: 'User not found' });
		}
		throw error;
	}
});

// POST /admin/users/:id/unban
router.post('/:id/unban', async (req, res) => {
	try {
		const updated = await pb.collection('users').update(req.params.id, {
			banned_at: null,
		});
		logger.info(`User unbanned: ${req.params.id}`);
		res.json({ user: publicUser(updated) });
	} catch (error) {
		logger.error('Unban user error:', error.message);
		if (error?.status === 404 || error.message.includes('not found')) {
			return res.status(404).json({ error: 'User not found' });
		}
		throw error;
	}
});

// DELETE /admin/users/:id
router.delete('/:id', async (req, res) => {
	try {
		await pb.collection('users').delete(req.params.id);
		logger.info(`User deleted: ${req.params.id}`);
		res.json({ success: true });
	} catch (error) {
		logger.error('Delete user error:', error.message);
		if (error?.status === 404 || error.message.includes('not found')) {
			return res.status(404).json({ error: 'User not found' });
		}
		throw error;
	}
});

export default router;
