/**
 * Credit Cost Calculator — THE single source of truth for what a generation
 * costs. Both the charge (routes/videos.js, video-regenerate.js) and the
 * displayed price (routes/models.js) call into this module, so display and
 * charge can never diverge.
 *
 * Pricing is catalog-driven and unit-aware. The catalog is now read from
 * PocketBase `model_catalog` collection via modelCatalog.js, with a hardcoded
 * fallback if the DB is unavailable.
 *
 *   per_video  -> credits[resolution]                       (duration ignored)
 *   per_second -> ceil(creditsPerSecond[resolution] * duration)
 *   per_image  -> credits[resolution]
 *
 * 1:1 vendor pass-through: catalog credits == user charge == vendor credits.
 * The rupee markup lives in the wallet layer, not here.
 */

import { loadCatalog, getVariantByKey as dbGetVariantByKey, variantResolutions as dbVariantResolutions } from './modelCatalog.js';
import { chainedClipCount } from '../constants/models.js';

export const DEFAULT_DURATION = 8;

/**
 * Resolve the price map for a variant given its billing unit.
 */
function priceMapFor(variant) {
	return variant.billing === 'per_second' ? variant.creditsPerSecond : variant.credits;
}

/**
 * Compute the credit cost for a generation.
 *
 * @param {Object} params
 * @param {string} [params.modelKey]   - Catalog variant key (preferred). The
 *                                       picker sends this; it uniquely selects
 *                                       a (model, resolution-set) variant.
 * @param {string} [params.resolution] - Resolution key (e.g. '720p'). For
 *                                       'default'-only variants this is optional.
 * @param {number} [params.duration]   - Duration in seconds (per_second only).
 * @returns {number} integer credit cost (>= 0)
 * @throws if the variant/resolution is unknown or mispriced (fail-closed:
 *         we never silently charge 0).
 */
export async function creditCost({ modelKey, resolution, duration }) {
	const variant = await dbGetVariantByKey(modelKey);
	if (!variant) {
		throw new Error(`creditCost: unknown model key "${modelKey}"`);
	}

	const map = priceMapFor(variant);
	const resKeys = Object.keys(map || {});

	// Pick the resolution: explicit > 'default' > sole key.
	let res = resolution;
	if (!res || !(res in map)) {
		if ('default' in map) res = 'default';
		else if (resKeys.length === 1) res = resKeys[0];
	}
	if (!res || !(res in map)) {
		throw new Error(
			`creditCost: model "${modelKey}" has no price for resolution "${resolution}" (supported: ${resKeys.join(', ')})`,
		);
	}

	const rate = map[res];
	if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) {
		throw new Error(`creditCost: invalid rate for "${modelKey}"@"${res}": ${rate}`);
	}

	if (variant.billing === 'per_second') {
		const secs = Number(duration);
		if (!Number.isFinite(secs) || secs <= 0) {
			throw new Error(`creditCost: per_second model "${modelKey}" requires a positive duration`);
		}
		return Math.ceil(rate * secs);
	}

	// per_video / per_image -> flat rate, but multiply by clip count for
	// chained durations (e.g. Grok 20s = 2 clips = 2× the per-clip price).
	const clips = chainedClipCount(variant, Number(duration));
	return Math.ceil(rate) * clips;
}

/**
 * Build the display payload for one variant that the frontend uses to render
 * the picker AND to show a live estimate. The frontend computes its estimate
 * with the SAME formula (ceil(rate*duration)) so it always matches the charge.
 */
export function variantPricingDisplay(variant) {
	if (variant.billing === 'per_second') {
		return {
			billing: 'per_second',
			creditsPerSecond: { ...variant.creditsPerSecond },
		};
	}
	return {
		billing: variant.billing, // 'per_video' | 'per_image'
		credits: { ...variant.credits },
	};
}

/**
 * Fail-fast catalog validation. Called once at startup.
 * Validates the DB catalog, falls back to hardcoded if DB fails.
 * Throws on the first misconfigured variant so a bad price can never
 * reach production silently.
 */
export async function validateCatalog() {
	try {
		const catalog = await loadCatalog();
		const seenKeys = new Set();

		for (const v of catalog) {
			const where = `model "${v.key || v.id || '?'}"`;

			if (!v.key) throw new Error(`Catalog: a variant is missing "key"`);
			if (seenKeys.has(v.key)) throw new Error(`Catalog: duplicate key "${v.key}"`);
			seenKeys.add(v.key);

			if (!v.id) throw new Error(`Catalog: ${where} is missing vendor "id"`);
			if (!['per_video', 'per_second', 'per_image'].includes(v.billing)) {
				throw new Error(`Catalog: ${where} has invalid billing "${v.billing}"`);
			}

			const map = priceMapFor(v);
			if (!map || typeof map !== 'object' || Object.keys(map).length === 0) {
				const field = v.billing === 'per_second' ? 'creditsPerSecond' : 'credits';
				throw new Error(`Catalog: ${where} (${v.billing}) is missing a non-empty "${field}" map`);
			}
			for (const [resKey, rate] of Object.entries(map)) {
				if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
					throw new Error(`Catalog: ${where} has invalid rate for "${resKey}": ${rate}`);
				}
			}

			// Duration sanity for per_second models.
			if (v.billing === 'per_second') {
				const hasList = Array.isArray(v.durations) && v.durations.length > 0;
				const hasRange = Number.isFinite(v.minDuration) && Number.isFinite(v.maxDuration);
				if (!hasList && !hasRange) {
					throw new Error(`Catalog: per_second ${where} needs "durations" or min/maxDuration`);
				}
				if (hasRange && v.minDuration > v.maxDuration) {
					throw new Error(`Catalog: ${where} has minDuration > maxDuration`);
				}
			}

			if (v.enabled && !v.routed) {
				// Warn but don't crash — admin might be preparing a model
				console.warn(`Catalog: ${where} is enabled but not routed — generation will fail for this model`);
			}
		}

		return true;
	} catch (err) {
		// If DB validation fails, try hardcoded fallback
		console.error('DB catalog validation failed, trying hardcoded fallback:', err.message);
		try {
			const { MODEL_VARIANTS } = await import('../constants/models.js');
			const seenKeys = new Set();

			for (const v of MODEL_VARIANTS) {
				const where = `model "${v.key || v.id || '?'}"`;

				if (!v.key) throw new Error(`Catalog: a variant is missing "key"`);
				if (seenKeys.has(v.key)) throw new Error(`Catalog: duplicate key "${v.key}"`);
				seenKeys.add(v.key);

				if (!v.id) throw new Error(`Catalog: ${where} is missing vendor "id"`);
				if (!['per_video', 'per_second', 'per_image'].includes(v.billing)) {
					throw new Error(`Catalog: ${where} has invalid billing "${v.billing}"`);
				}

				const map = priceMapFor(v);
				if (!map || typeof map !== 'object' || Object.keys(map).length === 0) {
					const field = v.billing === 'per_second' ? 'creditsPerSecond' : 'credits';
					throw new Error(`Catalog: ${where} (${v.billing}) is missing a non-empty "${field}" map`);
				}
				for (const [resKey, rate] of Object.entries(map)) {
					if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
						throw new Error(`Catalog: ${where} has invalid rate for "${resKey}": ${rate}`);
					}
				}

				if (v.billing === 'per_second') {
					const hasList = Array.isArray(v.durations) && v.durations.length > 0;
					const hasRange = Number.isFinite(v.minDuration) && Number.isFinite(v.maxDuration);
					if (!hasList && !hasRange) {
						throw new Error(`Catalog: per_second ${where} needs "durations" or min/maxDuration`);
					}
					if (hasRange && v.minDuration > v.maxDuration) {
						throw new Error(`Catalog: ${where} has minDuration > maxDuration`);
					}
				}

				if (v.enabled && !v.routed) {
					console.warn(`Catalog: ${where} is enabled but not routed — generation will fail for this model`);
				}
			}

			return true;
		} catch (fallbackErr) {
			throw new Error(`Both DB and hardcoded catalog validation failed. DB: ${err.message}; Fallback: ${fallbackErr.message}`);
		}
	}
}

// Re-export so callers can resolve a variant's resolution set consistently.
export { dbVariantResolutions as variantResolutions };

// Re-export chain helpers so route handlers and workers can detect and route
// chained durations without importing directly from constants/models.js.
export { chainedClipCount } from '../constants/models.js';
export { chainedClipDuration } from '../constants/models.js';

/**
 * The lowest per-video credit cost among enabled, routed video models. Used by
 * the wallet to show "≈ N videos" for each credit pack so buyers understand
 * what a pack gets them. We use the CHEAPEST model so the figure is an
 * optimistic-but-honest "up to N videos" (cheaper model => more videos).
 *
 * Returns a positive integer, or null if no per_video model is enabled.
 */
export async function cheapestVideoCost() {
	const catalog = await loadCatalog();
	let min = Infinity;
	for (const v of catalog) {
		if (!v.enabled || v.type !== 'video' || v.billing !== 'per_video') continue;
		for (const rate of Object.values(v.credits || {})) {
			if (typeof rate === 'number' && rate > 0 && rate < min) min = rate;
		}
	}
	return Number.isFinite(min) ? min : null;
}
