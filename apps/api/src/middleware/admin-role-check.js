import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

export const adminRoleCheck = async (req, res, next) => {
	const authHeader = req.headers.authorization;

	if (!authHeader) {
		return res.status(401).json({ error: 'Authorization header required' });
	}

	try {
		const token = authHeader.split(' ')[1];
		if (!token) {
			return res.status(401).json({ error: 'Invalid authorization format' });
		}

		// Set auth token and verify
		pb.authStore.save(token);
		const authData = await pb.collection('users').authRefresh();

		if (!authData.record.role || authData.record.role !== 'admin') {
			return res.status(403).json({ error: 'Admin access required' });
		}

		req.pocketbaseUserId = authData.record.id;
		next();
	} catch (error) {
		logger.error('Admin role check error:', error.message);
		return res.status(401).json({ error: 'Unauthorized' });
	}
};
