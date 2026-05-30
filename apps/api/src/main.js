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
// Capture the raw request body bytes so webhook routes can verify HMAC
// signatures (Cashfree signs the raw payload, not the parsed JSON). We
// stash it for every request because the per-route URL check inside a
// body-parser `verify` callback is fragile - it depends on Content-Type
// matching the specific parser. Storing a Buffer reference is cheap.
const captureRawBody = (req, _res, buf) => {
	if (buf && buf.length) {
		req.rawBody = buf;
	}
};

app.use(express.json({ limit: BodyLimit, verify: captureRawBody }));
app.use(express.urlencoded({ extended: true, limit: BodyLimit, verify: captureRawBody }));
// Fallback parser: if Cashfree (or any webhook) sends a Content-Type that
// isn't JSON or urlencoded, the two parsers above won't run and rawBody
// would be missing. This raw parser catches everything else and still
// captures the bytes + leaves a Buffer on req.body.
app.use(express.raw({ type: () => true, limit: BodyLimit, verify: captureRawBody }));

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
