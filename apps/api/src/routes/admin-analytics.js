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

const TODAY_START = () => {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
};

// Rough estimated cost (USD) per generation. Until we wire up real
// per-provider billing, we charge $0.20 per completed video as a stand-in.
// Stored as a single constant so the assumption is obvious.
const COST_PER_COMPLETED_VIDEO_USD = 0.2;

// GET /admin/analytics/overview
router.get('/overview', async (_req, res) => {
	try {
		const [usersCount, totalVideosToday, completedToday, activeQueue] = await Promise.all([
			pb
				.collection('users')
				.getList(1, 1, { fields: 'id' })
				.then((r) => r.totalItems),
			pb
				.collection('videos')
				.getList(1, 1, {
					filter: `created >= "${TODAY_START().toISOString()}"`,
					fields: 'id',
				})
				.then((r) => r.totalItems),
			pb
				.collection('videos')
				.getList(1, 1, {
					filter: `created >= "${TODAY_START().toISOString()}" && status = "completed"`,
					fields: 'id',
				})
				.then((r) => r.totalItems),
			pb
				.collection('videos')
				.getList(1, 1, {
					filter: '(status = "queued" || status = "generating")',
					fields: 'id',
				})
				.then((r) => r.totalItems),
		]);

		const apiCosts = +(completedToday * COST_PER_COMPLETED_VIDEO_USD).toFixed(2);

		logger.info('Fetched analytics overview');

		res.json({
			totalUsers: usersCount,
			videosGeneratedToday: totalVideosToday,
			apiCosts,
			activeQueue,
		});
	} catch (error) {
		logger.error('Fetch analytics overview error:', error.message);
		throw error;
	}
});

// GET /admin/analytics/generations - last 7 days
router.get('/generations', async (_req, res) => {
	try {
		const today = TODAY_START();
		const start = new Date(today);
		start.setDate(start.getDate() - 6);

		const videos = await pb.collection('videos').getFullList({
			filter: `created >= "${start.toISOString()}"`,
			fields: 'created',
		});

		const buckets = new Map();
		for (let i = 6; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			buckets.set(d.toISOString().split('T')[0], 0);
		}

		for (const v of videos) {
			const day = new Date(v.created);
			day.setHours(0, 0, 0, 0);
			const key = day.toISOString().split('T')[0];
			if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
		}

		const result = Array.from(buckets, ([date, count]) => ({ date, count }));
		logger.info('Fetched generation analytics');
		res.json(result);
	} catch (error) {
		logger.error('Fetch generation analytics error:', error.message);
		throw error;
	}
});

// GET /admin/analytics/recent-generations
router.get('/recent-generations', async (_req, res) => {
	try {
		const videos = await pb.collection('videos').getList(1, 10, {
			sort: '-created',
			expand: 'user_id',
		});

		// Resolve user emails. If `expand` worked we use it; otherwise fall
		// back to direct fetches with a small in-memory cache so we don't
		// hammer the DB if the same user shows up multiple times.
		const userCache = new Map();
		const recentGenerations = await Promise.all(
			videos.items.map(async (video) => {
				let email = video.expand?.user_id?.email;
				if (!email && video.user_id) {
					if (userCache.has(video.user_id)) {
						email = userCache.get(video.user_id);
					} else {
						try {
							const u = await pb.collection('users').getOne(video.user_id, { fields: 'email' });
							email = u.email;
							userCache.set(video.user_id, email);
						} catch {
							email = 'unknown';
						}
					}
				}

				const prompt = video.prompt || '';
				return {
					userEmail: email || 'unknown',
					promptPreview: prompt.length > 50 ? `${prompt.substring(0, 50)}...` : prompt,
					provider: video.provider || 'unknown',
					status: video.status,
					time: video.created,
				};
			}),
		);

		logger.info('Fetched recent generations');
		res.json(recentGenerations);
	} catch (error) {
		logger.error('Fetch recent generations error:', error.message);
		throw error;
	}
});

export default router;
