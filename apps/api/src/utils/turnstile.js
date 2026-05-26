/**
 * Cloudflare Turnstile server-side verification.
 *
 * The frontend renders the Turnstile widget with the site key and gets back a
 * token. The frontend forwards that token in the request body as
 * `turnstileToken`. We then call Cloudflare's siteverify endpoint with our
 * secret to confirm the token is valid.
 *
 * If TURNSTILE_SECRET_KEY is not set, verification is skipped (useful for
 * local dev). Production must set it.
 */
import logger from './logger.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token, ip) {
	const secret = process.env.TURNSTILE_SECRET_KEY;

	if (!secret) {
		// No secret configured: skip verification entirely.
		// Production deployments MUST set this env var.
		return { ok: true, skipped: true };
	}

	if (!token || typeof token !== 'string') {
		return { ok: false, reason: 'missing_token' };
	}

	try {
		const params = new URLSearchParams();
		params.append('secret', secret);
		params.append('response', token);
		if (ip) {
			params.append('remoteip', ip);
		}

		const res = await fetch(VERIFY_URL, {
			method: 'POST',
			body: params,
		});

		if (!res.ok) {
			logger.warn(`Turnstile siteverify HTTP ${res.status}`);
			return { ok: false, reason: 'verify_http_error' };
		}

		const data = await res.json();
		if (!data.success) {
			return { ok: false, reason: 'invalid_token', codes: data['error-codes'] };
		}

		return { ok: true };
	} catch (err) {
		logger.error('Turnstile verify error:', err.message);
		return { ok: false, reason: 'verify_exception' };
	}
}
