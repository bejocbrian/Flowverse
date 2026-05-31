/**
 * Rolling 24h generation cap (anti-abuse).
 *
 * Every video/image generation calls a paid third-party provider, so each
 * submission costs real money. A user's credit balance bounds *successful*
 * generations, but failed generations are auto-refunded — which leaves a
 * "submit → fail → refund → resubmit" loop that can hammer the provider
 * without ever draining credits. This cap closes that loop by limiting how
 * many generation records a user can create in any rolling 24h window.
 *
 * Free vs paid:
 *   A user counts as "paid" once they have at least one `purchase`
 *   transaction. Paid users get a much higher cap than free users.
 *
 * Caps are admin-configurable from the Settings page (see utils/abuseSettings),
 * which falls back to env (FREE_DAILY_GENERATION_CAP / PAID_DAILY_GENERATION_CAP)
 * and then to hardcoded defaults of 50 free / 500 paid.
 */
import pb from './pocketbaseClient.js';
import logger from './logger.js';
import { isPaidUser } from './userTier.js';
import { getAbuseSettings } from './abuseSettings.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many generation records has the user created in the last 24h? */
async function countGenerationsLast24h(userId) {
	// Same ISO format used by the idempotency lookups elsewhere in the codebase.
	const since = new Date(Date.now() - DAY_MS).toISOString();
	const res = await pb.collection('videos').getList(1, 1, {
		filter: `user_id = "${userId}" && created >= "${since}"`,
	});
	return res.totalItems;
}

/**
 * Decide whether `requestedCount` new generations can be submitted now without
 * exceeding the user's rolling 24h cap.
 *
 * Fail-open: if the lookups throw (e.g. PocketBase momentarily unreachable) we
 * allow the request rather than block a legitimate user. A truly-down PB would
 * fail the generation downstream anyway.
 *
 * @param {{ userId: string, requestedCount?: number }} params
 * @returns {Promise<{ allowed: boolean, cap: number, used: number, isPaid: boolean, requested: number, errored?: boolean }>}
 */
export async function checkDailyGenerationCap({ userId, requestedCount = 1 }) {
	const requested = Math.max(1, Number(requestedCount) || 1);

	try {
		const [isPaid, settings] = await Promise.all([
			isPaidUser(userId),
			getAbuseSettings(),
		]);
		const cap = isPaid ? settings.paidDailyCap : settings.freeDailyCap;
		const used = await countGenerationsLast24h(userId);

		return {
			allowed: used + requested <= cap,
			cap,
			used,
			isPaid,
			requested,
		};
	} catch (err) {
		logger.error('Daily generation cap check failed, allowing request:', err.message);
		return { allowed: true, cap: Infinity, used: 0, isPaid: false, requested, errored: true };
	}
}
