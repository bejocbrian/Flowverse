import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { adminRoleCheck } from '../middleware/admin-role-check.js';
import rateLimit from 'express-rate-limit';
import { invalidatePaymentMethodsCache } from '../utils/paymentMethods.js';
import { invalidateAbuseSettingsCache } from '../utils/abuseSettings.js';

const router = Router();

const adminRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 50,
	message: { error: 'Too many admin requests, please try again later' },
	validate: { trustProxy: false },
});

router.use(adminRateLimit);
router.use(adminRoleCheck);

/**
 * Settings are stored as PocketBase JSON values. Some legacy/seed records
 * were written as a string of pseudo-JSON like `{'text': 'AI Video Studio'}`
 * (single quotes, not valid JSON). When we read those back we attempt to
 * normalize them so the admin UI sees a clean primitive instead of a
 * stringified blob.
 */
function unwrapValue(value) {
	if (value && typeof value === 'object') {
		// Common shapes: { text: '...' }, { number: 8 }, { value: ... }
		if ('text' in value) return value.text;
		if ('number' in value) return value.number;
		if ('value' in value) return value.value;
		return value;
	}

	if (typeof value !== 'string') return value;

	// Try strict JSON first.
	try {
		return unwrapValue(JSON.parse(value));
	} catch {
		/* not strict JSON, try the legacy single-quoted form */
	}

	// Convert single-quoted pseudo-JSON to real JSON only when it clearly
	// matches that pattern, to avoid breaking legitimate strings that
	// contain apostrophes.
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('{') && trimmed.endsWith('}')) ||
		(trimmed.startsWith('[') && trimmed.endsWith(']'))
	) {
		try {
			const repaired = trimmed.replace(/'/g, '"');
			return unwrapValue(JSON.parse(repaired));
		} catch {
			/* give up and return the raw string */
		}
	}

	return value;
}

// GET /admin/settings
router.get('/', async (_req, res) => {
	try {
		const settings = await pb.collection('settings').getFullList();
		const settingsObj = {};
		for (const s of settings) {
			settingsObj[s.key] = unwrapValue(s.value);
		}
		logger.info('Fetched all settings');
		res.json(settingsObj);
	} catch (error) {
		logger.error('Fetch settings error:', error.message);
		throw error;
	}
});

// POST /admin/settings - Bulk upsert
router.post('/', async (req, res) => {
	const { settings } = req.body || {};

	if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
		return res.status(400).json({ error: 'settings object is required' });
	}

	try {
		const updated = {};

		for (const [key, value] of Object.entries(settings)) {
			// Always persist values directly. PocketBase JSON fields handle
			// objects, arrays, numbers, strings, and booleans natively.
			try {
				const existing = await pb
					.collection('settings')
					.getFirstListItem(`key = "${key.replace(/"/g, '\\"')}"`);
				const row = await pb.collection('settings').update(existing.id, { value });
				updated[key] = unwrapValue(row.value);
			} catch (err) {
				if (err?.status === 404 || err.message.includes('not found')) {
					const created = await pb.collection('settings').create({ key, value });
					updated[key] = unwrapValue(created.value);
				} else {
					throw err;
				}
			}
		}

		logger.info('Settings updated');
		invalidatePaymentMethodsCache();
		invalidateAbuseSettingsCache();
		res.json(updated);
	} catch (error) {
		logger.error('Update settings error:', error.message);
		throw error;
	}
});

export default router;
