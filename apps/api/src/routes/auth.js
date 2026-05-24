import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

const router = Router();

// POST /auth/signup
router.post('/signup', async (req, res) => {
	const { email, password, name, role } = req.body;

	// Log incoming request
	logger.info('Signup request received', { email, name, role });

	// Validate required fields
	if (!email || !password || !name) {
		logger.warn('Signup validation failed: missing required fields', { email, name, hasPassword: !!password });
		return res.status(400).json({ 
			success: false,
			error: 'Email, password, and name are required' 
		});
	}

	// Validate email format
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email)) {
		logger.warn('Signup validation failed: invalid email format', { email });
		return res.status(400).json({ 
			success: false,
			error: 'Invalid email format' 
		});
	}

	// Validate password strength (minimum 8 characters)
	if (password.length < 8) {
		logger.warn('Signup validation failed: password too short', { email });
		return res.status(400).json({ 
			success: false,
			error: 'Password must be at least 8 characters long' 
		});
	}

	// Validate name
	if (name.trim().length < 2) {
		logger.warn('Signup validation failed: name too short', { email });
		return res.status(400).json({ 
			success: false,
			error: 'Name must be at least 2 characters long' 
		});
	}

	try {
		logger.info('Attempting to create user in PocketBase', { email, name });

		// Create user in PocketBase with all required fields
		const user = await pb.collection('users').create({
			email,
			password,
			passwordConfirm: password,
			name,
			role: role || 'consumer', // Default to 'consumer' if not provided
			credits_balance: 100, // Initial credits for new users
		});

		logger.info('User created successfully in PocketBase', { userId: user.id, email });

		// Authenticate the user immediately after creation
		logger.info('Attempting to authenticate user', { email });
		const authData = await pb.collection('users').authWithPassword(email, password);

		logger.info('User authenticated successfully', { userId: authData.record.id, email });

		// Return success response
		res.status(201).json({
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
		logger.error('Signup error during user creation or authentication', { 
			email, 
			errorMessage: error.message,
			errorCode: error.code,
		});

		// Handle duplicate email error
		if (error.message.includes('duplicate') || error.message.includes('already exists')) {
			logger.warn('Signup failed: email already exists', { email });
			return res.status(400).json({ 
				success: false,
				error: 'Email already exists' 
			});
		}

		// Handle validation errors from PocketBase
		if (error.message.includes('validation')) {
			logger.warn('Signup failed: validation error', { email, errorMessage: error.message });
			return res.status(400).json({ 
				success: false,
				error: 'Invalid input data' 
			});
		}

		// For any other error, throw it so errorMiddleware catches it
		logger.error('Unexpected error during signup', { email, errorMessage: error.message });
		throw error;
	}
});

// POST /auth/login
router.post('/login', async (req, res) => {
	const { email, password } = req.body;

	logger.info('Login request received', { email });

	if (!email || !password) {
		logger.warn('Login validation failed: missing required fields', { email, hasPassword: !!password });
		return res.status(400).json({ 
			success: false,
			error: 'Email and password are required' 
		});
	}

	try {
		logger.info('Attempting to authenticate user', { email });
		const authData = await pb.collection('users').authWithPassword(email, password);

		logger.info('User logged in successfully', { userId: authData.record.id, email });

		res.json({
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
		logger.error('Login error', { 
			email, 
			errorMessage: error.message,
		});

		if (error.message.includes('Failed to authenticate')) {
			logger.warn('Login failed: invalid credentials', { email });
			return res.status(401).json({ 
				success: false,
				error: 'Invalid email or password' 
			});
		}

		logger.error('Unexpected error during login', { email, errorMessage: error.message });
		throw error;
	}
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
	try {
		logger.info('Logout request received');
		pb.authStore.clear();
		logger.info('User logged out successfully');
		res.json({ 
			success: true 
		});
	} catch (error) {
		logger.error('Logout error:', error.message);
		throw error;
	}
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
	const { email } = req.body;

	logger.info('Password reset request received', { email });

	if (!email) {
		logger.warn('Password reset validation failed: email is required');
		return res.status(400).json({ 
			success: false,
			error: 'Email is required' 
		});
	}

	try {
		logger.info('Attempting to send password reset email', { email });
		await pb.collection('users').requestPasswordReset(email);
		logger.info('Password reset email sent successfully', { email });
		// Don't expose whether email exists for security
		res.json({ 
			success: true,
			message: 'If an account exists with this email, a password reset link has been sent' 
		});
	} catch (error) {
		logger.error('Password reset error:', { 
			email, 
			errorMessage: error.message 
		});
		// Don't expose whether email exists for security
		res.json({ 
			success: true,
			message: 'If an account exists with this email, a password reset link has been sent' 
		});
	}
});

export default router;