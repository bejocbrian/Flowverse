/**
 * Admin-configurable abuse-control settings, cached.
 *
 * These drive the anti-abuse limits and are editable from the admin Settings
 * page (stored in the `settings` collection). Reads are cached for a few
 * seconds so toggling in admin reflects quickly without hammering the DB.
 *
 * Safety model:
 *   - Every value is coerced to a positive integer. Anything invalid (0,
 *     negative, empty, NaN, junk) falls back to the env default, which itself
 *     falls back to a hardcoded safe default. A bad admin input can therefore
 *     never disable a protection or crash a limiter.
 *   - Fail-open on DB error: if PocketBase is briefly unreachable we keep
 *     serving the last-known (or default) values instead of throwing.
 *
 * Settings keys (all JSON numbers):
 *   free_daily_generation_cap    - max generations / 24h for free users
 *   paid_daily_generation_cap    - max generations / 24h for paid users
 *   free_generation_rate_max     - max generations / burst window for free users
 */
import pb from './pocketbaseClient.js';
import logger from './logger.js';

const CACHE_MS = 10_000;

const KEYS = {
	freeDailyCap: 'free_daily_generation_cap',
	paidDailyCap: 'paid_daily_generation_cap',
	freeRateMax: 'free_generation_rate_max',
};

let cache = { fetchedAt: 0, value: null };
let refreshing = false;

function envInt(name, fallback) {
	const n = Number(process.env[name]);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Hardcoded → env-overridable defaults. */
function defaults() {
	return {
		freeDailyCap: envInt('FREE_DAILY_GENERATION_CAP', 50),
		paidDailyCap: envInt('PAID_DAILY_GENERATION_CAP', 500),
		freeRateMax: envInt('FREE_GENERATION_RATE_MAX', 5),
	};
}

/** Coerce a stored setting value (number, string, or legacy {number}/{value}) to a positive int. */
function coercePositiveInt(value, fallback) {
	let v = value;
	if (v && typeof v === 'object') {
		if ('number' in v) v = v.number;
		else if ('value' in v) v = v.value;
		else if ('text' in v) v = v.text;
	}
	if (typeof v === 'string') {
		const trimmed = v.trim();
		// tolerate legacy single-quoted pseudo-JSON like "{'number': 50}"
		if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
			try {
				return coercePositiveInt(JSON.parse(trimmed.replace(/'/g, '"')), fallback);
			} catch {
				/* fall through */
			}
		}
		v = Number(trimmed);
	}
	if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
		return Math.floor(v);
	}
	return fallback;
}

async function refresh() {
	if (refreshing) return;
	refreshing = true;
	try {
		const rows = await pb.collection('settings').getFullList({
			filter: `key = "${KEYS.freeDailyCap}" || key = "${KEYS.paidDailyCap}" || key = "${KEYS.freeRateMax}"`,
		});
		const map = {};
		for (const r of rows) map[r.key] = r.value;

		const d = defaults();
		cache = {
			fetchedAt: Date.now(),
			value: {
				freeDailyCap: coercePositiveInt(map[KEYS.freeDailyCap], d.freeDailyCap),
				paidDailyCap: coercePositiveInt(map[KEYS.paidDailyCap], d.paidDailyCap),
				freeRateMax: coercePositiveInt(map[KEYS.freeRateMax], d.freeRateMax),
			},
		};
	} catch (err) {
		logger.warn('abuseSettings refresh failed, keeping last/default values:', err.message);
		if (!cache.value) {
			cache = { fetchedAt: Date.now(), value: defaults() };
		}
	} finally {
		refreshing = false;
	}
}

/**
 * Synchronous getter. Always returns a usable object immediately (last-known
 * or defaults) and kicks off a background refresh when stale. Never blocks,
 * never throws. Use this where async is awkward (e.g. rate-limit `max`).
 */
export function getAbuseSettingsSync() {
	const now = Date.now();
	if (!cache.value) {
		refresh(); // fire-and-forget; serve defaults this time
		return defaults();
	}
	if (now - cache.fetchedAt > CACHE_MS) {
		refresh(); // background refresh; serve last-known now
	}
	return cache.value;
}

/**
 * Async getter. Awaits a refresh if the cache is empty or stale, so callers
 * that can await get the freshest values. Falls back to defaults on error.
 */
export async function getAbuseSettings() {
	if (!cache.value || Date.now() - cache.fetchedAt > CACHE_MS) {
		await refresh();
	}
	return cache.value || defaults();
}

/** Force the next read to refresh (call after an admin settings save). */
export function invalidateAbuseSettingsCache() {
	// Keep last-known value to avoid a default-value flicker, but mark stale so
	// the next read refreshes from the DB.
	cache = { fetchedAt: 0, value: cache.value };
}

export { KEYS as ABUSE_SETTING_KEYS };
