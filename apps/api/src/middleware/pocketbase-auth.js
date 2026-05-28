import { Buffer } from 'node:buffer';
import Pocketbase from 'pocketbase';

const POCKETBASE_HOST = process.env.POCKETBASE_URL || 'http://localhost:8090';

/**
 * Middleware that verifies a PocketBase auth token sent by the frontend.
 *
 * The frontend serializes its `pocketbase_auth` localStorage entry, base64
 * encodes the result, and sends it in the `Authorization: Bearer ...` header.
 *
 * The PocketBase JS SDK writes an object like:
 *   { token: "...", model: { id, collectionId, collectionName, ... } }
 * Older code shipped here used `record` instead of `model`, so we accept both.
 */
export async function pocketbaseAuth(req, res, next) {
	const token = req.headers.authorization?.split(' ')?.[1];

	if (!token) {
		return next();
	}

	try {
		const base64Decoded = Buffer.from(token, 'base64').toString('utf-8');
		const tokenData = JSON.parse(base64Decoded);

		const record = tokenData?.model || tokenData?.record;
		if (!record || !tokenData?.token) {
			return next();
		}

		const collectionName = record.collectionName || 'users';

		// Use a fresh client per-request so we don't share auth state across users.
		const pocketbaseClient = new Pocketbase(POCKETBASE_HOST);
		pocketbaseClient.authStore.save(tokenData.token, record);

		const refreshed = await pocketbaseClient
			.collection(collectionName)
			.authRefresh();

		if (refreshed.record.banned_at) {
			return res.status(403).json({
				error: 'Account is suspended',
			});
		}

		req.pocketbaseUserId = refreshed.record.id;
		req.pocketbaseUser = refreshed.record;

		return next();
	} catch (error) {
		// Invalid token: reply 401 instead of crashing the request with 500.
		return res.status(401).json({
			error: 'Authentication failed',
			detail: error?.message || 'Invalid token',
		});
	}
}
