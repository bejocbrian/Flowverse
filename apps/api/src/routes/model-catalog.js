import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { adminRoleCheck } from '../middleware/admin-role-check.js';
import { loadCatalog, invalidateCache, getVariantByKey, variantDurations, variantResolutions } from '../utils/modelCatalog.js';

const router = Router();

// ─── Public routes (no auth) ──────────────────────────────────────────

// GET /model-catalog — enabled + routed models (for frontend picker)
router.get('/', async (_req, res) => {
	try {
		const catalog = await loadCatalog();
		const enabled = catalog.filter(m => m.enabled && m.routed);

		const models = enabled.map(m => ({
			key: m.key,
			id: m.id,
			label: m.label,
			provider: m.provider,
			type: m.type,
			billing: m.billing,
			credits: m.credits,
			creditsPerSecond: m.creditsPerSecond,
			durations: variantDurations(m),
			aspectRatios: m.aspectRatios,
			imageModes: m.imageModes,
			maxRefImages: m.maxRefImages,
			freeAccess: m.freeAccess,
			description: m.description,
			category: m.category,
		}));

		res.json({ models });
	} catch (err) {
		logger.error('Failed to fetch model catalog:', err.message);
		res.status(500).json({ error: 'Failed to fetch models' });
	}
});

// ─── Admin routes (require admin role) ────────────────────────────────

// GET /model-catalog/all — admin: all models with full details
// NOTE: /all must be registered BEFORE /:key so Express doesn't match "all" as a key param.
router.get('/all', adminRoleCheck, async (_req, res) => {
	try {
		const page = await pb.collection('model_catalog').getList(1, 200, {
			sort: 'sortOrder',
		});

		const models = page.items.map(r => ({
			id: r.id,
			key: r.key,
			label: r.label,
			provider: r.provider,
			type: r.type,
			billing: r.billing,
			credits: r.credits,
			creditsPerSecond: r.creditsPerSecond,
			durations: r.durations,
			minDuration: r.minDuration,
			maxDuration: r.maxDuration,
			aspectRatios: r.aspectRatios,
			imageModes: r.imageModes,
			maxRefImages: r.maxRefImages,
			freeAccess: r.freeAccess,
			routed: r.routed,
			enabled: r.enabled,
			sortOrder: r.sortOrder,
			vendorModelId: r.vendorModelId,
			description: r.description,
			category: r.category,
			created: r.created,
			updated: r.updated,
		}));

		res.json({ models, total: page.totalItems });
	} catch (err) {
		logger.error('Failed to fetch all models:', err.message);
		res.status(500).json({ error: 'Failed to fetch models' });
	}
});

// POST /model-catalog — admin: create a new model
router.post('/', adminRoleCheck, async (req, res) => {
	try {
		const {
			key, label, provider, type, billing,
			credits, creditsPerSecond,
			durations, minDuration, maxDuration,
			aspectRatios, imageModes, maxRefImages,
			freeAccess, routed, enabled,
			sortOrder, vendorModelId, description, category,
		} = req.body || {};

		if (!key || !label || !provider || !billing) {
			return res.status(400).json({
				error: 'key, label, provider, and billing are required',
			});
		}

		if (!['per_video', 'per_second', 'per_image'].includes(billing)) {
			return res.status(400).json({
				error: 'billing must be per_video, per_second, or per_image',
			});
		}

		const existing = await pb.collection('model_catalog').getList(1, 1, {
			filter: `key = "${key}"`,
		});
		if (existing.totalItems > 0) {
			return res.status(400).json({ error: `Model with key "${key}" already exists` });
		}

		const record = await pb.collection('model_catalog').create({
			key,
			label,
			provider,
			type: type || 'video',
			billing,
			credits: credits || null,
			creditsPerSecond: creditsPerSecond || null,
			durations: durations || null,
			minDuration: minDuration != null ? minDuration : null,
			maxDuration: maxDuration != null ? maxDuration : null,
			aspectRatios: aspectRatios || ['16:9', '9:16'],
			imageModes: imageModes || [],
			maxRefImages: maxRefImages || 0,
			freeAccess: !!freeAccess,
			routed: !!routed,
			enabled: !!enabled,
			sortOrder: sortOrder || 0,
			vendorModelId: vendorModelId || key,
			description: description || '',
			category: category || 'Standard',
		});

		invalidateCache();
		logger.info(`Model created: ${key} (id: ${record.id})`);

		res.status(201).json({
			success: true,
			model: {
				id: record.id,
				key: record.key,
				label: record.label,
				provider: record.provider,
			},
		});
	} catch (err) {
		logger.error('Failed to create model:', err.message);
		res.status(500).json({ error: 'Failed to create model' });
	}
});

// POST /model-catalog/refresh — admin: force cache refresh
router.post('/refresh', adminRoleCheck, async (_req, res) => {
	try {
		invalidateCache();
		const catalog = await loadCatalog({ forceRefresh: true });

		res.json({
			success: true,
			message: `Cache refreshed. ${catalog.length} models loaded.`,
			count: catalog.length,
		});
	} catch (err) {
		logger.error('Failed to refresh catalog:', err.message);
		res.status(500).json({ error: 'Failed to refresh catalog' });
	}
});

// GET /model-catalog/:key — get a single model by key (MUST be last — catches everything)
router.get('/:key', async (req, res) => {
	try {
		const variant = await getVariantByKey(req.params.key);
		if (!variant) {
			return res.status(404).json({ error: 'Model not found' });
		}

		const durations = variantDurations(variant);
		const resolutions = variantResolutions(variant);

		res.json({
			...variant,
			durations,
			resolutions,
		});
	} catch (err) {
		logger.error('Failed to fetch model:', err.message);
		res.status(500).json({ error: 'Failed to fetch model' });
	}
});

// PATCH /model-catalog/:id — admin: update a model
router.patch('/:id', adminRoleCheck, async (req, res) => {
	try {
		const { id } = req.params;
		const updates = req.body || {};

		if (updates.billing && !['per_video', 'per_second', 'per_image'].includes(updates.billing)) {
			return res.status(400).json({
				error: 'billing must be per_video, per_second, or per_image',
			});
		}

		if (updates.key) {
			const existing = await pb.collection('model_catalog').getList(1, 1, {
				filter: `key = "${updates.key}" && id != "${id}"`,
			});
			if (existing.totalItems > 0) {
				return res.status(400).json({ error: `Key "${updates.key}" is already in use` });
			}
		}

		const allowed = [
			'key', 'label', 'provider', 'type', 'billing',
			'credits', 'creditsPerSecond',
			'durations', 'minDuration', 'maxDuration',
			'aspectRatios', 'imageModes', 'maxRefImages',
			'freeAccess', 'routed', 'enabled',
			'sortOrder', 'vendorModelId', 'description', 'category',
		];

		const safeUpdates = {};
		for (const field of allowed) {
			if (updates[field] !== undefined) {
				safeUpdates[field] = updates[field];
			}
		}

		if (Object.keys(safeUpdates).length === 0) {
			return res.status(400).json({ error: 'No valid fields to update' });
		}

		const record = await pb.collection('model_catalog').update(id, safeUpdates);
		invalidateCache();

		logger.info(`Model updated: ${record.key} (id: ${id})`);

		res.json({
			success: true,
			model: {
				id: record.id,
				key: record.key,
				label: record.label,
				provider: record.provider,
				enabled: record.enabled,
				routed: record.routed,
			},
		});
	} catch (err) {
		logger.error('Failed to update model:', err.message);
		res.status(500).json({ error: 'Failed to update model' });
	}
});

// DELETE /model-catalog/:id — admin: remove a model
router.delete('/:id', adminRoleCheck, async (req, res) => {
	try {
		const { id } = req.params;

		const record = await pb.collection('model_catalog').getOne(id);

		await pb.collection('model_catalog').delete(id);
		invalidateCache();

		logger.info(`Model deleted: ${record.key} (id: ${id})`);

		res.json({ success: true, message: `Model "${record.key}" deleted` });
	} catch (err) {
		if (err?.status === 404) {
			return res.status(404).json({ error: 'Model not found' });
		}
		logger.error('Failed to delete model:', err.message);
		res.status(500).json({ error: 'Failed to delete model' });
	}
});

export default router;
