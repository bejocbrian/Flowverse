import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { generateVideo, generateImage, getGenerationStatus, GeminiGenStatus } from '../api/geminigen.js';
import { refundCredits } from '../utils/dbTransaction.js';

/**
 * Video Generation Processor
 * 
 * Handles video/image generation by submitting to GeminiGen API
 * and polling for completion.
 * 
 * Designed for shared hosting environments without Redis.
 */

// Configuration - all configurable via environment variables
const MAX_POLL_ATTEMPTS = parseInt(process.env.MAX_POLL_ATTEMPTS || '60', 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '10000', 10); // 10 seconds default

/**
 * Read integer from environment with fallback
 * @param {string} envName - Environment variable name
 * @param {number} fallback - Default value
 * @returns {number} Parsed integer value
 */
function readInt(envName, fallback) {
  const raw = process.env[envName];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Override with more specific environment variable support
const CUSTOM_MAX_POLL = readInt('GENERATION_MAX_POLL_ATTEMPTS', MAX_POLL_ATTEMPTS);
const CUSTOM_POLL_INTERVAL = readInt('GENERATION_POLL_INTERVAL_MS', POLL_INTERVAL_MS);

// Export for use in testing and monitoring
export const POLLING_CONFIG = {
  maxAttempts: CUSTOM_MAX_POLL,
  intervalMs: CUSTOM_POLL_INTERVAL,
  maxWaitTimeMs: CUSTOM_MAX_POLL * CUSTOM_POLL_INTERVAL,
};

/**
 * Process video generation
 * 
 * @param {Object} videoRecord - Video record from database
 * @param {boolean} isImage - Whether this is an image generation
 */
export async function processGeneration(videoRecord, isImage) {
	logger.info(`Processing generation for video ${videoRecord.id}`);

	try {
		// Update status to generating
		await pb.collection('videos').update(videoRecord.id, {
			status: 'generating',
		});

		let result;

		if (isImage) {
			result = await generateImage({
				prompt: videoRecord.prompt,
				model: videoRecord.model,
				aspect_ratio: videoRecord.aspect_ratio,
				resolution: videoRecord.quality === '1080p' ? '2K' : '1K',
			});

			// Image generation may return the URL directly
			if (result.image_url) {
				await pb.collection('videos').update(videoRecord.id, {
					status: 'completed',
					video_url: result.image_url,
					external_id: result.uuid,
					completed_at: new Date().toISOString(),
				});
				logger.info(`Image generated immediately: ${videoRecord.id}`);
				return;
			}
		} else {
			// Parse stored reference-image URLs (JSON array) if present.
			let refUrls = [];
			if (videoRecord.ref_image_urls) {
				try {
					const parsed = JSON.parse(videoRecord.ref_image_urls);
					if (Array.isArray(parsed)) refUrls = parsed.filter(Boolean);
				} catch {
					/* ignore malformed - treat as no refs */
				}
			}

			result = await generateVideo({
				prompt: videoRecord.prompt,
				model: videoRecord.model,
				aspect_ratio: videoRecord.aspect_ratio,
				duration: videoRecord.duration,
				resolution: videoRecord.quality || '720p',
				mode_image: videoRecord.mode_image || undefined,
				ref_image_urls: refUrls,
			});
		}

		// Store the external ID
		await pb.collection('videos').update(videoRecord.id, {
			external_id: result.uuid,
		});

		logger.info(`GeminiGen submitted: video=${videoRecord.id}, external_id=${result.uuid}`);

		// Poll GeminiGen for completion
		await pollForCompletionFallback(videoRecord, result.uuid, isImage);
	} catch (error) {
		logger.error(`GeminiGen submission error for ${videoRecord.id}:`, error.message);

		// Mark as failed
		try {
			await pb.collection('videos').update(videoRecord.id, {
				status: 'failed',
				error_message: `Submission failed: ${error.message}`,
			});
		} catch (updateErr) {
			logger.error('Failed to mark video as failed:', updateErr.message);
		}

		// Refund credits
		if (videoRecord.credit_cost) {
			try {
				await refundCredits(pb, videoRecord.user_id, videoRecord.credit_cost, 'Refund: Generation submission failed', videoRecord.id);
				logger.info(`Credits refunded for failed submission: ${videoRecord.id}`);
			} catch (refundError) {
				logger.error('Refund error:', refundError.message);
			}
		}
	}
}

/**
 * Poll GeminiGen for completion (fallback mode)
 */
async function pollForCompletionFallback(videoRecord, externalUuid, isImage) {
	for (let attempt = 1; attempt <= POLLING_CONFIG.maxAttempts; attempt++) {
		await new Promise(resolve => setTimeout(resolve, POLLING_CONFIG.intervalMs));

		try {
			const status = await getGenerationStatus(externalUuid);
			logger.info(`Poll #${attempt} for ${videoRecord.id}: status=${status.status} (${status.status_desc || ''})`);

			if (status.status === GeminiGenStatus.COMPLETED) {
				const mediaUrl = isImage
					? (status.image_url || status.video_url)
					: (status.video_url || status.image_url);

				await pb.collection('videos').update(videoRecord.id, {
					status: 'completed',
					video_url: mediaUrl || '',
					thumbnail_url: status.thumbnail_url || '',
					completed_at: new Date().toISOString(),
					webhook_data: JSON.stringify(status.raw),
				});

				logger.info(`Generation completed: ${videoRecord.id}`);
				return;
			}

			if (status.status === GeminiGenStatus.FAILED) {
				const errMsg = status.error_message || 'Generation failed on provider side';
				await pb.collection('videos').update(videoRecord.id, {
					status: 'failed',
					error_message: errMsg,
					webhook_data: JSON.stringify(status.raw),
				});

				// Refund credits
				if (videoRecord.credit_cost) {
					try {
						await refundCredits(pb, videoRecord.user_id, videoRecord.credit_cost, `Refund: ${errMsg}`, videoRecord.id);
						logger.info(`Credits refunded for provider failure: ${videoRecord.id}`);
					} catch (refundErr) {
						logger.error('Refund error during poll failure:', refundErr.message);
					}
				}

				logger.warn(`Generation failed: ${videoRecord.id} — ${errMsg}`);
				return;
			}

			// Continue polling
		} catch (pollError) {
			logger.warn(`Poll #${attempt} error for ${videoRecord.id}: ${pollError.message}`);
		}
	}

	// Timeout
	logger.error(`Polling timed out for ${videoRecord.id} after ${POLLING_CONFIG.maxAttempts} attempts (max wait: ${POLLING_CONFIG.maxWaitTimeMs}ms)`);
	await pb.collection('videos').update(videoRecord.id, {
		status: 'failed',
		error_message: 'Generation timed out — please try again',
	});

	// Refund on timeout
	if (videoRecord.credit_cost) {
		try {
			await refundCredits(pb, videoRecord.user_id, videoRecord.credit_cost, 'Refund: Generation timed out', videoRecord.id);
		} catch (refundErr) {
			logger.error('Refund error on timeout:', refundErr.message);
		}
	}
}
