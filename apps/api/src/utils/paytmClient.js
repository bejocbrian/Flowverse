/**
 * Shared Paytm REST helpers so the order route and the webhook talk to the
 * same environment with the same credentials. Mirrors cashfreeClient.js.
 *
 * Paytm staging vs production are selected by PAYTM_ENV ("staging" |
 * "production"). All requests are signed with the Merchant Key via
 * paytmChecksum.js.
 */
import logger from './logger.js';
import { generateSignature, verifySignature } from './paytmChecksum.js';

// STAGING:    https://securestage.paytmpayments.com
// PRODUCTION: https://securegw.paytmpayments.com
export function paytmBaseUrl() {
	const mode = (process.env.PAYTM_ENV || 'staging').toLowerCase();
	return mode === 'production'
		? 'https://securegw.paytmpayments.com'
		: 'https://securestage.paytmpayments.com';
}

export function paytmMode() {
	return (process.env.PAYTM_ENV || 'staging').toLowerCase() === 'production'
		? 'production'
		: 'staging';
}

export function paytmMid() {
	return (process.env.PAYTM_MID || '').trim();
}

export function paytmMerchantKey() {
	return (process.env.PAYTM_MERCHANT_KEY || '').trim();
}

export function paytmWebsite() {
	// WEBSTAGING for staging, DEFAULT (or your configured site) for production.
	return (
		(process.env.PAYTM_WEBSITE || '').trim() ||
		(paytmMode() === 'production' ? 'DEFAULT' : 'WEBSTAGING')
	);
}

export function paytmConfigured() {
	return Boolean(paytmMid() && paytmMerchantKey());
}

/**
 * The public frontend origin, used to build the post-payment return URL for
 * the Paytm callback (a full-page POST that can't carry SPA state).
 * Derived from CORS_ORIGIN (first entry if comma-separated). Falls back to
 * localhost:3000 for local dev.
 */
export function frontendOrigin() {
	const raw = (process.env.CORS_ORIGIN || '').split(',')[0].trim();
	if (raw && raw !== '*') return raw.replace(/\/$/, '');
	return 'http://localhost:3000';
}

/**
 * Sign a body object and POST it to a Paytm endpoint that uses the
 * { body, head: { signature } } envelope. Returns the parsed JSON response
 * (or throws on network error).
 */
export async function paytmSignedPost(url, bodyObject, { extraHead = {}, timeoutMs = 15000 } = {}) {
	const signature = generateSignature(bodyObject, paytmMerchantKey());
	const payload = {
		body: bodyObject,
		head: { ...extraHead, signature },
	};
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(timeoutMs),
	});
	const data = await response.json().catch(() => ({}));
	return { ok: response.ok, status: response.status, data };
}

/**
 * Verify the signature on a Paytm response/webhook body envelope.
 * Paytm signs the `body` object; the signature lives in `head.signature`.
 */
export function verifyResponseSignature(envelope) {
	try {
		const body = envelope?.body;
		const signature = envelope?.head?.signature;
		if (!body || !signature) return false;
		return verifySignature(body, paytmMerchantKey(), signature);
	} catch {
		return false;
	}
}

/**
 * Authoritatively fetch a transaction's status from Paytm by orderId.
 * Single source of truth for crediting - mirrors fetchCashfreeOrder().
 *
 * Returns the parsed `body` object from Paytm's /v3/order/status response,
 * or null on any failure. Shape of interest:
 *   {
 *     resultInfo: { resultStatus: 'TXN_SUCCESS'|'TXN_FAILURE'|'PENDING', resultCode, resultMsg },
 *     txnId, bankTxnId, orderId, txnAmount, txnType, gatewayName, ...
 *   }
 */
export async function fetchPaytmOrder(orderId) {
	if (!orderId || !paytmConfigured()) return null;
	try {
		const body = { mid: paytmMid(), orderId };
		const { ok, status, data } = await paytmSignedPost(
			`${paytmBaseUrl()}/v3/order/status`,
			body,
		);
		if (!ok) {
			logger.warn(`Paytm order status HTTP ${status} for ${orderId}`);
			return null;
		}
		// Verify Paytm's response signature before trusting it.
		if (!verifyResponseSignature(data)) {
			logger.warn(`Paytm order status signature invalid for ${orderId}`);
			return null;
		}
		return data?.body || null;
	} catch (error) {
		logger.error(`Paytm fetch order status error for ${orderId}: ${error.message}`);
		return null;
	}
}

// Paytm result statuses that mean the money was actually captured.
export const PAYTM_SUCCESS_STATUS = 'TXN_SUCCESS';
