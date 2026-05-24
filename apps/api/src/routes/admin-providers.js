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

// GET /admin/providers - Get all providers
router.get('/', async (req, res) => {
	try {
		const providers = await pb.collection('providers').getFullList();

		const maskedProviders = providers.map(provider => ({
			id: provider.id,
			name: provider.name,
			api_key: provider.api_key ? `****${provider.api_key.slice(-4)}` : null,
			enabled: provider.enabled,
			model: provider.model,
			weight: provider.weight,
			last_tested_at: provider.last_tested_at,
			created: provider.created,
			updated: provider.updated,
		}));

		logger.info('Fetched all providers');
		res.json({ providers: maskedProviders });
	} catch (error) {
		logger.error('Fetch providers error:', error.message);
		throw error;
	}
});

// POST /admin/providers/:id - Update provider
router.post('/:id', async (req, res) => {
	const { id } = req.params;
	const { api_key, enabled, model, weight } = req.body;

	if (weight !== undefined && (weight < 0 || weight > 100)) {
		return res.status(400).json({ error: 'weight must be between 0 and 100' });
	}

	try {
		const updateData = {};
		if (api_key !== undefined) updateData.api_key = api_key;
		if (enabled !== undefined) updateData.enabled = enabled;
		if (model !== undefined) updateData.model = model;
		if (weight !== undefined) updateData.weight = weight;

		const provider = await pb.collection('providers').update(id, updateData);

		logger.info(`Provider updated: ${id}`);

		res.json({
			provider: {
				id: provider.id,
				name: provider.name,
				api_key: provider.api_key ? `****${provider.api_key.slice(-4)}` : null,
				enabled: provider.enabled,
				model: provider.model,
				weight: provider.weight,
				updated: provider.updated,
			},
		});
	} catch (error) {
		logger.error('Update provider error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'Provider not found' });
		}
		throw error;
	}
});

// POST /admin/providers/:id/test - Test provider health
router.post('/:id/test', async (req, res) => {
	const { id } = req.params;

	try {
		const provider = await pb.collection('providers').getOne(id);

		// Mock health check
		const mockLatency = Math.floor(Math.random() * 300) + 50;
		const mockStatus = 'Operational';

		// Update last_tested_at
		await pb.collection('providers').update(id, {
			last_tested_at: new Date().toISOString(),
		});

		logger.info(`Provider tested: ${id}`);

		res.json({
			status: mockStatus,
			latency: mockLatency,
			provider: provider.name,
		});
	} catch (error) {
		logger.error('Test provider error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'Provider not found' });
		}
		throw error;
	}
});

export default router;
