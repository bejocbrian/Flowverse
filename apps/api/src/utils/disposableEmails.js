/**
 * Disposable email domain blocklist.
 *
 * Sourced from the `disposable-email-domains` npm package (a JSON file).
 * The list is conservative and well-maintained.
 */

import { createRequire } from 'node:module';
import logger from './logger.js';

const require = createRequire(import.meta.url);

let blocklist = null;

function loadBlocklist() {
	if (blocklist) return blocklist;

	try {
		// require() handles JSON natively, ESM `import` would need an attribute.
		const list = require('disposable-email-domains');
		blocklist = new Set(list);
		logger.info(`Loaded ${blocklist.size} disposable email domains`);
	} catch (err) {
		logger.warn('disposable-email-domains not available:', err.message);
		// Fail open: empty set means nothing is blocked.
		blocklist = new Set();
	}

	return blocklist;
}

/**
 * Returns true when the email's domain is on the disposable blocklist.
 * Returns true for clearly malformed emails (no `@` or empty domain).
 */
export function isDisposableEmail(email) {
	if (typeof email !== 'string' || !email.includes('@')) {
		return true;
	}

	const domain = email.split('@')[1]?.trim().toLowerCase();
	if (!domain) {
		return true;
	}

	return loadBlocklist().has(domain);
}
