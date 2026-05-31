import pb from './pocketbaseClient.js';
import logger from './logger.js';

/**
 * Cashed payment-method enable flags. We refresh from PocketBase at most
 * once every CACHE_MS so toggling in admin reflects within a few seconds
 * without hammering the DB on every checkout call.
 */
const CACHE_MS = 10_000;
let cache = { fetchedAt: 0, value: null };

const DEFAULT = { stripe: false, cashfree: true, paytm: false };

/*
 * TEMPORARY KILL-SWITCH: automated payment gateways are disabled while
 * business/payment verification is pending. While true, EVERY gateway reports
 * disabled, so all create-order / checkout endpoints return 503 regardless of
 * the admin toggles in the DB. Users pay via the manual UPI-QR + WhatsApp flow
 * on the wallet page instead.
 *
 * TO RE-ENABLE automated payments later: set this to false (or remove it) and
 * turn the desired providers on from Admin -> Settings -> Payments.
 */
const PAYMENTS_DISABLED = true;

function allDisabled() {
	return {
		stripe: false,
		cashfree: false,
		paytm: false,
		cashfree_mode: (process.env.CASHFREE_ENV || 'sandbox').toLowerCase() === 'production'
			? 'production'
			: 'sandbox',
		paytm_mode: (process.env.PAYTM_ENV || 'staging').toLowerCase() === 'production'
			? 'production'
			: 'staging',
	};
}

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
	// Kill-switch: short-circuit everything to "disabled" while manual
	// payments are active. Cached like normal so callers are unaffected.
	if (PAYMENTS_DISABLED) {
		return allDisabled();
	}

	const now = Date.now();
	if (cache.value && now - cache.fetchedAt < CACHE_MS) {
		return cache.value;
	}

	try {
		const rows = await pb
			.collection('settings')
			.getFullList({ filter: 'key = "payment_stripe_enabled" || key = "payment_cashfree_enabled" || key = "payment_paytm_enabled"' });

		const map = {};
		for (const r of rows) map[r.key] = r.value;

		const value = {
			stripe: coerceBool(map.payment_stripe_enabled, DEFAULT.stripe),
			cashfree: coerceBool(map.payment_cashfree_enabled, DEFAULT.cashfree),
			paytm: coerceBool(map.payment_paytm_enabled, DEFAULT.paytm),
			// Surface the server's Cashfree environment so the frontend SDK
			// loads in the matching mode (sandbox vs production). Driving this
			// from the server avoids a frontend/back-end mode mismatch that
			// silently breaks checkout.
			cashfree_mode: (process.env.CASHFREE_ENV || 'sandbox').toLowerCase() === 'production'
				? 'production'
				: 'sandbox',
			// Same idea for Paytm: the client SDK must load in the matching
			// environment (staging vs production) as the server.
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
