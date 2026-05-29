import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import routes from './routes/index.js';
import { errorMiddleware } from './middleware/error.js';
import { globalRateLimit } from './middleware/global-rate-limit.js';
import logger from './utils/logger.js';
import { BodyLimit } from './constants/common.js';

const app = express();

app.set('trust proxy', true);

process.on('uncaughtException', (error) => {
	logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', () => {
	logger.info('Interrupted');
	process.exit(0);
});

process.on('SIGTERM', async () => {
	logger.info('SIGTERM signal received');
	await new Promise(resolve => setTimeout(resolve, 3000));
	logger.info('Exiting');
	process.exit();
});

// Build CORS config:
// - If CORS_ORIGIN is "*" we cannot use credentials:true (browsers reject it).
// - Comma-separated list lets you whitelist multiple frontends.
const rawOrigin = process.env.CORS_ORIGIN || '*';
const allowedOrigins = rawOrigin === '*'
	? '*'
	: rawOrigin.split(',').map(o => o.trim()).filter(Boolean);

app.use(helmet());
app.use(cors({
	origin: allowedOrigins === '*' ? true : allowedOrigins,
	credentials: allowedOrigins !== '*',
}));
app.use(morgan('combined'));
app.use(globalRateLimit);
// Stash the raw body bytes for webhook routes that require HMAC
// verification. We can't use a separate `raw()` parser per-route here
// because express.json runs first globally and would consume the stream.
app.use(express.json({
	limit: BodyLimit,
	verify: (req, _res, buf) => {
		if (req.originalUrl?.startsWith('/webhooks/cashfree')) {
			req.rawBody = buf;
		}
	},
}));
app.use(express.urlencoded({ extended: true, limit: BodyLimit }));

app.use('/', routes());

app.use(errorMiddleware);

app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
	logger.info(`API Server running on port ${port}`);
});

export default app;
