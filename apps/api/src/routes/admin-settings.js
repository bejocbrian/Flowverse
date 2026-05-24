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

// GET /admin/settings - Get all settings
router.get('/', async (req, res) => {
	try {
		const settings = await pb.collection('settings').getFullList();

		const settingsObj = {};
		settings.forEach(setting => {
			settingsObj[setting.key] = setting.value;
		});

		logger.info('Fetched all settings');
		res.json(settingsObj);
	} catch (error) {
		logger.error('Fetch settings error:', error.message);
		throw error;
	}
});

// POST /admin/settings - Update multiple settings
router.post('/', async (req, res) => {
	const { settings } = req.body;

	if (!settings || typeof settings !== 'object') {
		return res.status(400).json({ error: 'settings object is required' });
	}

	try {
		const updatedSettings = {};

		for (const [key, value] of Object.entries(settings)) {
			try {
				// Try to update existing setting
				const existing = await pb.collection('settings').getFirstListItem(`key = "${key}"`);
				const updated = await pb.collection('settings').update(existing.id, { value });
				updatedSettings[key] = updated.value;
			} catch (error) {
				// Create new setting if it doesn't exist
				const created = await pb.collection('settings').create({ key, value });
				updatedSettings[key] = created.value;
			}
		}

		logger.info('Settings updated');
		res.json(updatedSettings);
	} catch (error) {
		logger.error('Update settings error:', error.message);
		throw error;
	}
});

export default router;
