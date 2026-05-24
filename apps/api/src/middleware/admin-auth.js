import logger from '../utils/logger.js';

export const adminAuth = async (req, res, next) => {
	const token = req.headers.authorization?.split(' ')[1];

	if (!token) {
		return res.status(401).json({ error: 'Authorization token required' });
	}

	try {
		// Verify token and check admin role
		const user = await req.pocketbaseClient?.collection('users').authRefresh();

		if (!user || user.record.role !== 'admin') {
			return res.status(403).json({ error: 'Admin access required' });
		}

		req.adminUserId = user.record.id;
		next();
	} catch (error) {
		logger.error('Admin auth error:', error.message);
		return res.status(401).json({ error: 'Invalid token' });
	}
};
