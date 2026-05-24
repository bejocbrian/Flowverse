import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

const router = Router();

// Default feature flags - used when not set in database
const DEFAULT_FEATURE_FLAGS = {
	show_duration_selector: false,
	default_duration: 8,
	available_durations: [4, 6, 8],
	allow_multi_generation: false,
	max_generations_per_request: 1,
};

// Default settings - used when not set in database
const DEFAULT_SETTINGS = {
	feature_flags: DEFAULT_FEATURE_FLAGS,
	default_duration: { number: 8 },
	default_aspect_ratio: { text: '16:9' },
	default_quality: { text: 'Standard' },
};

/**
 * Parse a setting value, handling both string and object formats
 */
function parseSettingValue(value) {
	if (typeof value === 'string') {
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}
	return value;
}

/**
 * GET /settings/public
 * Returns public settings that the frontend needs (feature flags, defaults, etc.)
 * This endpoint is publicly accessible (no auth required)
 */
router.get('/public', async (req, res) => {
	try {
		// Fetch all settings from database
		const settings = await pb.collection('settings').getFullList();
		
		const publicSettings = {};
		
		// Process each setting
		settings.forEach(setting => {
			publicSettings[setting.key] = parseSettingValue(setting.value);
		});

		// Apply defaults for missing settings
		const response = {
			feature_flags: {
				...DEFAULT_FEATURE_FLAGS,
				...(publicSettings.feature_flags || {}),
			},
			default_duration: publicSettings.default_duration || DEFAULT_SETTINGS.default_duration,
			default_aspect_ratio: publicSettings.default_aspect_ratio || DEFAULT_SETTINGS.default_aspect_ratio,
			default_quality: publicSettings.default_quality || DEFAULT_SETTINGS.default_quality,
		};

		res.json(response);
	} catch (error) {
		logger.error('Fetch public settings error:', error.message);
		// Return defaults on error - this ensures the app always works
		res.json(DEFAULT_SETTINGS);
	}
});

export default router;
