/**
 * Single source of truth for the model catalog AND its pricing.
 *
 * Pricing model: catalog-driven, unit-aware, 1:1 vendor pass-through.
 *   - catalog credits == what the user is charged == the vendor's credit cost
 *   - the rupee markup lives in the wallet layer (1 credit = ₹1.50 to the
 *     user; our vendor cost is ₹0.556), NOT here.
 *
 * Each variant declares its billing unit:
 *   billing: 'per_video'  -> flat charge, duration ignored.
 *                            price = credits[resolution]
 *   billing: 'per_second' -> charge scales with duration.
 *                            price = ceil(creditsPerSecond[resolution] * duration)
 *   billing: 'per_image'  -> flat charge for an image.
 *                            price = credits[resolution]
 *
 * Resolution keys are arbitrary strings ('default', '480p', '720p', '1080p').
 * 'default' means the model exposes no resolution choice.
 *
 * Duration is expressed either as a discrete list (`durations: [5, 10]`) or a
 * range (`minDuration` / `maxDuration`). per_video models may use `maxDuration`
 * purely as an upper bound for the (ignored-for-pricing) duration the vendor
 * accepts.
 *
 * `routed: true` means apps/api/src/api/geminigen.js knows how to submit this
 * model to the vendor. Models without routing are kept disabled so they can be
 * priced/reviewed but never charged-then-failed.
 *
 * The catalog is validated at startup (see validateCatalog); a misconfigured
 * entry (per_video without credits, per_second without creditsPerSecond, etc.)
 * crashes the server fast rather than silently charging 0.
 */

export const MODEL_VARIANTS = [
	/* ------------------------------------------------------------------ */
	/*  PER-VIDEO (flat, duration ignored) — Veo & Grok                    */
	/*  These have vendor routing in geminigen.js -> enabled.              */
	/* ------------------------------------------------------------------ */
	{
		key: 'grok-3',
		id: 'grok-3',
		label: 'Grok 3',
		provider: 'xAI',
		type: 'video',
		billing: 'per_video',
		credits: { default: 4 },
		maxDuration: 8,
		durations: [4, 6, 8],
		routed: true,
		enabled: true,
	},
	{
		key: 'veo-3.1-fast-hd',
		id: 'veo-3.1-fast',
		label: 'Veo 3.1 Fast HD',
		provider: 'Google',
		type: 'video',
		billing: 'per_video',
		credits: { '720p': 3 },
		maxDuration: 8,
		durations: [4, 6, 8],
		routed: true,
		enabled: true,
	},
	{
		key: 'veo-3.1-fast-fhd',
		id: 'veo-3.1-fast',
		label: 'Veo 3.1 Fast Full HD',
		provider: 'Google',
		type: 'video',
		billing: 'per_video',
		credits: { '1080p': 3 },
		maxDuration: 8,
		durations: [4, 6, 8],
		routed: true,
		enabled: true,
	},
	{
		key: 'veo-3.1-lite-hd',
		id: 'veo-3.1-lite',
		label: 'Veo 3.1 Lite HD',
		provider: 'Google',
		type: 'video',
		billing: 'per_video',
		credits: { '720p': 3 },
		maxDuration: 8,
		durations: [4, 6, 8],
		routed: true,
		enabled: true,
	},
	{
		key: 'veo-3.1-lite-fhd',
		id: 'veo-3.1-lite',
		label: 'Veo 3.1 Lite Full HD',
		provider: 'Google',
		type: 'video',
		billing: 'per_video',
		credits: { '1080p': 3 },
		maxDuration: 8,
		durations: [4, 6, 8],
		routed: true,
		enabled: true,
	},
	{
		key: 'veo-2',
		id: 'veo-2',
		label: 'Veo 2',
		provider: 'Google',
		type: 'video',
		billing: 'per_video',
		credits: { '720p': 20, '1080p': 20 },
		maxDuration: 8,
		durations: [4, 6, 8],
		routed: true,
		enabled: true,
	},
	{
		key: 'veo-3.1-hd',
		id: 'veo-3.1',
		label: 'Veo 3.1',
		provider: 'Google',
		type: 'video',
		billing: 'per_video',
		credits: { '720p': 100, '1080p': 100 },
		maxDuration: 8,
		durations: [4, 6, 8],
		routed: true,
		enabled: true,
	},

	/* ------------------------------------------------------------------ */
	/*  PER-SECOND (ceil(rate * duration)) — Kling & Seedance              */
	/*  NO vendor routing yet (geminigen.js) -> disabled until added.      */
	/* ------------------------------------------------------------------ */
	{
		key: 'kling-2.5-relax',
		id: 'kling-2.5-relax',
		label: 'Kling 2.5 Relax',
		provider: 'Kling',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 3 },
		durations: [5, 10],
		routed: false,
		enabled: false,
	},
	{
		key: 'kling-2.5',
		id: 'kling-2.5',
		label: 'Kling 2.5',
		provider: 'Kling',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 6, '1080p': 8 },
		durations: [5, 10],
		routed: false,
		enabled: false,
	},
	{
		key: 'kling-2.6',
		id: 'kling-2.6',
		label: 'Kling 2.6',
		provider: 'Kling',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 6, '1080p': 10 },
		durations: [5, 10],
		routed: false,
		enabled: false,
	},
	{
		key: 'kling-2.6-audio',
		id: 'kling-2.6-audio',
		label: 'Kling 2.6 Audio',
		provider: 'Kling',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '1080p': 14 },
		durations: [5, 10],
		routed: false,
		enabled: false,
	},
	{
		key: 'kling-2.1-10s',
		id: 'kling-2.1',
		label: 'Kling 2.1 (10s)',
		provider: 'Kling',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 6, '1080p': 12 },
		durations: [10],
		routed: false,
		enabled: false,
	},
	{
		key: 'kling-2.1-5s',
		id: 'kling-2.1',
		label: 'Kling 2.1 (5s)',
		provider: 'Kling',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 7, '1080p': 12 },
		durations: [5],
		routed: false,
		enabled: false,
	},
	{
		key: 'kling-3.0',
		id: 'kling-3.0',
		label: 'Kling 3.0',
		provider: 'Kling',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 10, '1080p': 12 },
		minDuration: 3,
		maxDuration: 15,
		routed: false,
		enabled: false,
	},
	{
		key: 'kling-3.0-edit',
		id: 'kling-3.0-edit',
		label: 'Kling 3.0 Edit',
		provider: 'Kling',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 12, '1080p': 15 },
		minDuration: 3,
		maxDuration: 10,
		routed: false,
		enabled: false,
	},
	{
		key: 'kling-o1',
		id: 'kling-o1',
		label: 'Kling O1',
		provider: 'Kling',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 10, '1080p': 12 },
		minDuration: 3,
		maxDuration: 10,
		routed: false,
		enabled: false,
	},
	{
		key: 'kling-3.0-motion',
		id: 'kling-3.0-motion',
		label: 'Kling 3.0 Motion',
		provider: 'Kling',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 10, '1080p': 16 },
		// NOTE: durations assumed (vendor page unreadable); confirm.
		minDuration: 3,
		maxDuration: 15,
		routed: false,
		enabled: false,
	},
	{
		key: 'kling-2.6-motion',
		id: 'kling-2.6-motion',
		label: 'Kling 2.6 Motion',
		provider: 'Kling',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 6, '1080p': 9 },
		// NOTE: durations assumed (vendor page unreadable); confirm.
		durations: [5, 10],
		routed: false,
		enabled: false,
	},
	{
		key: 'kling-lipsync',
		id: 'kling-lipsync',
		label: 'Kling LipSync',
		provider: 'Kling',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 6, '1080p': 6 },
		// NOTE: durations assumed (vendor page unreadable); confirm.
		durations: [5, 10],
		routed: false,
		enabled: false,
	},
	{
		key: 'seedance-2-fast',
		id: 'seedance-2-fast',
		label: 'Seedance 2 Fast',
		provider: 'Seedance',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '480p': 12, '720p': 19 },
		minDuration: 4,
		maxDuration: 15,
		routed: false,
		enabled: false,
	},
	{
		key: 'seedance-2-pro',
		id: 'seedance-2-pro',
		label: 'Seedance 2 Pro',
		provider: 'Seedance',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '480p': 16, '720p': 27 },
		minDuration: 4,
		maxDuration: 15,
		routed: false,
		enabled: false,
	},
	{
		key: 'seedance-omni-fast',
		id: 'seedance-omni-fast',
		label: 'Seedance Omni Fast',
		provider: 'Seedance',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 19 },
		minDuration: 4,
		maxDuration: 15,
		routed: false,
		enabled: false,
	},
	{
		key: 'seedance-omni-pro',
		id: 'seedance-omni-pro',
		label: 'Seedance Omni Pro',
		provider: 'Seedance',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 27 },
		minDuration: 4,
		maxDuration: 15,
		routed: false,
		enabled: false,
	},
	{
		key: 'seedance-omni-fast-vip',
		id: 'seedance-omni-fast-vip',
		label: 'Seedance Omni Fast VIP',
		provider: 'Seedance',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 27 },
		minDuration: 4,
		maxDuration: 15,
		routed: false,
		enabled: false,
	},
	{
		key: 'seedance-omni-pro-vip',
		id: 'seedance-omni-pro-vip',
		label: 'Seedance Omni Pro VIP',
		provider: 'Seedance',
		type: 'video',
		billing: 'per_second',
		creditsPerSecond: { '720p': 35 },
		minDuration: 4,
		maxDuration: 15,
		routed: false,
		enabled: false,
	},
];

/**
 * Expand a variant's duration spec into a discrete list for the picker.
 * Discrete `durations` win; otherwise we list every integer second in the
 * [minDuration, maxDuration] range.
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

/** Resolution keys the variant supports (from its pricing map). */
export function variantResolutions(variant) {
	const map = variant.billing === 'per_second' ? variant.creditsPerSecond : variant.credits;
	return Object.keys(map || {});
}

export function getEnabledModels() {
	return MODEL_VARIANTS.filter((m) => m.enabled);
}

export function getVariantByKey(key) {
	return MODEL_VARIANTS.find((m) => m.key === key) || null;
}
