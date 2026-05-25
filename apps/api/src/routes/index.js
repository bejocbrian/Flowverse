import { Router } from 'express';
import healthCheck from './health-check.js';
import integratedAiRouter from './integrated-ai.js';
import authRouter from './auth.js';
import videosRouter from './videos.js';
import creditsRouter from './credits.js';
import usersRouter from './users.js';
import stripeRouter from './stripe.js';
import walletRouter from './wallet.js';
import webhooksRouter from './webhooks.js';
import settingsRouter from './settings.js';
import adminProvidersRouter from './admin-providers.js';
import adminUsersRouter from './admin-users.js';
import adminSettingsRouter from './admin-settings.js';
import adminAnalyticsRouter from './admin-analytics.js';
import videoSharingRouter from './video-sharing.js';
import videoFavoritesRouter from './video-favorites.js';
import promptHistoryRouter from './prompt-history.js';
import videoRegenerateRouter from './video-regenerate.js';

export default () => {
	const router = Router();

	router.get('/', (_req, res) => {
		res.json({ name: 'AetherVideo API', status: 'ok' });
	});

	router.get('/health', healthCheck);

	router.use('/auth', authRouter);
	router.use('/integrated-ai', integratedAiRouter);
	router.use('/videos', videosRouter);
	router.use('/videos', videoSharingRouter);
	router.use('/videos', videoFavoritesRouter);
	router.use('/videos', videoRegenerateRouter);
	router.use('/credits', creditsRouter);
	router.use('/users', usersRouter);
	router.use('/stripe', stripeRouter);
	router.use('/wallet', walletRouter);
	router.use('/webhooks', webhooksRouter);
	router.use('/settings', settingsRouter);
	router.use('/prompts', promptHistoryRouter);
	router.use('/admin/providers', adminProvidersRouter);
	router.use('/admin/users', adminUsersRouter);
	router.use('/admin/settings', adminSettingsRouter);
	router.use('/admin/analytics', adminAnalyticsRouter);

	return router;
};
