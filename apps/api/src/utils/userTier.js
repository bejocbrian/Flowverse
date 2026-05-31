/**
 * User tier helper: is a user "paid" or "free"?
 *
 * A user is considered "paid" once they have at least one completed credit
 * purchase (`transactions.type = 'purchase'`). This single signal drives both
 * the daily generation cap and the per-user generation rate limit, so it lives
 * in one place with a short-lived cache to avoid repeated lookups.
 *
 * The cache TTL is intentionally short: a user who just purchased is treated as
 * paid within at most CACHE_TTL_MS. A free user is never wrongly treated as
 * paid because we only ever cache the value we actually read from the DB.
 */
import pb from './pocketbaseClient.js';

const CACHE_TTL_MS = 60 * 1000;

/** @type {Map<string, { paid: boolean, expires: number }>} */
const cache = new Map();

/**
 * Whether the user has ever completed a credit purchase.
 * Throws on lookup failure — callers decide how to handle (fail-open).
 *
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function isPaidUser(userId) {
	if (!userId) {
		return false;
	}

	const now = Date.now();
	const cached = cache.get(userId);
	if (cached && cached.expires > now) {
		return cached.paid;
	}

	const res = await pb.collection('transactions').getList(1, 1, {
		filter: `user_id = "${userId}" && type = "purchase"`,
	});
	const paid = res.totalItems > 0;

	cache.set(userId, { paid, expires: now + CACHE_TTL_MS });
	return paid;
}

/**
 * Invalidate the cached tier for a user (or the whole cache). Call this after
 * a successful purchase if you want the new tier to take effect immediately.
 *
 * @param {string} [userId]
 */
export function clearUserTierCache(userId) {
	if (userId) {
		cache.delete(userId);
	} else {
		cache.clear();
	}
}
