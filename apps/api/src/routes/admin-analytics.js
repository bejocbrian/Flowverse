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

// GET /admin/analytics/overview - Get overview stats
router.get('/overview', async (req, res) => {
	try {
		const users = await pb.collection('users').getFullList();
		const videos = await pb.collection('videos').getFullList();

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const videosGeneratedToday = videos.filter(v => {
			const created = new Date(v.created);
			created.setHours(0, 0, 0, 0);
			return created.getTime() === today.getTime();
		}).length;

		const mockApiCosts = Math.floor(Math.random() * 500) + 100;
		const mockActiveQueue = Math.floor(Math.random() * 20) + 5;

		logger.info('Fetched analytics overview');

		res.json({
			totalUsers: users.length,
			videosGeneratedToday,
			apiCosts: mockApiCosts,
			activeQueue: mockActiveQueue,
		});
	} catch (error) {
		logger.error('Fetch analytics overview error:', error.message);
		throw error;
	}
});

// GET /admin/analytics/generations - Get generation stats for last 7 days
router.get('/generations', async (req, res) => {
	try {
		const videos = await pb.collection('videos').getFullList();

		const last7Days = [];
		for (let i = 6; i >= 0; i--) {
			const date = new Date();
			date.setDate(date.getDate() - i);
			date.setHours(0, 0, 0, 0);

			const count = videos.filter(v => {
				const created = new Date(v.created);
				created.setHours(0, 0, 0, 0);
				return created.getTime() === date.getTime();
			}).length;

			last7Days.push({
				date: date.toISOString().split('T')[0],
				count,
			});
		}

		logger.info('Fetched generation analytics');
		res.json(last7Days);
	} catch (error) {
		logger.error('Fetch generation analytics error:', error.message);
		throw error;
	}
});

// GET /admin/analytics/recent-generations - Get recent generation records
router.get('/recent-generations', async (req, res) => {
	try {
		const videos = await pb.collection('videos').getList(1, 10, {
			sort: '-created',
		});

		const recentGenerations = await Promise.all(
			videos.items.map(async (video) => {
				try {
					const user = await pb.collection('users').getOne(video.user_id);
					return {
						userEmail: user.email,
						promptPreview: video.prompt.substring(0, 50) + '...',
						provider: video.provider,
						status: video.status,
						time: video.created,
					};
				} catch (error) {
					return null;
				}
			})
		);

		logger.info('Fetched recent generations');
		res.json(recentGenerations.filter(Boolean));
	} catch (error) {
		logger.error('Fetch recent generations error:', error.message);
		throw error;
	}
});

export default router;
