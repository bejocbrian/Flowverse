import { Buffer } from 'node:buffer';
import Pocketbase from 'pocketbase';
import logger from '../utils/logger.js';

const POCKETBASE_HOST = process.env.POCKETBASE_URL || 'http://localhost:8090';

/**
 * Verifies the requester is an authenticated admin.
 *
 * The frontend wraps its `pocketbase_auth` localStorage entry in base64
 * (see apps/web/src/lib/apiServerClient.js). We must decode the wrapper
 * the same way `pocketbase-auth.js` does, then verify the auth token
 * against PocketBase using a *fresh* client per request so we never
 * mutate global auth state.
 */
export const adminRoleCheck = async (req, res, next) => {
	const authHeader = req.headers.authorization;

	if (!authHeader) {
		return res.status(401).json({ error: 'Authorization header required' });
	}

	const wrappedToken = authHeader.split(' ')[1];
	if (!wrappedToken) {
		return res.status(401).json({ error: 'Invalid authorization format' });
	}

	try {
		const decoded = Buffer.from(wrappedToken, 'base64').toString('utf-8');
		const tokenData = JSON.parse(decoded);

		const record = tokenData?.model || tokenData?.record;
		if (!record || !tokenData?.token) {
			return res.status(401).json({ error: 'Invalid token' });
		}

		const collectionName = record.collectionName || 'users';

		// Fresh client per request: never share auth state across users.
		const pbForRequest = new Pocketbase(POCKETBASE_HOST);
		pbForRequest.authStore.save(tokenData.token, record);

		const refreshed = await pbForRequest
			.collection(collectionName)
			.authRefresh();

		if (!refreshed.record.role || refreshed.record.role !== 'admin') {
			return res.status(403).json({ error: 'Admin access required' });
		}

		if (refreshed.record.banned_at) {
			return res.status(403).json({ error: 'Account is banned' });
		}

		req.pocketbaseUserId = refreshed.record.id;
		req.pocketbaseUser = refreshed.record;
		next();
	} catch (error) {
		logger.error('Admin role check error:', error.message);
		return res.status(401).json({ error: 'Unauthorized' });
	}
};
