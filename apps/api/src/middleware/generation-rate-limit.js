/**
 * Per-user generation rate limit for FREE users only.
 *
 * This is distinct from the daily generation cap (`utils/generationLimit.js`):
 *   - The daily cap bounds total *volume* over a rolling 24h window.
 *   - This bounds *burst speed* — how fast generations can be fired.
 *
 * Paid users (anyone with at least one credit purchase) bypass this entirely,
 * so paying customers are never throttled. Free users are keyed by their user
 * id (falling back to IP only if somehow unauthenticated), so the limit is
 * per-account rather than per-IP.
 *
 * The burst allowance (max requests per window) is admin-configurable from the
 * Settings page via `free_generation_rate_max` (see utils/abuseSettings). The
 * window length stays env/default-driven (FREE_GENERATION_RATE_WINDOW_MS,
 * default 60s) because express-rate-limit fixes the window at construction.
 */
import rateLimit from 'express-rate-limit';
import { isPaidUser } from '../utils/userTier.js';
import { getAbuseSettingsSync } from '../utils/abuseSettings.js';
import logger from '../utils/logger.js';

function readInt(envName, fallback) {
	const raw = Number(process.env[envName]);
	return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

const WINDOW_MS = readInt('FREE_GENERATION_RATE_WINDOW_MS', 60 * 1000);

// Underlying limiter. Only ever invoked for free users (see wrapper below),
// keyed per-user so one account can't be throttled by another's activity.
// `max` is resolved per-request from the admin-configurable settings; it always
// returns a safe positive integer (falls back to env/default on any error).
const limiter = rateLimit({
	windowMs: WINDOW_MS,
	max: () => {
		try {
			return getAbuseSettingsSync().freeRateMax;
		} catch {
			return readInt('FREE_GENERATION_RATE_MAX', 5);
		}
	},
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => req.pocketbaseUserId || req.ip,
	message: {
		error: 'You are generating too quickly. Please wait a moment before trying again, or purchase credits for higher limits.',
		code: 'RATE_LIMITED',
	},
	validate: { trustProxy: false, keyGeneratorIpFallback: false },
});

/**
 * Express middleware: applies the free-tier generation rate limit, but lets
 * paid users straight through. Fail-open — if the tier lookup errors we apply
 * the free-tier limit rather than crash, but we never hard-block on infra noise.
 */
export async function freeUserGenerationRateLimit(req, res, next) {
	const userId = req.pocketbaseUserId;

	try {
		if (userId && (await isPaidUser(userId))) {
			return next();
		}
	} catch (err) {
		logger.warn('Tier lookup failed in generation rate limiter, applying free-tier limit:', err.message);
	}

	return limiter(req, res, next);
}
