/**
 * Single source of truth for the model catalog AND its pricing.
 *
 * Pricing model: catalog-driven, unit-aware. Catalog credits are denominated
 * in OUR internal "display credits", which are deliberately DECOUPLED from the
 * vendor's raw credit cost so the UI never reveals supplier pricing.
 *
 *   display credits == what the user is charged == vendor credits * K
 *
 * where K = CREDIT_DISPLAY_MULTIPLIER (currently 5). The rupee markup lives in
 * the wallet layer (credit packs), and K only changes the numbers shown to
 * users - it does NOT affect margin (pack ₹ prices are set independently).
 *
 * IMPORTANT: vendor calls (apps/api/src/api/geminigen.js) never send our credit
 * numbers, so scaling the catalog is safe - it only affects what we charge the
 * user and display in the picker.
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
 *
 * All credit values below already include the K=5 display multiplier (e.g. a
 * model that costs the vendor 3 credits is listed as 15).
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
		credits: { '480p': 25, '720p': 25 },
		// GeminiGen hard-caps the Grok endpoint at 10s per clip.
		// 15s is listed in xAI's docs but returns INVALID_VIDEO_LENGTH on
		// GeminiGen — tested 2026-06-15. Keeping it here as a disabled
		// placeholder so it can be re-enabled without code changes once
		// GeminiGen supports it. Set enabled: false on this entry or remove
		// 15 from durations to keep it hidden from users.
		durations: [6, 10],
		maxDuration: 10,
		// durations: [6, 10, 15],   // ← restore when GeminiGen raises the cap
		// maxDuration: 15,
		aspectRatios: ['16:9', '9:16'],
		imageModes: [],
		maxRefImages: 0,
		routed: true,
		enabled: true,
	},
	{
		key: 'veo-3.1-fast',
		id: 'veo-3.1-fast',
		label: 'Veo 3.1 Fast',
		provider: 'Google',
		type: 'video',
		billing: 'per_video',
		// Both resolutions on ONE picker entry so users can choose quality.
		// Same price either way (matches vendor pass-through).
		// 4K is 2x the cost of 1080p
		credits: { '720p': 15, '1080p': 15, '4k': 30 },
		durations: [8],
		maxDuration: 8,
		aspectRatios: ['16:9', '9:16'],
		// imageModes: 'frame' = start/end keyframes (1 or 2 images, order matters)
		//             'ingredient' = subject/style references (1-3 images)
		//             'interpolation' = exactly 2 frames; API interpolates between them
		//             (interpolation maps to mode_image='frame' with exactly 2 refs)
		imageModes: ['frame', 'ingredient', 'interpolation'],
		maxRefImages: 3,
		routed: true,
		enabled: true,
	},
	{
		key: 'veo-3.1-lite',
		id: 'veo-3.1-lite',
		label: 'Veo 3.1 Lite',
		provider: 'Google',
		type: 'video',
		billing: 'per_video',
		credits: { '720p': 15, '1080p': 15, '4k': 30 },
		durations: [8],
		maxDuration: 8,
		aspectRatios: ['16:9', '9:16'],
		imageModes: ['frame', 'ingredient', 'interpolation'],
		maxRefImages: 3,
		// The ONLY model free users can generate with (both 720p & 1080p).
		// All other models require a credit purchase.
		freeAccess: true,
		routed: true,
		enabled: true,
	},
	/* TEMPORARILY HIDDEN: Veo 2 is an older model priced higher than the newer
	 * Veo 3.1 Fast/Lite, which confuses buyers. Commented out of the picker for
	 * now; re-enable later if we want to offer it. Display cost was 100 credits
	 * (K=5; vendor cost 20). Kept here so pricing/routing context isn't lost.
	{
		key: 'veo-2',
		id: 'veo-2',
		label: 'Veo 2',
		provider: 'Google',
		type: 'video',
		billing: 'per_video',
		credits: { '720p': 100 },
		durations: [8],
		maxDuration: 8,
		aspectRatios: ['16:9', '9:16'],
		imageModes: ['frame', 'ingredient'],
		maxRefImages: 3,
		routed: true,
		enabled: true,
	},
	*/
	{
		key: 'veo-3.1',
		id: 'veo-3.1',
		label: 'Veo 3.1',
		provider: 'Google',
		type: 'video',
		billing: 'per_video',
		// 4K is 2x the cost of 1080p
		credits: { '720p': 500, '1080p': 500, '4k': 1000 },
		durations: [8],
		maxDuration: 8,
		aspectRatios: ['16:9', '9:16'],
		imageModes: ['frame', 'ingredient', 'interpolation'],
		maxRefImages: 3,
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
		creditsPerSecond: { '720p': 15 },
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
		creditsPerSecond: { '720p': 30, '1080p': 40 },
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
		creditsPerSecond: { '720p': 30, '1080p': 50 },
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
		creditsPerSecond: { '1080p': 70 },
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
		creditsPerSecond: { '720p': 30, '1080p': 60 },
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
		creditsPerSecond: { '720p': 35, '1080p': 60 },
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
		creditsPerSecond: { '720p': 50, '1080p': 60 },
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
		creditsPerSecond: { '720p': 60, '1080p': 75 },
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
		creditsPerSecond: { '720p': 50, '1080p': 60 },
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
		creditsPerSecond: { '720p': 50, '1080p': 80 },
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
		creditsPerSecond: { '720p': 30, '1080p': 45 },
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
		creditsPerSecond: { '720p': 30, '1080p': 30 },
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
		creditsPerSecond: { '480p': 60, '720p': 95 },
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
		creditsPerSecond: { '480p': 80, '720p': 135 },
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
		creditsPerSecond: { '720p': 95 },
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
		creditsPerSecond: { '720p': 135 },
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
		creditsPerSecond: { '720p': 135 },
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
		creditsPerSecond: { '720p': 175 },
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

/**
 * For a given variant and duration, return how many real API clips are needed.
 * Returns 1 for normal durations, >1 for chained durations (e.g. Grok 20s = 2 clips).
 */
export function chainedClipCount(variant, duration) {
	if (!variant?.chainedDurations) return 1;
	return variant.chainedDurations[duration] ?? 1;
}

/**
 * For a chained duration, return the per-clip duration to send to the vendor.
 * Currently all chained durations use 10s clips.
 */
export function chainedClipDuration(variant, duration) {
	const count = chainedClipCount(variant, duration);
	if (count <= 1) return duration;
	return Math.round(duration / count); // e.g. 20 / 2 = 10
}
