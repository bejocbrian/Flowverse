import pb from './pocketbaseClient.js';
import logger from './logger.js';

/**
 * Model Catalog — DB-driven model management with in-memory caching.
 *
 * Reads from the PocketBase `model_catalog` collection and caches the results
 * in memory for performance. The cache is invalidated after a configurable TTL
 * or when admin explicitly refreshes it.
 *
 * Fallback: if the DB is empty or unreachable, falls back to the hardcoded
 * MODEL_VARIANTS from constants/models.js so the app never breaks.
 */

const CACHE_TTL_MS = 60 * 1000; // 60 seconds
let cache = null;
let cacheTimestamp = 0;

/**
 * Convert a PocketBase model_catalog record to the variant shape used by
 * creditCalculator, routes/models, and the frontend.
 */
function recordToVariant(record) {
	const r = record;
	return {
		key: r.key,
		id: r.vendorModelId || r.key,
		label: r.label,
		provider: r.provider,
		type: r.type || 'video',
		billing: r.billing,
		credits: r.credits || undefined,
		creditsPerSecond: r.creditsPerSecond || undefined,
		durations: r.durations || undefined,
		minDuration: r.minDuration != null ? r.minDuration : undefined,
		maxDuration: r.maxDuration != null ? r.maxDuration : undefined,
		aspectRatios: r.aspectRatios || ['16:9', '9:16'],
		imageModes: r.imageModes || [],
		maxRefImages: r.maxRefImages || 0,
		freeAccess: !!r.freeAccess,
		routed: !!r.routed,
		enabled: !!r.enabled,
		sortOrder: r.sortOrder || 0,
		vendorModelId: r.vendorModelId || r.key,
		description: r.description || '',
		category: r.category || 'Standard',
	};
}

/**
 * Load the full model catalog from DB. Returns an array of variant objects
 * sorted by sortOrder. Uses in-memory cache with TTL.
 */
export async function loadCatalog({ forceRefresh = false } = {}) {
	const now = Date.now();
	if (!forceRefresh && cache && (now - cacheTimestamp) < CACHE_TTL_MS) {
		return cache;
	}

	try {
		const page = await pb.collection('model_catalog').getList(1, 200, {
			sort: 'sortOrder',
		});

		const variants = page.items.map(recordToVariant);
		cache = variants;
		cacheTimestamp = now;
		logger.info(`Model catalog loaded from DB: ${variants.length} models`);
		return variants;
	} catch (err) {
		logger.error('Failed to load model catalog from DB:', err.message);

		// Fallback to hardcoded catalog if DB fails
		if (cache) {
			logger.warn('Using cached model catalog as fallback');
			return cache;
		}

		// Import hardcoded fallback
		try {
			const { MODEL_VARIANTS } = await import('../constants/models.js');
			logger.warn(`Using hardcoded model catalog fallback: ${MODEL_VARIANTS.length} models`);
			return MODEL_VARIANTS;
		} catch (importErr) {
			logger.error('Failed to load hardcoded fallback catalog:', importErr.message);
			return [];
		}
	}
}

/**
 * Get all enabled + routed models (what the frontend picker uses).
 */
export async function getEnabledModels() {
	const catalog = await loadCatalog();
	return catalog.filter(m => m.enabled && m.routed);
}

/**
 * Get ALL models (admin view).
 */
export async function getAllModels() {
	return loadCatalog();
}

/**
 * Get a single variant by key.
 */
export async function getVariantByKey(key) {
	const catalog = await loadCatalog();
	return catalog.find(m => m.key === key) || null;
}

/**
 * Expand a variant's duration spec into a discrete list.
 */
export function variantDurations(variant) {
	if (Array.isArray(variant.durations) && variant.durations.length) {
		return variant.durations;
	}
	if (Number.isFinite(variant.minDuration) && Number.isFinite(variant.maxDuration)) {
		const out = [];
		for (let s = variant.minDuration; s <= variant.maxDuration; s++) out.push(s);
		return out;
	}
	if (Number.isFinite(variant.maxDuration)) return [variant.maxDuration];
	return [];
}

/**
 * Resolution keys a variant supports.
 */
export function variantResolutions(variant) {
	const map = variant.billing === 'per_second' ? variant.creditsPerSecond : variant.credits;
	return Object.keys(map || {});
}

/**
 * Invalidate the cache (call after admin edits).
 */
export function invalidateCache() {
	cache = null;
	cacheTimestamp = 0;
}

/**
 * Validate the DB catalog — same rules as validateCatalog but for DB records.
 * Returns { valid: true } or throws on first error.
 */
export async function validateDbCatalog() {
	const catalog = await loadCatalog();
	const seenKeys = new Set();

	for (const v of catalog) {
		const where = `model "${v.key || v.id || '?'}"`;

		if (!v.key) throw new Error(`DB Catalog: a variant is missing "key"`);
		if (seenKeys.has(v.key)) throw new Error(`DB Catalog: duplicate key "${v.key}"`);
		seenKeys.add(v.key);

		if (!v.id) throw new Error(`DB Catalog: ${where} is missing vendor "id"`);
		if (!['per_video', 'per_second', 'per_image'].includes(v.billing)) {
			throw new Error(`DB Catalog: ${where} has invalid billing "${v.billing}"`);
		}

		const map = v.billing === 'per_second' ? v.creditsPerSecond : v.credits;
		if (!map || typeof map !== 'object' || Object.keys(map).length === 0) {
			const field = v.billing === 'per_second' ? 'creditsPerSecond' : 'credits';
			throw new Error(`DB Catalog: ${where} (${v.billing}) is missing a non-empty "${field}" map`);
		}
		for (const [resKey, rate] of Object.entries(map)) {
			if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
				throw new Error(`DB Catalog: ${where} has invalid rate for "${resKey}": ${rate}`);
			}
		}

		if (v.billing === 'per_second') {
			const hasList = Array.isArray(v.durations) && v.durations.length > 0;
			const hasRange = Number.isFinite(v.minDuration) && Number.isFinite(v.maxDuration);
			if (!hasList && !hasRange) {
				throw new Error(`DB Catalog: per_second ${where} needs "durations" or min/maxDuration`);
			}
			if (hasRange && v.minDuration > v.maxDuration) {
				throw new Error(`DB Catalog: ${where} has minDuration > maxDuration`);
			}
		}

		if (v.enabled && !v.routed) {
			// Warn but don't crash — admin might be preparing a model
			logger.warn(`DB Catalog: ${where} is enabled but not routed — generation will fail for this model`);
		}
	}

	return { valid: true, count: catalog.length };
}
