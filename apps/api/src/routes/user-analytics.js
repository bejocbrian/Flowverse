/**
 * Per-user analytics endpoints. Mounted at /users/me/analytics.
 *
 * Backed by `videos` and `transactions` PocketBase collections.
 * Authenticated via the regular pocketbaseAuth middleware - the data is
 * always scoped to req.pocketbaseUserId so users can only see their own
 * stats.
 */
import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

router.use(pocketbaseAuth);

/**
 * Reject requests where the auth middleware did not resolve a user. We
 * still let the chain continue if there's no token (the middleware does
 * `next()` early), so we re-check here.
 */
function requireUser(req, res, next) {
	if (!req.pocketbaseUserId) {
		return res.status(401).json({ error: 'Authentication required' });
	}
	return next();
}

router.use(requireUser);

/* ------------------------------------------------------------------------- */
/*  Helpers                                                                  */
/* ------------------------------------------------------------------------- */

function startOfDay(d = new Date()) {
	const out = new Date(d);
	out.setHours(0, 0, 0, 0);
	return out;
}

function startOfMonth(d = new Date()) {
	return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function isoDay(d) {
	return d.toISOString().split('T')[0];
}

/* ------------------------------------------------------------------------- */
/*  GET /users/me/analytics/overview                                         */
/* ------------------------------------------------------------------------- */
// Returns: total generations, success/failure counts, credits spent
// (lifetime + this month), success rate, current balance.
router.get('/overview', async (req, res) => {
	const userId = req.pocketbaseUserId;

	try {
		const [user, videos, txs] = await Promise.all([
			pb.collection('users').getOne(userId),
			pb.collection('videos').getFullList({ filter: `user_id = "${userId}"` }),
			pb.collection('transactions').getFullList({ filter: `user_id = "${userId}"` }),
		]);

		const total = videos.length;
		const completed = videos.filter((v) => v.status === 'completed').length;
		const failed = videos.filter((v) => v.status === 'failed').length;
		const inFlight = videos.filter((v) =>
			['queued', 'processing', 'generating'].includes(v.status)
		).length;

		const monthStart = startOfMonth();

		const generationTxs = txs.filter((t) => t.type === 'generation');
		const lifetimeSpent = generationTxs.reduce((s, t) => s + (t.amount || 0), 0);
		const monthSpent = generationTxs
			.filter((t) => new Date(t.created) >= monthStart)
			.reduce((s, t) => s + (t.amount || 0), 0);

		const totalEarned = txs
			.filter((t) => ['bonus', 'purchase', 'refund'].includes(t.type))
			.reduce((s, t) => s + (t.amount || 0), 0);

		const successRate = total === 0 ? 0 : Math.round((completed / total) * 100);

		res.json({
			balance: user.credits_balance ?? 0,
			generations: { total, completed, failed, inFlight },
			credits: {
				lifetimeSpent,
				monthSpent,
				totalEarned,
			},
			successRate,
		});
	} catch (err) {
		logger.error('User analytics overview error:', err.message);
		res.status(500).json({ error: 'Failed to fetch analytics' });
	}
});

/* ------------------------------------------------------------------------- */
/*  GET /users/me/analytics/timeline                                         */
/* ------------------------------------------------------------------------- */
// 30-day time series of generations and credits spent per day.
router.get('/timeline', async (req, res) => {
	const userId = req.pocketbaseUserId;
	const days = Math.max(1, Math.min(90, parseInt(req.query.days, 10) || 30));

	try {
		const since = startOfDay(new Date(Date.now() - (days - 1) * 86400000));
		const sinceIso = since.toISOString();

		const [videos, txs] = await Promise.all([
			pb.collection('videos').getFullList({
				filter: `user_id = "${userId}" && created >= "${sinceIso}"`,
			}),
			pb.collection('transactions').getFullList({
				filter: `user_id = "${userId}" && type = "generation" && created >= "${sinceIso}"`,
			}),
		]);

		// Build empty bucket map.
		const buckets = new Map();
		for (let i = 0; i < days; i++) {
			const d = startOfDay(new Date(since.getTime() + i * 86400000));
			buckets.set(isoDay(d), { date: isoDay(d), generations: 0, credits: 0 });
		}

		for (const v of videos) {
			const k = isoDay(startOfDay(new Date(v.created)));
			const b = buckets.get(k);
			if (b) b.generations += 1;
		}
		for (const t of txs) {
			const k = isoDay(startOfDay(new Date(t.created)));
			const b = buckets.get(k);
			if (b) b.credits += t.amount || 0;
		}

		res.json({ days, points: Array.from(buckets.values()) });
	} catch (err) {
		logger.error('User analytics timeline error:', err.message);
		res.status(500).json({ error: 'Failed to fetch timeline' });
	}
});

/* ------------------------------------------------------------------------- */
/*  GET /users/me/analytics/breakdown                                        */
/* ------------------------------------------------------------------------- */
// Generations grouped by provider and by status.
router.get('/breakdown', async (req, res) => {
	const userId = req.pocketbaseUserId;

	try {
		const videos = await pb
			.collection('videos')
			.getFullList({ filter: `user_id = "${userId}"` });

		const byProvider = {};
		const byStatus = {};
		for (const v of videos) {
			const p = v.provider || 'unknown';
			byProvider[p] = (byProvider[p] || 0) + 1;
			const s = v.status || 'unknown';
			byStatus[s] = (byStatus[s] || 0) + 1;
		}

		res.json({
			byProvider: Object.entries(byProvider)
				.map(([name, count]) => ({ name, count }))
				.sort((a, b) => b.count - a.count),
			byStatus: Object.entries(byStatus)
				.map(([name, count]) => ({ name, count }))
				.sort((a, b) => b.count - a.count),
		});
	} catch (err) {
		logger.error('User analytics breakdown error:', err.message);
		res.status(500).json({ error: 'Failed to fetch breakdown' });
	}
});

/* ------------------------------------------------------------------------- */
/*  GET /users/me/analytics/recent                                           */
/* ------------------------------------------------------------------------- */
// Last 5 generations and last 5 transactions for the activity feed.
router.get('/recent', async (req, res) => {
	const userId = req.pocketbaseUserId;

	try {
		const [videos, txs] = await Promise.all([
			pb.collection('videos').getList(1, 5, {
				filter: `user_id = "${userId}"`,
				sort: '-created',
			}),
			pb.collection('transactions').getList(1, 5, {
				filter: `user_id = "${userId}"`,
				sort: '-created',
			}),
		]);

		res.json({
			videos: videos.items.map((v) => ({
				id: v.id,
				prompt: v.prompt,
				status: v.status,
				provider: v.provider,
				model: v.model,
				output_type: v.output_type || 'video',
				video_url: v.video_url,
				credit_cost: v.credit_cost,
				created: v.created,
			})),
			transactions: txs.items.map((t) => ({
				id: t.id,
				type: t.type,
				amount: t.amount,
				balance_after: t.balance_after,
				description: t.description,
				created: t.created,
			})),
		});
	} catch (err) {
		logger.error('User analytics recent error:', err.message);
		res.status(500).json({ error: 'Failed to fetch recent activity' });
	}
});

export default router;
