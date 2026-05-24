import { Router } from 'express';
import { createHash, createVerify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

const router = Router();

// POST /webhooks/geminigen - Receive GeminiGen webhook callbacks
router.post('/geminigen', async (req, res) => {
	try {
		const signature = req.headers['x-signature'];
		const eventUuid = req.body?.uuid || req.body?.data?.id;

		// Optionally verify signature if public key is configured
		if (process.env.GEMINIGEN_WEBHOOK_PUBLIC_KEY_PATH && signature && eventUuid) {
			try {
				const isValid = verifySignature(eventUuid, signature);
				if (!isValid) {
					logger.warn('Webhook signature verification failed');
					return res.status(401).json({ error: 'Invalid signature' });
				}
			} catch (verifyError) {
				logger.warn('Webhook signature verification error:', verifyError.message);
				// Continue processing if verification fails due to missing key file
			}
		}

		const event = req.body.event || req.body.event_type;
		const data = req.body.data || req.body.payload || req.body;
		const uuid = req.body.uuid || req.body.request_id || req.body.id || data?.id;

		if (!event || !uuid) {
			return res.status(400).json({ error: 'Missing event or uuid' });
		}

		logger.info(`GeminiGen webhook received: ${event} (${uuid})`);

		switch (event) {
			case 'VIDEO_GENERATION_COMPLETED':
			case 'video.generated':
			case 'video.completed':
				await handleVideoCompleted(data, uuid);
				break;
			case 'VIDEO_GENERATION_FAILED':
			case 'video.failed':
				await handleVideoFailed(data, uuid);
				break;
			case 'IMAGE_GENERATION_COMPLETED':
			case 'image.generated':
			case 'image.completed':
				await handleImageCompleted(data, uuid);
				break;
			case 'IMAGE_GENERATION_FAILED':
			case 'image.failed':
				await handleImageFailed(data, uuid);
				break;
			default:
				logger.warn(`Unknown webhook event: ${event}`);
		}

		res.status(200).json({ received: true });
	} catch (error) {
		logger.error('Webhook processing error:', error.message);
		// Still return 200 to prevent retries for processing errors
		res.status(200).json({ received: true, error: error.message });
	}
});

/**
 * Handle completed video generation webhook
 */
async function handleVideoCompleted(data, uuid) {
	try {
		// Find the video record by external_id (the GeminiGen request ID)
		const videos = await pb.collection('videos').getList(1, 1, {
			filter: `external_id = "${uuid}"`,
		});

		if (videos.items.length === 0) {
			logger.warn(`No video found for webhook uuid: ${uuid}`);
			return;
		}

		const video = videos.items[0];

		// IDEMPOTENCY CHECK: Skip if already completed
		if (video.status === 'completed') {
			logger.info(`Video already completed, skipping webhook: ${video.id}`);
			return;
		}

		await pb.collection('videos').update(video.id, {
			status: 'completed',
			video_url: data?.video_url || data?.url || data?.output_url || '',
			completed_at: new Date().toISOString(),
			webhook_data: JSON.stringify(data),
		});

		logger.info(`Video generation completed: ${video.id}`);
	} catch (error) {
		logger.error('Handle video completed error:', error.message);
		throw error;
	}
}

/**
 * Handle failed video generation webhook
 */
async function handleVideoFailed(data, uuid) {
	try {
		const videos = await pb.collection('videos').getList(1, 1, {
			filter: `external_id = "${uuid}"`,
		});

		if (videos.items.length === 0) {
			logger.warn(`No video found for webhook uuid: ${uuid}`);
			return;
		}

		const video = videos.items[0];

		// IDEMPOTENCY CHECK: Skip if already failed or completed
		if (video.status === 'failed' || video.status === 'completed') {
			logger.info(`Video already ${video.status}, skipping webhook: ${video.id}`);
			return;
		}

		await pb.collection('videos').update(video.id, {
			status: 'failed',
			error_message: data?.error || data?.message || 'Generation failed',
			webhook_data: JSON.stringify(data),
		});

		// Refund credits on failure
		try {
			const user = await pb.collection('users').getOne(video.user_id);
			const newBalance = user.credits_balance + (video.credit_cost || 0);
			await pb.collection('users').update(video.user_id, {
				credits_balance: newBalance,
			});

			await pb.collection('transactions').create({
				user_id: video.user_id,
				type: 'refund',
				amount: video.credit_cost || 0,
				balance_after: newBalance,
				description: `Refund: Video generation failed`,
				video_id: video.id,
			});

			logger.info(`Credits refunded for failed video: ${video.id}`);
		} catch (refundError) {
			logger.error('Credit refund error:', refundError.message);
		}

		logger.info(`Video generation failed: ${video.id}`);
	} catch (error) {
		logger.error('Handle video failed error:', error.message);
		throw error;
	}
}

/**
 * Handle completed image generation webhook
 */
async function handleImageCompleted(data, uuid) {
	try {
		const videos = await pb.collection('videos').getList(1, 1, {
			filter: `external_id = "${uuid}"`,
		});

		if (videos.items.length === 0) {
			logger.warn(`No generation record found for webhook uuid: ${uuid}`);
			return;
		}

		const record = videos.items[0];

		// IDEMPOTENCY CHECK: Skip if already completed
		if (record.status === 'completed') {
			logger.info(`Image already completed, skipping webhook: ${record.id}`);
			return;
		}

		await pb.collection('videos').update(record.id, {
			status: 'completed',
			video_url: data?.image_url || data?.url || data?.output_url || '',
			completed_at: new Date().toISOString(),
			webhook_data: JSON.stringify(data),
		});

		logger.info(`Image generation completed: ${record.id}`);
	} catch (error) {
		logger.error('Handle image completed error:', error.message);
		throw error;
	}
}

/**
 * Handle failed image generation webhook
 */
async function handleImageFailed(data, uuid) {
	try {
		const videos = await pb.collection('videos').getList(1, 1, {
			filter: `external_id = "${uuid}"`,
		});

		if (videos.items.length === 0) {
			logger.warn(`No generation record found for webhook uuid: ${uuid}`);
			return;
		}

		const record = videos.items[0];

		// IDEMPOTENCY CHECK: Skip if already failed or completed
		if (record.status === 'failed' || record.status === 'completed') {
			logger.info(`Image already ${record.status}, skipping webhook: ${record.id}`);
			return;
		}

		await pb.collection('videos').update(record.id, {
			status: 'failed',
			error_message: data?.error || data?.message || 'Image generation failed',
			webhook_data: JSON.stringify(data),
		});

		// Refund credits on failure
		try {
			const user = await pb.collection('users').getOne(record.user_id);
			const newBalance = user.credits_balance + (record.credit_cost || 0);
			await pb.collection('users').update(record.user_id, {
				credits_balance: newBalance,
			});

			await pb.collection('transactions').create({
				user_id: record.user_id,
				type: 'refund',
				amount: record.credit_cost || 0,
				balance_after: newBalance,
				description: `Refund: Image generation failed`,
				video_id: record.id,
			});

			logger.info(`Credits refunded for failed image: ${record.id}`);
		} catch (refundError) {
			logger.error('Credit refund error:', refundError.message);
		}

		logger.info(`Image generation failed: ${record.id}`);
	} catch (error) {
		logger.error('Handle image failed error:', error.message);
		throw error;
	}
}

/**
 * Verify GeminiGen webhook signature (HMAC-SHA256 with public key)
 */
function verifySignature(eventUuid, signature) {
	try {
		const publicKeyPath = process.env.GEMINIGEN_WEBHOOK_PUBLIC_KEY_PATH;
		if (!publicKeyPath) {
			return true; // Skip verification if no key configured
		}

		const publicKey = readFileSync(publicKeyPath, 'utf-8');

		// Create MD5 hash of the event UUID
		const md5Hash = createHash('md5').update(eventUuid).digest();

		// Verify the signature using RSA-SHA256 with PKCS1v15 padding
		const verify = createVerify('RSA-SHA256');
		verify.update(md5Hash);
		verify.end();

		return verify.verify(publicKey, Buffer.from(signature, 'hex'));
	} catch (error) {
		logger.error('Signature verification error:', error.message);
		return false;
	}
}

export default router;
