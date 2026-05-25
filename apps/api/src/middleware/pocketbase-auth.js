import { Buffer } from 'node:buffer';
import Pocketbase from 'pocketbase';

const POCKETBASE_HOST = process.env.POCKETBASE_URL || 'http://localhost:8090';

export async function pocketbaseAuth(req, res, next) {
	const token = req.headers.authorization?.split(' ')?.[1];

	if (!token) {
		return next();
	}

	try {
		const base64Decoded = Buffer.from(token, 'base64').toString('utf-8');
		const tokenData = JSON.parse(base64Decoded);

		if (!tokenData?.record) {
			return next();
		}

		// Refresh token to verify it's valid and not tampered with.
		// Use a fresh client per-request so we don't share auth state.
		const pocketbaseClient = new Pocketbase(POCKETBASE_HOST);
		pocketbaseClient.authStore.save(tokenData.token, tokenData.record);

		const refreshed = await pocketbaseClient
			.collection(tokenData.record.collectionName)
			.authRefresh();

		req.pocketbaseUserId = refreshed.record.id;
		req.pocketbaseUser = refreshed.record;

		return next();
	} catch (error) {
		return next(new Error(`Auth verification failed: ${error.message}`));
	}
}
