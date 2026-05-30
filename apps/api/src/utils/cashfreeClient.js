/**
 * Shared Cashfree REST helpers so the order route and the webhook talk to
 * the same environment with the same headers.
 */

// PROD: https://api.cashfree.com/pg
// SANDBOX: https://sandbox.cashfree.com/pg
export function cashfreeBaseUrl() {
	const mode = (process.env.CASHFREE_ENV || 'sandbox').toLowerCase();
	return mode === 'production'
		? 'https://api.cashfree.com/pg'
		: 'https://sandbox.cashfree.com/pg';
}

export function cashfreeHeaders() {
	return {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		'x-api-version': '2023-08-01',
		'x-client-id': (process.env.CASHFREE_APP_ID || '').trim(),
		'x-client-secret': (process.env.CASHFREE_SECRET_KEY || '').trim(),
	};
}

export function cashfreeConfigured() {
	return Boolean(
		(process.env.CASHFREE_APP_ID || '').trim() &&
		(process.env.CASHFREE_SECRET_KEY || '').trim(),
	);
}

/**
 * Fetch a single order from Cashfree by order_id.
 * Returns the parsed order object, or null on any failure.
 */
export async function fetchCashfreeOrder(orderId) {
	if (!orderId || !cashfreeConfigured()) return null;
	try {
		const response = await fetch(
			`${cashfreeBaseUrl()}/orders/${encodeURIComponent(orderId)}`,
			{
				method: 'GET',
				headers: cashfreeHeaders(),
				signal: AbortSignal.timeout(15000),
			},
		);
		if (!response.ok) return null;
		return await response.json().catch(() => null);
	} catch {
		return null;
	}
}
