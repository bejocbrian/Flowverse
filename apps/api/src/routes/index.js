import { Router } from 'express';
import healthCheck from './health-check.js';
import integratedAiRouter from './integrated-ai.js';
import authRouter from './auth.js';
import videosRouter from './videos.js';
import creditsRouter from './credits.js';
import usersRouter from './users.js';
import stripeRouter from './stripe.js';
import cashfreeRouter from './cashfree.js';
import cashfreeWebhookRouter from './cashfree-webhook.js';
import paytmRouter from './paytm.js';
import paytmWebhookRouter from './paytm-webhook.js';
import walletRouter from './wallet.js';
import webhooksRouter from './webhooks.js';
import settingsRouter from './settings.js';
import modelsRouter from './models.js';
import userAnalyticsRouter from './user-analytics.js';
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
	router.use('/models', modelsRouter);
	router.use('/videos', videosRouter);
	router.use('/videos', videoSharingRouter);
	router.use('/videos', videoFavoritesRouter);
	router.use('/videos', videoRegenerateRouter);
	router.use('/credits', creditsRouter);
	router.use('/users', usersRouter);
	router.use('/users/me/analytics', userAnalyticsRouter);
	router.use('/stripe', stripeRouter);
	router.use('/cashfree', cashfreeRouter);
	router.use('/paytm', paytmRouter);
	router.use('/wallet', walletRouter);
	router.use('/webhooks', webhooksRouter);
	router.use('/webhooks', cashfreeWebhookRouter);
	router.use('/webhooks', paytmWebhookRouter);
	router.use('/settings', settingsRouter);
	router.use('/prompts', promptHistoryRouter);
	router.use('/admin/providers', adminProvidersRouter);
	router.use('/admin/users', adminUsersRouter);
	router.use('/admin/settings', adminSettingsRouter);
	router.use('/admin/analytics', adminAnalyticsRouter);

	return router;
};
