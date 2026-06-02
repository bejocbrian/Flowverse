import pb from './pocketbaseClient.js';
import logger from './logger.js';

/**
 * Cashed payment-method enable flags. We refresh from PocketBase at most
 * once every CACHE_MS so toggling in admin reflects within a few seconds
 * without hammering the DB on every checkout call.
 */
const CACHE_MS = 10_000;
let cache = { fetchedAt: 0, value: null };

const DEFAULT = { stripe: false, cashfree: true, paytm: false, manual_payment_enabled: true };

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
			.getFullList({
				filter:
					'key = "payment_stripe_enabled" || key = "payment_cashfree_enabled" || ' +
					'key = "payment_paytm_enabled" || key = "manual_payment_enabled"',
			});

		const map = {};
		for (const r of rows) map[r.key] = r.value;

		const manualOn = coerceBool(map.manual_payment_enabled, DEFAULT.manual_payment_enabled);

		// When manual payment is the only active mode, automated gateways are
		// forced off regardless of their individual toggles. This mirrors the
		// old PAYMENTS_DISABLED kill-switch but is now DB-driven.
		const autoDisabled = manualOn && !coerceBool(map.payment_stripe_enabled, DEFAULT.stripe)
			&& !coerceBool(map.payment_cashfree_enabled, DEFAULT.cashfree)
			&& !coerceBool(map.payment_paytm_enabled, DEFAULT.paytm);

		const value = {
			stripe: autoDisabled ? false : coerceBool(map.payment_stripe_enabled, DEFAULT.stripe),
			cashfree: autoDisabled ? false : coerceBool(map.payment_cashfree_enabled, DEFAULT.cashfree),
			paytm: autoDisabled ? false : coerceBool(map.payment_paytm_enabled, DEFAULT.paytm),
			manual_payment_enabled: manualOn,
			// Surface the server's Cashfree environment so the frontend SDK
			// loads in the matching mode (sandbox vs production).
			cashfree_mode: (process.env.CASHFREE_ENV || 'sandbox').toLowerCase() === 'production'
				? 'production'
				: 'sandbox',
			// Same idea for Paytm.
			paytm_mode: (process.env.PAYTM_ENV || 'staging').toLowerCase() === 'production'
				? 'production'
				: 'staging',
		};

		cache = { fetchedAt: now, value };
		return value;
	} catch (error) {
		logger.warn('paymentMethods: settings lookup failed, using defaults:', error.message);
		return {
			...DEFAULT,
			cashfree_mode: (process.env.CASHFREE_ENV || 'sandbox').toLowerCase() === 'production'
				? 'production'
				: 'sandbox',
			paytm_mode: (process.env.PAYTM_ENV || 'staging').toLowerCase() === 'production'
				? 'production'
				: 'staging',
		};
	}
}

export function invalidatePaymentMethodsCache() {
	cache = { fetchedAt: 0, value: null };
}
