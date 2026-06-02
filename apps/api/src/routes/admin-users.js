import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { adminRoleCheck } from '../middleware/admin-role-check.js';
import rateLimit from 'express-rate-limit';
import { isPaidUser, clearUserTierCache } from '../utils/userTier.js';

const router = Router();

const adminRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 50,
	message: { error: 'Too many admin requests, please try again later' },
	validate: { trustProxy: false },
});

router.use(adminRateLimit);
router.use(adminRoleCheck);

async function publicUser(u) {
	const paid = await isPaidUser(u.id).catch(() => false);
	return {
		id: u.id,
		email: u.email,
		name: u.name,
		role: u.role,
		credits_balance: u.credits_balance ?? 0,
		is_paid: paid,
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
		// Paid/Free filter: resolved after the DB query (isPaidUser checks transactions).
		const filterStr = conditions.length ? conditions.join(' && ') : undefined;

		const result = await pb.collection('users').getList(pageNum, limitNum, {
			filter: filterStr,
			sort: '-created',
		});

		// Resolve is_paid for each user (batched, uses the 60s cache in userTier.js).
		let items = await Promise.all(result.items.map(publicUser));

		// Post-filter for Paid/Free (can't do this in PocketBase since it's a
		// derived field from the transactions collection).
		if (filter === 'Paid') items = items.filter((u) => u.is_paid);
		else if (filter === 'Free') items = items.filter((u) => !u.is_paid);

		logger.info(`Fetched users page ${pageNum}`);

		res.json({
			users: items,
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
		// Admin credit adjustments always use `refund` (positive = admin grant,
		// negative = admin deduction). We deliberately do NOT use `purchase` here
		// because that would incorrectly mark the user as "paid" tier. Use the
		// dedicated /grant-paid endpoint to explicitly grant paid access.
		const txType = 'refund';

		try {
			await pb.collection('transactions').create({
				user_id: id,
				type: txType,
				amount,
				balance_after: newBalance,
				// Persist the admin's reason so it shows in the user's wallet
				// history and serves as an audit trail. Prefix makes the source
				// of the adjustment unambiguous (vs a real payment refund).
				description: `${amount < 0 ? 'Admin deduction' : 'Admin credit'}: ${reason.trim()}`,
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

		res.json({ user: await publicUser(updatedUser) });
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
		res.json({ user: await publicUser(updated) });
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
		res.json({ user: await publicUser(updated) });
	} catch (error) {
		logger.error('Unban user error:', error.message);
		if (error?.status === 404 || error.message.includes('not found')) {
			return res.status(404).json({ error: 'User not found' });
		}
		throw error;
	}
});

// POST /admin/users/:id/grant-paid
// Creates a purchase transaction for the user, marking them as "paid".
// This is the manual equivalent of a real payment — used when a user has
// paid via the manual UPI/WhatsApp flow and you want to unlock paid models.
router.post('/:id/grant-paid', async (req, res) => {
	const { id } = req.params;
	const { reason } = req.body || {};
	const note = (typeof reason === 'string' && reason.trim()) || 'Admin grant: manual payment';

	try {
		const user = await pb.collection('users').getOne(id);

		// Idempotency: if already paid, just return the current state.
		const alreadyPaid = await isPaidUser(id).catch(() => false);
		if (alreadyPaid) {
			return res.json({ user: await publicUser(user), already_paid: true });
		}

		// Create a purchase transaction — this is what isPaidUser() checks.
		// amount=1 is a nominal tier-marker; PocketBase's required number field
		// rejects 0 as falsy, so we use 1 (no credits are actually added to
		// the balance — balance_after equals the current balance unchanged).
		await pb.collection('transactions').create({
			user_id: id,
			type: 'purchase',
			amount: 1,
			balance_after: user.credits_balance ?? 0,
			description: note,
		});

		clearUserTierCache(id);
		logger.info(`Paid tier granted to user ${id} by admin (reason: ${note})`);
		// Re-fetch user so the response reflects the just-created purchase tx.
		const updatedUser = await pb.collection('users').getOne(id);
		res.json({ user: await publicUser(updatedUser) });
	} catch (error) {
		logger.error('Grant paid error:', error.message);
		if (error?.status === 404 || error.message.includes('not found')) {
			return res.status(404).json({ error: 'User not found' });
		}
		throw error;
	}
});

// POST /admin/users/:id/revoke-paid
// Deletes all purchase transactions for the user, reverting them to free tier.
// Credits balance is NOT changed — only the tier marker is removed.
router.post('/:id/revoke-paid', async (req, res) => {
	const { id } = req.params;

	try {
		const user = await pb.collection('users').getOne(id);

		// Find and delete all purchase transactions for this user.
		const purchases = await pb.collection('transactions').getFullList({
			filter: `user_id = "${id}" && type = "purchase"`,
		});

		await Promise.all(purchases.map((tx) => pb.collection('transactions').delete(tx.id)));

		clearUserTierCache(id);
		logger.info(`Paid tier revoked for user ${id} by admin (${purchases.length} purchase tx removed)`);
		res.json({ user: await publicUser(user), revoked: purchases.length });
	} catch (error) {
		logger.error('Revoke paid error:', error.message);
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
