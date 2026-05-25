import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /auth/signup
router.post('/signup', async (req, res) => {
	const { email, password, name, role } = req.body || {};

	if (!email || !password || !name) {
		return res.status(400).json({
			success: false,
			error: 'Email, password, and name are required',
		});
	}

	if (!EMAIL_REGEX.test(email)) {
		return res.status(400).json({ success: false, error: 'Invalid email format' });
	}

	if (password.length < 8) {
		return res.status(400).json({
			success: false,
			error: 'Password must be at least 8 characters long',
		});
	}

	if (name.trim().length < 2) {
		return res.status(400).json({
			success: false,
			error: 'Name must be at least 2 characters long',
		});
	}

	try {
		await pb.collection('users').create({
			email,
			password,
			passwordConfirm: password,
			name,
			role: role || 'consumer',
			credits_balance: 100,
		});

		const authData = await pb.collection('users').authWithPassword(email, password);

		logger.info(`User signed up: ${authData.record.id}`);

		return res.status(201).json({
			success: true,
			user: {
				id: authData.record.id,
				email: authData.record.email,
				name: authData.record.name,
				role: authData.record.role,
				credits_balance: authData.record.credits_balance,
			},
			token: authData.token,
		});
	} catch (error) {
		const msg = error?.message || '';

		if (msg.includes('duplicate') || msg.includes('already exists') || error?.status === 400) {
			// PocketBase typically returns 400 with `validation_invalid_email` for duplicates
			const fieldErrors = error?.data?.data;
			if (fieldErrors?.email?.code === 'validation_invalid_email' || msg.toLowerCase().includes('email')) {
				return res.status(400).json({
					success: false,
					error: 'Email already exists or is invalid',
				});
			}
		}

		logger.error('Signup error:', msg);
		return res.status(500).json({ success: false, error: 'Could not create account' });
	}
});

// POST /auth/login
router.post('/login', async (req, res) => {
	const { email, password } = req.body || {};

	if (!email || !password) {
		return res.status(400).json({
			success: false,
			error: 'Email and password are required',
		});
	}

	try {
		const authData = await pb.collection('users').authWithPassword(email, password);

		return res.json({
			success: true,
			user: {
				id: authData.record.id,
				email: authData.record.email,
				name: authData.record.name,
				role: authData.record.role,
				credits_balance: authData.record.credits_balance,
			},
			token: authData.token,
		});
	} catch (error) {
		if (error?.status === 400 || error?.message?.includes('Failed to authenticate')) {
			return res.status(401).json({
				success: false,
				error: 'Invalid email or password',
			});
		}

		logger.error('Login error:', error.message);
		return res.status(500).json({ success: false, error: 'Login failed' });
	}
});

// POST /auth/logout
// Logout is client-side: the frontend drops its token. We must NOT call
// pb.authStore.clear() here because `pb` is the shared API-side superuser
// client and clearing it would break every subsequent PocketBase call.
router.post('/logout', async (_req, res) => {
	res.json({ success: true });
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
	const { email } = req.body || {};

	if (!email) {
		return res.status(400).json({ success: false, error: 'Email is required' });
	}

	try {
		await pb.collection('users').requestPasswordReset(email);
	} catch (error) {
		// Swallow errors so we don't leak whether an email is registered.
		logger.warn('Password reset attempt error (suppressed):', error.message);
	}

	// Always respond the same way.
	res.json({
		success: true,
		message: 'If an account exists with this email, a password reset link has been sent',
	});
});

export default router;
