import pb from './pocketbaseClient.js';
import logger from './logger.js';

/**
 * Cashed payment-method enable flags. We refresh from PocketBase at most
 * once every CACHE_MS so toggling in admin reflects within a few seconds
 * without hammering the DB on every checkout call.
 */
const CACHE_MS = 10_000;
let cache = { fetchedAt: 0, value: null };

const DEFAULT = { stripe: true, cashfree: false };

function coerceBool(value, fallback) {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		if (value === 'true') return true;
		if (value === 'false') return false;
	}
	if (value && typeof value === 'object') {
		// Tolerate the legacy { value: true } shape.
		if ('value' in value) return coerceBool(value.value, fallback);
	}
	return fallback;
}

export async function getPaymentMethods() {
	const now = Date.now();
	if (cache.value && now - cache.fetchedAt < CACHE_MS) {
		return cache.value;
	}

	try {
		const rows = await pb
			.collection('settings')
			.getFullList({ filter: 'key = "payment_stripe_enabled" || key = "payment_cashfree_enabled"' });

		const map = {};
		for (const r of rows) map[r.key] = r.value;

		const value = {
			stripe: coerceBool(map.payment_stripe_enabled, DEFAULT.stripe),
			cashfree: coerceBool(map.payment_cashfree_enabled, DEFAULT.cashfree),
		};

		cache = { fetchedAt: now, value };
		return value;
	} catch (error) {
		logger.warn('paymentMethods: settings lookup failed, using defaults:', error.message);
		return DEFAULT;
	}
}

export function invalidatePaymentMethodsCache() {
	cache = { fetchedAt: 0, value: null };
}
