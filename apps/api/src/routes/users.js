import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

router.use(pocketbaseAuth);

// GET /users/profile - Get current user profile
router.get('/profile', async (req, res) => {
	try {
		const user = await pb.collection('users').getOne(req.pocketbaseUserId);

		logger.info(`Fetched profile for user: ${req.pocketbaseUserId}`);

		res.json({
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				avatar: user.avatar || '',
				credits_balance: user.credits_balance,
				created: user.created,
				updated: user.updated,
			},
		});
	} catch (error) {
		logger.error('Fetch profile error:', error.message);
		throw error;
	}
});

// PUT /users/profile - Update user profile
router.put('/profile', async (req, res) => {
	const { name, avatar } = req.body;

	if (!name && !avatar) {
		return res.status(400).json({ error: 'At least one field (name or avatar) is required' });
	}

	try {
		const updateData = {};
		if (name) updateData.name = name;
		if (avatar) updateData.avatar = avatar;

		const user = await pb.collection('users').update(req.pocketbaseUserId, updateData);

		logger.info(`Profile updated for user: ${req.pocketbaseUserId}`);

		res.json({
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				avatar: user.avatar || '',
				credits_balance: user.credits_balance,
				updated: user.updated,
			},
		});
	} catch (error) {
		logger.error('Update profile error:', error.message);
		throw error;
	}
});

// PUT /users/settings - Update user settings
router.put('/settings', async (req, res) => {
	const { email, password, notifications } = req.body;

	if (!email && !password && notifications === undefined) {
		return res.status(400).json({ error: 'At least one field is required' });
	}

	try {
		const updateData = {};

		if (email) updateData.email = email;
		if (password) {
			updateData.password = password;
			updateData.passwordConfirm = password;
		}
		if (notifications !== undefined) updateData.notifications_enabled = notifications;

		const user = await pb.collection('users').update(req.pocketbaseUserId, updateData);

		logger.info(`Settings updated for user: ${req.pocketbaseUserId}`);

		res.json({
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				notifications_enabled: user.notifications_enabled,
				updated: user.updated,
			},
		});
	} catch (error) {
		logger.error('Update settings error:', error.message);
		if (error.message.includes('duplicate')) {
			return res.status(400).json({ error: 'Email already in use' });
		}
		throw error;
	}
});

export default router;
