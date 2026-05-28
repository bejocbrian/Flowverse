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

const MASK_PREFIX = '****';

function maskKey(key) {
	if (!key) return null;
	const tail = key.slice(-4);
	return `${MASK_PREFIX}${tail}`;
}

function isMaskedKey(value) {
	return typeof value === 'string' && value.startsWith(MASK_PREFIX);
}

function publicProvider(provider) {
	return {
		id: provider.id,
		name: provider.name,
		api_key: maskKey(provider.api_key),
		enabled: provider.enabled,
		model: provider.model,
		weight: provider.weight,
		status: provider.status || null,
		last_tested_at: provider.last_tested_at,
		created: provider.created,
		updated: provider.updated,
	};
}

// GET /admin/providers - Get all providers
router.get('/', async (_req, res) => {
	try {
		const providers = await pb.collection('providers').getFullList();
		logger.info('Fetched all providers');
		res.json({ providers: providers.map(publicProvider) });
	} catch (error) {
		logger.error('Fetch providers error:', error.message);
		throw error;
	}
});

// POST /admin/providers/:id - Update provider
router.post('/:id', async (req, res) => {
	const { id } = req.params;
	const { api_key, enabled, model, weight } = req.body || {};

	if (weight !== undefined && (typeof weight !== 'number' || weight < 0 || weight > 100)) {
		return res.status(400).json({ error: 'weight must be a number between 0 and 100' });
	}

	try {
		const updateData = {};
		// Only persist a new API key if the client sent a real one. The list
		// endpoint returns masked values like "****abcd", so we must reject
		// those round-tripped strings or we would overwrite the real key.
		if (api_key !== undefined && api_key !== null) {
			if (isMaskedKey(api_key) || api_key.includes('•')) {
				// Silently ignore masked round-trips.
			} else if (typeof api_key === 'string' && api_key.length > 0) {
				updateData.api_key = api_key;
			}
		}
		if (enabled !== undefined) updateData.enabled = !!enabled;
		if (model !== undefined) updateData.model = model;
		if (weight !== undefined) updateData.weight = weight;

		const provider = await pb.collection('providers').update(id, updateData);

		logger.info(`Provider updated: ${id}`);
		res.json({ provider: publicProvider(provider) });
	} catch (error) {
		logger.error('Update provider error:', error.message);
		if (error?.status === 404 || error.message.includes('not found')) {
			return res.status(404).json({ error: 'Provider not found' });
		}
		throw error;
	}
});

// Provider name -> health-check URL. We deliberately use lightweight, public
// endpoints that don't require an API key; we just want to know if the
// provider's API surface is reachable from this server.
const HEALTH_URLS = {
	openai: 'https://api.openai.com/v1/models',
	anthropic: 'https://api.anthropic.com/v1/models',
	gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
	google: 'https://generativelanguage.googleapis.com/v1beta/models',
	geminigen: 'https://api.geminigen.ai/health',
	runway: 'https://api.runwayml.com/health',
	pika: 'https://api.pika.art/health',
};

function classifyLatency(ms) {
	if (ms < 800) return 'Operational';
	if (ms < 2500) return 'Degraded';
	return 'Down';
}

async function probeProvider(provider) {
	const key = (provider.name || '').toLowerCase();
	const url = HEALTH_URLS[key];
	const start = Date.now();

	if (!url) {
		// We don't know how to probe this provider yet. Don't fake "Operational".
		return { status: 'Degraded', latency: 0, reason: 'No health endpoint configured' };
	}

	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 5000);
		const response = await fetch(url, { method: 'GET', signal: controller.signal });
		clearTimeout(timer);

		const latency = Date.now() - start;
		// Many of these endpoints will return 401 without a key. That's fine -
		// we got a response, the API surface is up.
		const reachable = response.status < 500;
		return {
			status: reachable ? classifyLatency(latency) : 'Down',
			latency,
			reason: reachable ? null : `HTTP ${response.status}`,
		};
	} catch (error) {
		const latency = Date.now() - start;
		return { status: 'Down', latency, reason: error?.message || 'Network error' };
	}
}

// POST /admin/providers/:id/test - Real-ish health check
router.post('/:id/test', async (req, res) => {
	const { id } = req.params;

	try {
		const provider = await pb.collection('providers').getOne(id);
		const probe = await probeProvider(provider);

		await pb.collection('providers').update(id, {
			status: probe.status,
			last_tested_at: new Date().toISOString(),
		});

		logger.info(`Provider tested: ${id} -> ${probe.status} (${probe.latency}ms)`);

		res.json({
			status: probe.status,
			latency: probe.latency,
			provider: provider.name,
			reason: probe.reason,
		});
	} catch (error) {
		logger.error('Test provider error:', error.message);
		if (error?.status === 404 || error.message.includes('not found')) {
			return res.status(404).json({ error: 'Provider not found' });
		}
		throw error;
	}
});

export default router;
