/**
 * Credit Cost Calculator — THE single source of truth for what a generation
 * costs. Both the charge (routes/videos.js, video-regenerate.js) and the
 * displayed price (routes/models.js) call into this module, so display and
 * charge can never diverge.
 *
 * Pricing is catalog-driven and unit-aware (see constants/models.js):
 *   per_video  -> credits[resolution]                       (duration ignored)
 *   per_second -> ceil(creditsPerSecond[resolution] * duration)
 *   per_image  -> credits[resolution]
 *
 * 1:1 vendor pass-through: catalog credits == user charge == vendor credits.
 * The rupee markup lives in the wallet layer, not here.
 */

import { MODEL_VARIANTS, getVariantByKey, variantResolutions } from '../constants/models.js';

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
export function creditCost({ modelKey, resolution, duration }) {
	const variant = getVariantByKey(modelKey);
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

	// per_video / per_image -> flat
	return Math.ceil(rate);
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
 * Fail-fast catalog validation. Called once at startup. Throws on the first
 * misconfigured variant so a bad price can never reach production silently.
 */
export function validateCatalog() {
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

		// An enabled model must be routed to the vendor, else users get
		// charged then fail. Enforced so we can't ship a sellable-but-broken model.
		if (v.enabled && !v.routed) {
			throw new Error(`Catalog: ${where} is enabled but not routed to the vendor`);
		}
	}

	return true;
}

// Re-export so callers can resolve a variant's resolution set consistently.
export { variantResolutions };
