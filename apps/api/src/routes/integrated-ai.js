import { Router } from 'express';
import { ContentBlockType, stream, uploadImagesToPocketBase } from '../api/integrated-ai.js';
import { SystemPrompt } from '../constants/prompts.js';
import { uploadFiles } from '../middleware/file-upload.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(pocketbaseAuth);

router.post('/stream', integratedAiRateLimit, uploadFiles({
	allowedMimeTypes: [
		'image/jpeg',
		'image/png',
		'image/webp',
	],
	fieldName: 'images',
}), async (req, res) => {
	const { message } = req.body;

	if (!message) {
		return res.status(400).json({ error: 'message is required' });
	}

	let parsedMessage;
	try {
		parsedMessage = JSON.parse(message);
	} catch (parseError) {
		return res.status(400).json({ error: 'Invalid message format: must be valid JSON' });
	}

	// Track cleanup for SSE connection
	let sseStream = null;
	let isCleaningUp = false;

	const cleanup = () => {
		if (isCleaningUp) return;
		isCleaningUp = true;

		logger.info(`SSE cleanup for user ${req.pocketbaseUserId}`);

		if (sseStream) {
			sseStream.destroy();
			sseStream = null;
		}

		// Ensure response is ended
		if (res && !res.writableEnded) {
			res.end();
		}
	};

	try {
		if (req.files?.length > 0) {
			const imageUrls = await uploadImagesToPocketBase({ images: req.files });
			imageUrls.forEach((url) => {
				parsedMessage.push({ type: ContentBlockType.Image, image: url });
			});
		}

		sseStream = await stream({
			userId: req.pocketbaseUserId,
			systemPrompt: SystemPrompt,
			userMessage: parsedMessage,
		});

		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');
		res.setHeader('X-Accel-Buffering', 'no');

		// Handle stream errors
		sseStream.on('error', (err) => {
			logger.error(`SSE stream error for user ${req.pocketbaseUserId}:`, err.message);
			cleanup();
		});

		// Handle client disconnect - cleanup when response is closed
		res.on('close', () => {
			logger.info(`SSE connection closed for user ${req.pocketbaseUserId}`);
			cleanup();
		});

		// Pipe the stream to response
		sseStream.pipe(res, { end: false });

	} catch (error) {
		logger.error(`SSE initialization error for user ${req.pocketbaseUserId}:`, error.message);
		cleanup();
		
		// Only send error if headers haven't been sent
		if (!res.headersSent) {
			res.status(500).json({ error: 'Failed to initialize chat stream' });
		}
	}
});

export default router;