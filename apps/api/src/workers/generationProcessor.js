import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { generateVideo, generateImage, extendVideo, getGenerationStatus, GeminiGenStatus } from '../api/geminigen.js';
import { refundCredits } from '../utils/dbTransaction.js';
import { getVariantByKey, chainedClipCount, chainedClipDuration } from '../constants/models.js';
import { createTempDir, cleanupTempDir, downloadAndMerge } from '../utils/videoMerger.js';
import { readFile } from 'node:fs/promises';

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

			// Check if this is a chained (multi-clip) duration (e.g. Grok 20s = 2×10s clips).
			const variant = getVariantByKey(videoRecord.model_key || videoRecord.model);
			const requestedDuration = videoRecord.duration;
			const clipCount = chainedClipCount(variant, requestedDuration);

			if (clipCount > 1) {
				// --- CHAINED GENERATION ---
				// Generate clip 1, then extend N-1 more times, merge all clips.
				await processChainedGeneration(videoRecord, clipCount, refUrls);
				return; // chain handler updates record and returns
			}

			result = await generateVideo({
				prompt: videoRecord.prompt,
				model: videoRecord.model,
				aspect_ratio: videoRecord.aspect_ratio,
				duration: chainedClipDuration(variant, requestedDuration),
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

		// Translate known GeminiGen API error codes into user-friendly messages.
		const rawMessage = error.message || '';
		let userMessage = `Submission failed: ${rawMessage}`;

		if (rawMessage.includes('INVALID_VIDEO_LENGTH')) {
			userMessage = 'This video duration is not supported by the provider right now. Please try 6s or 10s.';
		} else if (rawMessage.includes('API_KEY_NOT_FOUND') || rawMessage.includes('401')) {
			userMessage = 'Generation service authentication failed. Please contact support.';
		} else if (rawMessage.includes('INSUFFICIENT_CREDITS')) {
			userMessage = 'Provider credits exhausted. Please contact support.';
		} else if (rawMessage.includes('CONTENT_POLICY')) {
			userMessage = 'Your prompt was rejected by the content policy. Please revise it and try again.';
		}

		// Mark as failed
		try {
			await pb.collection('videos').update(videoRecord.id, {
				status: 'failed',
				error_message: userMessage,
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

/**
 * Handle a chained (multi-clip) generation.
 *
 * Algorithm:
 *   1. Generate the first 10s clip normally.
 *   2. Poll until it's complete.
 *   3. For each additional clip (clipCount - 1): call extendVideo with the
 *      previous clip's UUID, poll until complete, collect the URL.
 *   4. Download all clip URLs and merge them via FFmpeg into one file.
 *   5. Upload the merged file to PocketBase and mark the record completed.
 *
 * If any step fails, credits are refunded and the record is marked failed.
 *
 * @param {Object}   videoRecord  - The video DB record (model, prompt, quality, etc.)
 * @param {number}   clipCount    - Total number of clips to chain (e.g. 2 for 20s).
 * @param {string[]} refUrls      - Reference image URLs for the first clip (if any).
 */
async function processChainedGeneration(videoRecord, clipCount, refUrls) {
	let tempDir = null;
	const clipUrls = [];

	try {
		// Each clip in the chain is 10s (the max the vendor accepts).
		const clipDuration = 10;

		// ------------------------------------------------------------------
		// CLIP 1: standard generation
		// ------------------------------------------------------------------
		logger.info(`Chained gen [1/${clipCount}]: submitting base clip for ${videoRecord.id}`);
		const baseResult = await generateVideo({
			prompt: videoRecord.prompt,
			model: videoRecord.model,
			aspect_ratio: videoRecord.aspect_ratio,
			duration: clipDuration,
			resolution: videoRecord.quality || '720p',
			mode_image: videoRecord.mode_image || undefined,
			ref_image_urls: refUrls,
		});

		// Store the first clip's UUID so status polling works for the user
		// while the full chain is being processed.
		await pb.collection('videos').update(videoRecord.id, { external_id: baseResult.uuid });
		logger.info(`Chained gen [1/${clipCount}]: base uuid=${baseResult.uuid}`);

		// Poll until the base clip is done
		const baseUrl = await pollUntilCompleteChain(baseResult.uuid, videoRecord.id, 1);
		clipUrls.push(baseUrl);
		logger.info(`Chained gen [1/${clipCount}]: base complete url=${baseUrl}`);

		// ------------------------------------------------------------------
		// CLIPS 2..N: extend from the previous clip
		// ------------------------------------------------------------------
		let prevUuid = baseResult.uuid;
		for (let i = 2; i <= clipCount; i++) {
			logger.info(`Chained gen [${i}/${clipCount}]: extending from uuid=${prevUuid}`);
			const extResult = await extendVideo({
				prompt: videoRecord.prompt,
				ref_history: prevUuid,
				model: videoRecord.model,
			});

			logger.info(`Chained gen [${i}/${clipCount}]: extension uuid=${extResult.uuid}`);
			const extUrl = await pollUntilCompleteChain(extResult.uuid, videoRecord.id, i);
			clipUrls.push(extUrl);
			prevUuid = extResult.uuid;
			logger.info(`Chained gen [${i}/${clipCount}]: clip complete url=${extUrl}`);
		}

		// ------------------------------------------------------------------
		// MERGE all clips into one video
		// ------------------------------------------------------------------
		logger.info(`Chained gen: merging ${clipUrls.length} clips for ${videoRecord.id}`);
		tempDir = await createTempDir();
		const mergedPath = await downloadAndMerge(clipUrls, tempDir);

		// ------------------------------------------------------------------
		// UPLOAD merged file to PocketBase
		// ------------------------------------------------------------------
		const mergedBuffer = await readFile(mergedPath);
		const formData = new FormData();
		const blob = new Blob([mergedBuffer], { type: 'video/mp4' });
		formData.append('merged_video', blob, `merged_${videoRecord.id}.mp4`);
		const uploadResponse = await pb.collection('videos').update(videoRecord.id, formData);

		const pbBaseUrl = process.env.POCKETBASE_URL;
		if (!pbBaseUrl) {
			logger.warn('POCKETBASE_URL not set — merged video URL will fall back to last clip URL');
		}
		const uploadedFilename = uploadResponse.merged_video;
		const mergedVideoUrl = (uploadedFilename && pbBaseUrl)
			? `${pbBaseUrl}/api/files/videos/${videoRecord.id}/${uploadedFilename}`
			: clipUrls[clipUrls.length - 1]; // fallback: last clip URL

		// ------------------------------------------------------------------
		// MARK completed
		// ------------------------------------------------------------------
		const totalDuration = clipCount * clipDuration;
		await pb.collection('videos').update(videoRecord.id, {
			status: 'completed',
			video_url: mergedVideoUrl,
			clip_urls: JSON.stringify(clipUrls),
			total_duration: totalDuration,
			completed_at: new Date().toISOString(),
		});

		logger.info(`Chained gen complete: ${videoRecord.id}, ${totalDuration}s, ${clipUrls.length} clips merged`);

	} catch (error) {
		logger.error(`Chained gen error for ${videoRecord.id}: ${error.message}`);

		const rawMessage = error.message || '';
		let userMessage = `Chained generation failed: ${rawMessage}`;
		if (rawMessage.includes('INVALID_VIDEO_LENGTH')) {
			userMessage = 'The provider rejected the clip duration. Please try a shorter duration.';
		} else if (rawMessage.includes('timed out')) {
			userMessage = 'Generation timed out — please try again.';
		}

		try {
			await pb.collection('videos').update(videoRecord.id, {
				status: 'failed',
				error_message: userMessage,
			});
		} catch (updateErr) {
			logger.error('Failed to mark chained gen as failed:', updateErr.message);
		}

		if (videoRecord.credit_cost) {
			try {
				await refundCredits(pb, videoRecord.user_id, videoRecord.credit_cost, 'Refund: Chained generation failed', videoRecord.id);
				logger.info(`Credits refunded for failed chained gen: ${videoRecord.id}`);
			} catch (refundErr) {
				logger.error('Chained gen refund error:', refundErr.message);
			}
		}
	} finally {
		if (tempDir) await cleanupTempDir(tempDir);
	}
}

/**
 * Poll GeminiGen for a single clip to complete and return its video URL.
 * Shared by all clips in the chain.
 *
 * @param {string} uuid      - GeminiGen generation UUID to poll.
 * @param {string} videoId   - Our DB record ID (logging only).
 * @param {number} clipIndex - Which clip in the chain (logging only).
 * @returns {Promise<string>} Public URL of the completed clip.
 */
async function pollUntilCompleteChain(uuid, videoId, clipIndex) {
	for (let attempt = 1; attempt <= POLLING_CONFIG.maxAttempts; attempt++) {
		await new Promise(resolve => setTimeout(resolve, POLLING_CONFIG.intervalMs));

		try {
			const status = await getGenerationStatus(uuid);
			logger.info(`Chained poll clip=${clipIndex} attempt=${attempt} for ${videoId}: status=${status.status}`);

			if (status.status === GeminiGenStatus.COMPLETED) {
				const url = status.video_url || status.media_url;
				if (!url) throw new Error(`Clip ${clipIndex} completed but returned no URL`);
				return url;
			}

			if (status.status === GeminiGenStatus.FAILED) {
				throw new Error(status.error_message || `Clip ${clipIndex} failed on provider side`);
			}
		} catch (err) {
			// Real failures propagate; transient network errors keep polling
			if (err.message.includes('failed on provider side') || err.message.includes('completed but returned no URL')) {
				throw err;
			}
			logger.warn(`Chained poll transient error clip=${clipIndex} attempt=${attempt} for ${videoId}: ${err.message}`);
		}
	}
	throw new Error(`Clip ${clipIndex} timed out after ${POLLING_CONFIG.maxAttempts} poll attempts`);
}
