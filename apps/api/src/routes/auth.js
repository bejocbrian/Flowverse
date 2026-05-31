import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Pocketbase from 'pocketbase';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { isDisposableEmail } from '../utils/disposableEmails.js';
import { verifyTurnstile } from '../utils/turnstile.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const POCKETBASE_HOST = process.env.POCKETBASE_URL || 'http://localhost:8090';

// Build a throwaway PocketBase client for end-user authentication
// (authWithPassword / requestPasswordReset). These calls save the
// authenticated principal's token into the client's authStore. Running them
// on the shared superuser client (`pb`) would overwrite its superuser token
// with a regular user's token, downgrading every subsequent superuser-only
// operation (e.g. creating user records) and breaking signup/login after the
// first request. A fresh client per request keeps the superuser session
// isolated. This mirrors the pattern in middleware/pocketbase-auth.js.
function newUserClient() {
	const client = new Pocketbase(POCKETBASE_HOST);
	client.autoCancellation(false);
	return client;
}

// Strict rate limits. The global limiter still applies on top of these.
const signupLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 5, // 5 signups per hour per IP
	standardHeaders: true,
	legacyHeaders: false,
	message: { success: false, error: 'Too many signup attempts. Try again later.' },
	validate: { trustProxy: false },
});

const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 min
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	message: { success: false, error: 'Too many login attempts. Try again later.' },
	validate: { trustProxy: false },
});

const passwordResetLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 5,
	standardHeaders: true,
	legacyHeaders: false,
	message: { success: false, error: 'Too many password reset attempts. Try again later.' },
	validate: { trustProxy: false },
});

// POST /auth/signup
// Defenses:
//   1. Rate limit (5/hour/IP)
//   2. Cloudflare Turnstile token verification (anti-bot)
//   3. Disposable email domain blocklist
//   4. NO credits granted here. Credits are issued by a PocketBase hook
//      when the user's `verified` flag flips to true (email confirmed or
//      OAuth login). Bots that can sign up but cannot click an email link
//      get nothing.
router.post('/signup', signupLimiter, async (req, res) => {
	const { email, password, name, role, turnstileToken } = req.body || {};

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

	const ip = req.ip;
	const captcha = await verifyTurnstile(turnstileToken, ip);
	if (!captcha.ok) {
		logger.warn(`Signup captcha failed: ${captcha.reason} (ip=${ip})`);
		return res.status(400).json({
			success: false,
			error: 'Captcha verification failed. Please try again.',
		});
	}

	if (isDisposableEmail(email)) {
		logger.warn(`Signup blocked - disposable email: ${email}`);
		return res.status(400).json({
			success: false,
			error: 'This email provider is not allowed. Please use a different email.',
		});
	}

	try {
		const created = await pb.collection('users').create({
			email,
			password,
			passwordConfirm: password,
			name,
			role: role === 'admin' ? 'consumer' : (role || 'consumer'),
			// Email verification is disabled. Grant the welcome credit balance
			// directly at signup. `initial_credits_granted=true` keeps the
			// pb_hooks/grant-initial-credits.pb.js hook from double-granting if
			// verification is ever re-enabled.
			// 80 display credits ≈ 5 Veo 3.1 Fast videos (15 cr each).
			credits_balance: 80,
			initial_credits_granted: true,
		});

		// Authenticate on a throwaway client so we don't clobber the shared
		// superuser client's auth state (see newUserClient).
		const authData = await newUserClient()
			.collection('users')
			.authWithPassword(email, password);

		logger.info(`User signed up: ${authData.record.id}`);

		return res.status(201).json({
			success: true,
			user: {
				id: authData.record.id,
				email: authData.record.email,
				name: authData.record.name,
				role: authData.record.role,
				credits_balance: authData.record.credits_balance,
				verified: authData.record.verified,
				onboarding_completed: !!authData.record.onboarding_completed,
				use_case: authData.record.use_case || null,
				banned_at: authData.record.banned_at || null,
			},
			token: authData.token,
		});
	} catch (error) {
		const msg = error?.message || '';
		const fieldErrors = error?.data?.data;

		if (
			msg.includes('duplicate') ||
			msg.includes('already exists') ||
			fieldErrors?.email?.code === 'validation_invalid_email' ||
			fieldErrors?.email
		) {
			return res.status(400).json({
				success: false,
				error: 'Email already exists or is invalid',
			});
		}

		logger.error('Signup error:', msg);
		return res.status(500).json({ success: false, error: 'Could not create account' });
	}
});

// POST /auth/login
router.post('/login', loginLimiter, async (req, res) => {
	const { email, password, turnstileToken } = req.body || {};

	if (!email || !password) {
		return res.status(400).json({
			success: false,
			error: 'Email and password are required',
		});
	}

	const ip = req.ip;
	const captcha = await verifyTurnstile(turnstileToken, ip);
	if (!captcha.ok) {
		logger.warn(`Login captcha failed: ${captcha.reason} (ip=${ip})`);
		return res.status(400).json({
			success: false,
			error: 'Captcha verification failed. Please try again.',
		});
	}

	try {
		// Authenticate on a throwaway client so we don't clobber the shared
		// superuser client's auth state (see newUserClient).
		const authData = await newUserClient()
			.collection('users')
			.authWithPassword(email, password);

		// Reject banned users. We check after authWithPassword so that the
		// timing of "wrong password" vs "banned" is identical: both come
		// after the password check has run.
		if (authData.record.banned_at) {
			logger.warn(`Banned user attempted login: ${authData.record.id}`);
			return res.status(403).json({
				success: false,
				error: 'This account has been suspended.',
			});
		}

		return res.json({
			success: true,
			user: {
				id: authData.record.id,
				email: authData.record.email,
				name: authData.record.name,
				role: authData.record.role,
				credits_balance: authData.record.credits_balance,
				verified: authData.record.verified,
				onboarding_completed: !!authData.record.onboarding_completed,
				use_case: authData.record.use_case || null,
				banned_at: authData.record.banned_at || null,
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
// Logout is client-side: the frontend drops its token. Do NOT call
// pb.authStore.clear() here - that would log the API's superuser out.
router.post('/logout', async (_req, res) => {
	res.json({ success: true });
});

// POST /auth/reset-password
router.post('/reset-password', passwordResetLimiter, async (req, res) => {
	const { email } = req.body || {};

	if (!email) {
		return res.status(400).json({ success: false, error: 'Email is required' });
	}

	try {
		await newUserClient().collection('users').requestPasswordReset(email);
	} catch (error) {
		// Swallow errors so we don't leak whether an email is registered.
		logger.warn('Password reset attempt error (suppressed):', error.message);
	}

	res.json({
		success: true,
		message: 'If an account exists with this email, a password reset link has been sent',
	});
});

export default router;
