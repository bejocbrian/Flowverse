import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import { isPaidUser } from '../utils/userTier.js';

const router = Router();

router.use(pocketbaseAuth);

// Shape the user object consistently for the frontend. Include the fields
// the web app reads (role, onboarding_completed, use_case, banned_at, etc.)
// so it never needs to talk to PocketBase directly.
function publicUser(u, extra = {}) {
	return {
		id: u.id,
		email: u.email,
		name: u.name,
		avatar: u.avatar || '',
		role: u.role || 'consumer',
		credits_balance: u.credits_balance ?? 0,
		onboarding_completed: !!u.onboarding_completed,
		use_case: u.use_case || null,
		notifications_enabled: u.notifications_enabled ?? null,
		banned_at: u.banned_at || null,
		verified: u.verified,
		created: u.created,
		updated: u.updated,
		...extra,
	};
}

const VALID_USE_CASES = ['marketing', 'social', 'film', 'personal', 'other'];

// GET /users/me - Full current-user record (replaces direct PocketBase reads)
router.get('/me', async (req, res) => {
	if (!req.pocketbaseUserId) {
		return res.status(401).json({ error: 'Authentication required' });
	}
	try {
		const user = await pb.collection('users').getOne(req.pocketbaseUserId);
		// is_paid drives model access in the UI (free users get Veo 3.1 Lite only).
		const is_paid = await isPaidUser(req.pocketbaseUserId).catch(() => false);
		res.json({ user: publicUser(user, { is_paid }) });
	} catch (error) {
		logger.error('Fetch me error:', error.message);
		throw error;
	}
});

// PATCH /users/me - Update self-service profile fields (onboarding, use_case,
// name, avatar). Whitelisted so users can't escalate role or change credits.
router.patch('/me', async (req, res) => {
	if (!req.pocketbaseUserId) {
		return res.status(401).json({ error: 'Authentication required' });
	}

	const { name, avatar, use_case, onboarding_completed } = req.body || {};
	const updateData = {};

	if (name !== undefined) {
		if (typeof name !== 'string' || name.trim().length < 2) {
			return res.status(400).json({ error: 'Name must be at least 2 characters' });
		}
		updateData.name = name.trim();
	}
	if (avatar !== undefined) updateData.avatar = avatar;
	if (use_case !== undefined) {
		if (use_case !== null && !VALID_USE_CASES.includes(use_case)) {
			return res.status(400).json({ error: 'Invalid use_case' });
		}
		updateData.use_case = use_case;
	}
	if (onboarding_completed !== undefined) {
		updateData.onboarding_completed = !!onboarding_completed;
	}

	if (Object.keys(updateData).length === 0) {
		return res.status(400).json({ error: 'No valid fields to update' });
	}

	try {
		const user = await pb.collection('users').update(req.pocketbaseUserId, updateData);
		logger.info(`User self-update for ${req.pocketbaseUserId}: ${Object.keys(updateData).join(', ')}`);
		res.json({ user: publicUser(user) });
	} catch (error) {
		logger.error('Self-update error:', error.message);
		throw error;
	}
});

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
