/**
 * Credit Cost Calculator
 * 
 * Shared logic for calculating video/image generation costs.
 * Used by both API routes and exposed via endpoint for frontend.
 * 
 * Video Cost Formula:
 *   baseCost = duration × CREDITS_PER_SECOND
 *   finalCost = baseCost × QUALITY_MULTIPLIER[quality]
 * 
 * Image Cost: Fixed based on resolution
 */

// Configuration constants
export const CREDITS_PER_SECOND = 2;

export const QUALITY_MULTIPLIERS = {
	'720p': 1,
	'1080p': 1.5,
	'Fast': 0.8,
	'Standard': 1,
	'High': 1.5,
};

export const IMAGE_COSTS = {
	'720p': 5,      // 1K resolution
	'1080p': 10,    // 2K resolution
	'Fast': 3,
	'Standard': 5,
	'High': 10,
};

// Model-specific base costs (for frontend display)
export const MODEL_BASE_COSTS = {
	// Veo 3.1 Fast
	'veo-3.1-fast': { base: 8, per720p: 8, per1080p: 12 },
	// Veo 3.1 Lite
	'veo-3.1-lite': { base: 6, per720p: 6, per1080p: 10 },
	// Veo 3.1
	'veo-3.1': { base: 10, per720p: 10, per1080p: 15 },
	// Veo 2
	'veo-2': { base: 8, per720p: 8, per1080p: 12 },
	// Grok 3
	'grok-3': { base: 8, per720p: 8, per1080p: 12 },
};

// Default duration when not specified
export const DEFAULT_DURATION = 8;

/**
 * Calculate credit cost for video or image generation
 * 
 * @param {Object} params
 * @param {string} params.quality - Quality tier: '720p', '1080p', 'Fast', 'Standard', 'High'
 * @param {number} params.duration - Duration in seconds (ignored for images)
 * @param {boolean} params.isImage - Whether this is an image generation
 * @param {string} params.model - Model ID (optional, for model-specific pricing)
 * @returns {number} Credit cost
 */
export function calculateCreditCost({ quality, duration, isImage = false, model = null }) {
	// Handle image generation
	if (isImage) {
		return IMAGE_COSTS[quality] || IMAGE_COSTS['Standard'];
	}

	// Use default duration if not specified
	const effectiveDuration = duration || DEFAULT_DURATION;

	// Normalize quality to resolution-based
	let normalizedQuality = quality;
	if (quality === 'Fast') normalizedQuality = '720p';
	if (quality === 'Standard') normalizedQuality = '720p';
	if (quality === 'High') normalizedQuality = '1080p';

	// Calculate cost
	const multiplier = QUALITY_MULTIPLIERS[normalizedQuality] || QUALITY_MULTIPLIERS['720p'];
	const durationCost = effectiveDuration * CREDITS_PER_SECOND;
	
	return Math.ceil(durationCost * multiplier);
}

/**
 * Get credit cost for a specific model and resolution
 * Useful for frontend to display accurate costs per model
 * 
 * @param {string} model - Model ID
 * @param {string} resolution - '720p' or '1080p'
 * @returns {number} Credit cost
 */
export function getModelCreditCost(model, resolution = '720p') {
	if (MODEL_BASE_COSTS[model]) {
		return resolution === '1080p' 
			? MODEL_BASE_COSTS[model].per1080p 
			: MODEL_BASE_COSTS[model].per720p;
	}
	
	// Fallback to calculation
	return calculateCreditCost({ quality: resolution, duration: DEFAULT_DURATION });
}

/**
 * Get all model costs for frontend display
 * 
 * @returns {Object} Map of model ID to cost info
 */
export function getAllModelCosts() {
	const costs = {};
	
	for (const [modelId, pricing] of Object.entries(MODEL_BASE_COSTS)) {
		costs[modelId] = {
			'720p': pricing.per720p,
			'1080p': pricing.per1080p,
		};
	}
	
	return costs;
}
