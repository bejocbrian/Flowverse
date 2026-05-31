/**
 * Native Paytm checksum (signature) implementation.
 *
 * This is a dependency-free port of Paytm's official `PaytmChecksum` algorithm
 * so we don't pull in the stale `paytm-pg-node-sdk`. It MUST match Paytm's
 * scheme byte-for-byte or every signed request is rejected:
 *
 *   signature = AES-128-CBC(  sha256hex(body + "|" + salt) + salt ,  merchantKey )
 *
 * where:
 *   - `body`        is the JSON string of the request body object
 *   - `salt`        is 4 random chars (base64 of 3 random bytes)
 *   - `merchantKey` is the 16-char Paytm Merchant Key (used directly as the
 *                   AES-128 key; the IV is the fixed string below)
 *
 * Verification reverses it: decrypt the signature, peel the trailing 4-char
 * salt, recompute the hash over `body + "|" + salt`, compare in constant time.
 */
import crypto from 'node:crypto';

const IV = '@@@@&&&&####$$$$';
const ALGORITHM = 'aes-128-cbc';

function encrypt(input, key) {
	const cipher = crypto.createCipheriv(ALGORITHM, key, IV);
	let encrypted = cipher.update(input, 'binary', 'base64');
	encrypted += cipher.final('base64');
	return encrypted;
}

function decrypt(encrypted, key) {
	const decipher = crypto.createDecipheriv(ALGORITHM, key, IV);
	let decrypted = decipher.update(encrypted, 'base64', 'binary');
	decrypted += decipher.final('binary');
	return decrypted;
}

function randomSalt(length = 4) {
	// base64 of ceil(length*3/4) bytes, trimmed to `length` chars - matches
	// Paytm's generateRandomString output space.
	return crypto
		.randomBytes(Math.ceil((length * 3) / 4))
		.toString('base64')
		.slice(0, length);
}

function calculateChecksum(body, salt) {
	const hash = crypto
		.createHash('sha256')
		.update(`${body}|${salt}`)
		.digest('hex');
	return hash + salt;
}

/**
 * Generate a Paytm signature for a request body.
 * @param {string|object} body - request body (object is JSON.stringified)
 * @param {string} key - Paytm Merchant Key
 * @returns {string} signature
 */
export function generateSignature(body, key) {
	if (!key) throw new Error('Paytm merchant key is required to sign requests');
	const params = typeof body === 'string' ? body : JSON.stringify(body);
	const salt = randomSalt(4);
	return encrypt(calculateChecksum(params, salt), key);
}

/**
 * Verify a Paytm signature against a body.
 * Returns false on any error rather than throwing, so callers can log-and-continue.
 * @param {string|object} body
 * @param {string} key - Paytm Merchant Key
 * @param {string} signature
 * @returns {boolean}
 */
export function verifySignature(body, key, signature) {
	if (!key || !signature) return false;
	try {
		const params = typeof body === 'string' ? body : JSON.stringify(body);
		const decrypted = decrypt(signature, key);
		const salt = decrypted.slice(-4);
		const expected = calculateChecksum(params, salt);
		const a = Buffer.from(decrypted);
		const b = Buffer.from(expected);
		if (a.length !== b.length) return false;
		return crypto.timingSafeEqual(a, b);
	} catch {
		return false;
	}
}
