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
import { validateCatalog } from './utils/creditCalculator.js';

// Fail fast: a mispriced or misconfigured model variant must crash the server
// at boot rather than silently charge 0 or 404 a generation in production.
// validateCatalog is now async (reads from DB with hardcoded fallback).
const boot = async () => {
	try {
		await validateCatalog();
		logger.info('Model catalog validated');
	} catch (err) {
		logger.error('Model catalog validation failed:', err.message);
		throw err;
	}
};

await boot();

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

const server = app.listen(port, () => {
	logger.info(`API Server running on port ${port}`);
});

/* ------------------------------------------------------------------
 * Graceful shutdown
 * On SIGTERM (or SIGINT) we:
 *   1. Stop accepting new connections
 *   2. Wait up to 30 s for in-flight requests to finish
 *   3. Exit cleanly
 * ------------------------------------------------------------------*/
const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10);

let shuttingDown = false;

function gracefulShutdown(signal) {
	if (shuttingDown) return;
	shuttingDown = true;

	logger.info(`${signal} received — starting graceful shutdown (timeout: ${SHUTDOWN_TIMEOUT_MS}ms)`);

	// Stop accepting new connections
	server.close((err) => {
		if (err) {
			logger.error('Error during server close:', err.message);
		} else {
			logger.info('HTTP server closed — all connections drained');
		}
		process.exit(err ? 1 : 0);
	});

	// Force-exit if connections are still open after the timeout
	const forceTimer = setTimeout(() => {
		logger.error(`Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms — forcing exit`);
		process.exit(1);
	}, SHUTDOWN_TIMEOUT_MS);

	// Don't hold the process open for the timer itself
	if (forceTimer.unref) forceTimer.unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
