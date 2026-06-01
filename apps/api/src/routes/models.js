import { Router } from 'express';
import { getEnabledModels, variantDurations, variantResolutions } from '../constants/models.js';
import { variantPricingDisplay } from '../utils/creditCalculator.js';

const router = Router();

// GET /models - public list of enabled models for the workspace picker.
// Public so the frontend can render the picker before auth completes.
//
// The frontend uses `billing` + the pricing fields to render the price AND a
// live estimate, computing per_second cost with the SAME ceil(rate*duration)
// formula the server charges with - so display and charge never diverge.
router.get('/', (_req, res) => {
	const models = getEnabledModels().map((m) => ({
		key: m.key,
		id: m.id,
		label: m.label,
		provider: m.provider,
		type: m.type,
		durations: variantDurations(m),
		resolutions: variantResolutions(m),
		aspectRatios: Array.isArray(m.aspectRatios) ? m.aspectRatios : ['16:9'],
		imageModes: Array.isArray(m.imageModes) ? m.imageModes : [],
		maxRefImages: Number.isFinite(m.maxRefImages) ? m.maxRefImages : 0,
		...variantPricingDisplay(m), // { billing, credits } or { billing, creditsPerSecond }
	}));
	res.json({ models });
});

export default router;
