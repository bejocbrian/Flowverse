import { Router } from 'express';
import { getEnabledModels } from '../constants/models.js';

const router = Router();

// GET /models - public list of enabled models for the workspace picker.
// Public so the frontend can render the picker before auth completes.
router.get('/', (_req, res) => {
	const models = getEnabledModels().map((m) => ({
		key: m.key,
		id: m.id,
		label: m.label,
		provider: m.provider,
		type: m.type,
		durations: m.durations,
		resolutions: m.resolutions,
		credits: m.credits,
	}));
	res.json({ models });
});

export default router;
