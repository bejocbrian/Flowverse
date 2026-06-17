import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import { generateVideo, generateImage, extendVideo, getGenerationStatus, GeminiGenStatus } from '../api/geminigen.js';
import { checkDailyGenerationCap } from '../utils/generationLimit.js';
import { freeUserGenerationRateLimit } from '../middleware/generation-rate-limit.js';
import { creditCost as computeCreditCost } from '../utils/creditCalculator.js';
import { getEnabledModels } from '../constants/models.js';
import { isPaidUser } from '../utils/userTier.js';
import { refundCredits } from '../utils/dbTransaction.js';
import { createTempDir, cleanupTempDir, downloadAndMerge } from '../utils/videoMerger.js';
import { POLLING_CONFIG } from '../workers/generationProcessor.js';

const router = Router();

router.use(pocketbaseAuth);

// POST /videos/:id/regenerate - Regenerate video with a refined prompt or variations
router.post('/:id/regenerate', freeUserGenerationRateLimit, async (req, res) => {
	const { id } = req.params;
	const {
		prompt: newPrompt,          // optional: override the original prompt
		sameSettings = true,
		varyAspectRatio,
		varyDuration,
		varyQuality,
		variationCount = 1,
		idempotency_key,
	} = req.body;

	if (variationCount < 1 || variationCount > 5) {
		return res.status(400).json({ error: 'variationCount must be between 1 and 5' });
	}

	// Idempotency: same user + same key in last 5 minutes returns the
	// previously-created variations instead of charging again.
	if (idempotency_key && typeof idempotency_key === 'string' && idempotency_key.length <= 100) {
		try {
			const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
			const existing = await pb.collection('videos').getList(1, 5, {
				filter: `user_id = "${req.pocketbaseUserId}" && idempotency_key = "${idempotency_key}" && created >= "${fiveMinutesAgo}"`,
				sort: 'created',
			});

			if (existing.items.length > 0) {
				logger.info(`Idempotent regen replay for user ${req.pocketbaseUserId}: ${existing.items.length} videos`);
				return res.json({
					generationIds: existing.items.map(v => v.id),
					totalCost: existing.items.length,
					idempotent: true,
				});
			}
		} catch (idemErr) {
			logger.warn('Regen idempotency lookup failed:', idemErr.message);
		}
	}

	// Anti-abuse: rolling 24h generation cap. A regenerate call can create up
	// to `variationCount` new generations at once, so reserve that many slots.
	// Placed after the idempotency replay check so genuine retries are exempt.
	const cap = await checkDailyGenerationCap({ userId: req.pocketbaseUserId, requestedCount: variationCount });
	if (!cap.allowed) {
		logger.warn(`Daily generation cap hit on regenerate for user ${req.pocketbaseUserId}: used=${cap.used}/${cap.cap} requested=${cap.requested} (paid=${cap.isPaid})`);
		return res.status(429).json({
			error: cap.isPaid
				? `Daily generation limit reached (${cap.cap}/day). Please try again tomorrow.`
				: `Daily free generation limit reached (${cap.cap}/day). Purchase credits to raise your limit, or try again tomorrow.`,
			code: 'DAILY_LIMIT_REACHED',
			cap: cap.cap,
			used: cap.used,
		});
	}

	try {
		const video = await pb.collection('videos').getOne(id);

		// Verify user owns this video
		if (video.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Forbidden' });
		}

		const user = await pb.collection('users').getOne(req.pocketbaseUserId);
		const isImage = video.output_type === 'image';

		// Model access tier: regenerating reuses the source video's model, so a
		// free user could otherwise re-run a paid model. Gate it the same way as
		// fresh generation.
		const regenVariant =
			getEnabledModels().find((m) => m.id === video.model) || null;
		if (!regenVariant || !regenVariant.freeAccess) {
			const paid = await isPaidUser(req.pocketbaseUserId).catch(() => false);
			if (!paid) {
				return res.status(403).json({
					error: 'This model is available for paid users only. Purchase credits to unlock all models.',
					code: 'MODEL_LOCKED',
				});
			}
		}

		const generationIds = [];

		for (let i = 0; i < variationCount; i++) {
			let aspectRatio = video.aspect_ratio;
			let duration = video.duration;
			let quality = video.quality;

			if (!sameSettings) {
				if (varyAspectRatio) aspectRatio = varyAspectRatio;
				if (varyDuration) duration = varyDuration;
				if (varyQuality) quality = varyQuality;
			}

			const creditCost = (() => {
				// Resolve the catalog variant from the original video's vendor
				// id + resolution, then price via the single shared calculator.
				const enabled = getEnabledModels();
				const variant =
					enabled.find((m) => m.id === video.model && (m.credits?.[quality] != null || m.creditsPerSecond?.[quality] != null)) ||
					enabled.find((m) => m.id === video.model) ||
					null;
				if (!variant) {
					throw new Error('Unknown or unavailable model for regeneration');
				}
				return computeCreditCost({ modelKey: variant.key, resolution: quality, duration });
			})();

			if (user.credits_balance < creditCost) {
				return res.status(400).json({ error: 'Insufficient credits for all variations' });
			}

			// Create new video generation request
			const newVideo = await pb.collection('videos').create({
				user_id: req.pocketbaseUserId,
				// Use the caller's refined prompt if provided, else reuse the original.
				prompt: (newPrompt && typeof newPrompt === 'string' && newPrompt.trim().length >= 3)
					? newPrompt.trim()
					: video.prompt,
				negative_prompt: video.negative_prompt,
				status: 'queued',
				aspect_ratio: aspectRatio,
				duration,
				quality,
				provider: video.provider,
				model: video.model,
				output_type: video.output_type || 'video',
				credit_cost: creditCost,
				parent_video_id: id,
				share_token: randomBytes(16).toString('hex'),
				...(idempotency_key && { idempotency_key }),
			});

			generationIds.push(newVideo.id);

			// Deduct credits
			const newBalance = user.credits_balance - creditCost;
			await pb.collection('users').update(req.pocketbaseUserId, {
				credits_balance: newBalance,
			});

			user.credits_balance = newBalance;

			// Create transaction
			await pb.collection('transactions').create({
				user_id: req.pocketbaseUserId,
				type: 'generation',
				amount: creditCost,
				balance_after: newBalance,
				description: `Regeneration variation ${i + 1}: ${video.prompt.substring(0, 40)}...`,
				video_id: newVideo.id,
			});

			// Submit to GeminiGen API asynchronously
			submitToGeminiGen(newVideo, isImage).catch(error => {
				logger.error(`GeminiGen regen submission failed for ${newVideo.id}:`, error.message);
			});
		}

		logger.info(`Video regenerated: ${id}, variations: ${variationCount}`);

		res.json({
			generationIds,
			totalCost: generationIds.length,
		});
	} catch (error) {
		logger.error('Regenerate video error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'Video not found' });
		}
		throw error;
	}
});

/**
 * POST /videos/:id/extend - Extend a completed video with a follow-up clip.
 *
 * Uses GeminiGen's /video-extend/{provider} endpoint. After the new clip is
 * ready, it is concatenated with all previous clips (tracked in clip_urls)
 * via FFmpeg to produce a single merged video file. The merged file is stored
 * back to PocketBase and becomes the new video_url — so the user always sees
 * one growing video, not a collection of separate clips.
 *
 * The chain:
 *   original (clip_urls: [url1])
 *     → extend 1 (clip_urls: [url1, url2], video_url: merged_1+2)
 *     → extend 2 (clip_urls: [url1, url2, url3], video_url: merged_1+2+3)
 *     → ...up to ~15 clips (8s each ≈ 2 minutes total)
 *
 * external_id always tracks the LATEST GeminiGen clip UUID for the next call.
 */
router.post('/:id/extend', freeUserGenerationRateLimit, async (req, res) => {
	const { id } = req.params;
	const { prompt, idempotency_key } = req.body || {};

	if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
		return res.status(400).json({ error: 'A prompt describing the continuation is required' });
	}

	// Idempotency: same user + key in last 5 minutes returns the prior extend.
	if (idempotency_key && typeof idempotency_key === 'string' && idempotency_key.length <= 100) {
		try {
			const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
			const existing = await pb.collection('videos').getList(1, 1, {
				filter: `user_id = "${req.pocketbaseUserId}" && idempotency_key = "${idempotency_key}" && created >= "${fiveMinutesAgo}"`,
			});
			if (existing.items.length > 0) {
				return res.json({ video: { id: existing.items[0].id, status: existing.items[0].status }, idempotent: true });
			}
		} catch (idemErr) {
			logger.warn('Extend idempotency lookup failed:', idemErr.message);
		}
	}

	const cap = await checkDailyGenerationCap({ userId: req.pocketbaseUserId });
	if (!cap.allowed) {
		return res.status(429).json({
			error: cap.isPaid
				? `Daily generation limit reached (${cap.cap}/day). Please try again tomorrow.`
				: `Daily free generation limit reached (${cap.cap}/day). Purchase credits to raise your limit, or try again tomorrow.`,
			code: 'DAILY_LIMIT_REACHED',
			cap: cap.cap,
			used: cap.used,
		});
	}

	try {
		const source = await pb.collection('videos').getOne(id);
		if (source.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Forbidden' });
		}
		if (source.output_type === 'image') {
			return res.status(400).json({ error: 'Only videos can be extended' });
		}
		if (source.status !== 'completed') {
			return res.status(400).json({ error: 'Only completed videos can be extended' });
		}
		if (!source.external_id) {
			return res.status(400).json({ error: 'This video cannot be extended (no external ID)' });
		}

		// Resolve all existing clip URLs from the source video.
		// clip_urls is a JSON array stored on the video record.
		// For a brand-new (non-extended) video, clip_urls is empty so we seed it
		// from video_url. For already-extended videos, clip_urls holds every clip
		// including the original.
		let existingClipUrls = [];
		if (source.clip_urls) {
			try {
				const parsed = JSON.parse(source.clip_urls);
				if (Array.isArray(parsed) && parsed.length > 0) existingClipUrls = parsed;
			} catch { /* ignore */ }
		}
		if (existingClipUrls.length === 0 && source.video_url) {
			existingClipUrls = [source.video_url];
		}

		// Price the extend the same as a fresh generation of the source model.
		const enabled = getEnabledModels();
		const variant =
			enabled.find((m) => m.id === source.model && (m.credits?.[source.quality] != null || m.creditsPerSecond?.[source.quality] != null)) ||
			enabled.find((m) => m.id === source.model) ||
			null;
		if (!variant) {
			return res.status(400).json({ error: 'Source model is no longer available for extend' });
		}
		if (!variant.freeAccess) {
			const paid = await isPaidUser(req.pocketbaseUserId).catch(() => false);
			if (!paid) {
				return res.status(403).json({
					error: 'This model is available for paid users only. Purchase credits to unlock all models.',
					code: 'MODEL_LOCKED',
				});
			}
		}

		let creditCost;
		try {
			creditCost = computeCreditCost({ modelKey: variant.key, resolution: source.quality, duration: source.duration });
		} catch (priceErr) {
			logger.error(`Extend pricing error for ${variant.key}: ${priceErr.message}`);
			return res.status(400).json({ error: 'Could not price this extension' });
		}

		const user = await pb.collection('users').getOne(req.pocketbaseUserId);
		if (user.credits_balance < creditCost) {
			return res.status(400).json({ error: 'Insufficient credits' });
		}

		// Create a child video record representing the merged result-in-progress.
		const newVideo = await pb.collection('videos').create({
			user_id: req.pocketbaseUserId,
			prompt: prompt.trim(),
			status: 'queued',
			aspect_ratio: source.aspect_ratio,
			duration: source.duration,
			quality: source.quality,
			provider: source.provider,
			model: source.model,
			output_type: 'video',
			credit_cost: creditCost,
			parent_video_id: id,
			// Store existing clips so the merge worker knows all clips to concat.
			clip_urls: JSON.stringify(existingClipUrls),
			// total_duration tracks cumulative seconds of the merged video.
			total_duration: (source.total_duration || source.duration || 0),
			share_token: randomBytes(16).toString('hex'),
			...(idempotency_key && { idempotency_key }),
		});

		const newBalance = user.credits_balance - creditCost;
		await pb.collection('users').update(req.pocketbaseUserId, { credits_balance: newBalance });
		await pb.collection('transactions').create({
			user_id: req.pocketbaseUserId,
			type: 'generation',
			amount: creditCost,
			balance_after: newBalance,
			description: `Extend video: ${prompt.trim().substring(0, 40)}...`,
			video_id: newVideo.id,
		});

		// Fire-and-forget: generate new clip, merge with existing, update record.
		submitExtendAndMerge(newVideo, source.external_id, source.model, existingClipUrls).catch((error) => {
			logger.error(`Extend+merge failed for ${newVideo.id}:`, error.message);
		});

		logger.info(`Video extend queued: source=${id} -> ${newVideo.id}, cost=${creditCost}, existing_clips=${existingClipUrls.length}`);
		res.json({
			video: {
				id: newVideo.id,
				status: newVideo.status,
				credit_cost: creditCost,
				total_duration: newVideo.total_duration + source.duration,
			},
		});
	} catch (error) {
		logger.error('Extend video error:', error.message);
		if ((error?.message || '').includes('not found') || error?.status === 404) {
			return res.status(404).json({ error: 'Video not found' });
		}
		throw error;
	}
});

/**
 * Submit extend to GeminiGen, poll for the new clip, then merge all clips
 * into a single video file and upload it to PocketBase.
 *
 * @param {Object}   videoRecord       - The newly-created extend video DB record.
 * @param {string}   sourceUuid        - GeminiGen UUID of the latest clip (ref_history).
 * @param {string}   sourceModel       - Model ID for routing to the correct endpoint.
 * @param {string[]} existingClipUrls  - Ordered array of all prior clip URLs to prepend.
 */
async function submitExtendAndMerge(videoRecord, sourceUuid, sourceModel, existingClipUrls) {
	let tempDir = null;
	try {
		// 1. Submit the extend to GeminiGen
		await pb.collection('videos').update(videoRecord.id, { status: 'generating' });
		const result = await extendVideo({
			prompt: videoRecord.prompt,
			ref_history: sourceUuid,
			model: sourceModel,
		});

		const newClipUuid = result.uuid;

		// Store the new clip's UUID as external_id so the NEXT extend call uses it.
		await pb.collection('videos').update(videoRecord.id, { external_id: newClipUuid });
		logger.info(`Extend submitted: video=${videoRecord.id}, new_clip_uuid=${newClipUuid}`);

		// 2. Poll GeminiGen until the new clip is ready
		const newClipUrl = await pollUntilComplete(newClipUuid, videoRecord.id);

		// 3. Build the full ordered clip list: existing clips + new clip
		const allClipUrls = [...existingClipUrls, newClipUrl];

		// 4. Download all clips and merge into one file
		logger.info(`Merging ${allClipUrls.length} clips for video ${videoRecord.id}`);
		tempDir = await createTempDir();
		const mergedPath = await downloadAndMerge(allClipUrls, tempDir);

		// 5. Upload merged file to PocketBase as a video file field
		const mergedBuffer = await readFile(mergedPath);
		const formData = new FormData();
		const blob = new Blob([mergedBuffer], { type: 'video/mp4' });
		formData.append('merged_video', blob, `merged_${videoRecord.id}.mp4`);

		// Upload via PocketBase Files API — send as multipart to the videos record
		const uploadResponse = await pb.collection('videos').update(videoRecord.id, formData);

		// 6. Determine the public URL of the uploaded file
		// PocketBase returns the filename; we construct the public URL from it.
		const pbBaseUrl = process.env.POCKETBASE_URL || 'http://localhost:8090';
		const uploadedFilename = uploadResponse.merged_video;
		const mergedVideoUrl = uploadedFilename
			? `${pbBaseUrl}/api/files/videos/${videoRecord.id}/${uploadedFilename}`
			: null;

		// 7. Update the video record with the merged result
		const newTotalDuration = (videoRecord.total_duration || 0) + (videoRecord.duration || 0);
		await pb.collection('videos').update(videoRecord.id, {
			status: 'completed',
			video_url: mergedVideoUrl || newClipUrl, // fallback to new clip URL if upload failed
			clip_urls: JSON.stringify(allClipUrls),
			total_duration: newTotalDuration,
			completed_at: new Date().toISOString(),
		});

		logger.info(`Extend+merge complete: video=${videoRecord.id}, total_duration=${newTotalDuration}s, clips=${allClipUrls.length}`);

	} catch (error) {
		logger.error(`Extend+merge error for ${videoRecord.id}:`, error.message);

		const rawMessage = error.message || '';
		let userMessage = `Extension failed: ${rawMessage}`;
		if (rawMessage.includes('INVALID_VIDEO_LENGTH')) {
			userMessage = 'This video duration is not supported by the provider. Please try a shorter clip.';
		}

		try {
			await pb.collection('videos').update(videoRecord.id, {
				status: 'failed',
				error_message: userMessage,
			});
		} catch (updateErr) {
			logger.error('Failed to mark extend as failed:', updateErr.message);
		}

		// Refund credits
		if (videoRecord.credit_cost) {
			try {
				await refundCredits(pb, videoRecord.user_id, videoRecord.credit_cost, 'Refund: Extend failed', videoRecord.id);
				logger.info(`Credits refunded for failed extend: ${videoRecord.id}`);
			} catch (refundErr) {
				logger.error('Extend refund error:', refundErr.message);
			}
		}
	} finally {
		if (tempDir) await cleanupTempDir(tempDir);
	}
}

/**
 * Poll GeminiGen until a clip is complete, then return its video URL.
 * Uses the same timing config as generationProcessor.js.
 *
 * @param {string} uuid       - GeminiGen UUID to poll.
 * @param {string} videoId    - Our DB video ID (for logging).
 * @returns {Promise<string>} - Public URL of the completed clip.
 */
async function pollUntilComplete(uuid, videoId) {
	for (let attempt = 1; attempt <= POLLING_CONFIG.maxAttempts; attempt++) {
		await new Promise(resolve => setTimeout(resolve, POLLING_CONFIG.intervalMs));

		try {
			const status = await getGenerationStatus(uuid);
			logger.info(`Extend poll #${attempt} for ${videoId}: status=${status.status}`);

			if (status.status === GeminiGenStatus.COMPLETED) {
				const url = status.video_url || status.media_url;
				if (!url) throw new Error('GeminiGen returned completed status but no video URL');
				return url;
			}

			if (status.status === GeminiGenStatus.FAILED) {
				throw new Error(status.error_message || 'Extend clip generation failed on provider side');
			}
			// Status 1 = still processing, keep polling
		} catch (pollErr) {
			// Log transient errors but keep going unless it's a real failure
			if (pollErr.message.includes('failed on provider side')) throw pollErr;
			logger.warn(`Extend poll error (attempt ${attempt}) for ${videoId}: ${pollErr.message}`);
		}
	}
	throw new Error(`Extend clip timed out after ${POLLING_CONFIG.maxAttempts} attempts`);
}

/**
 * Submit regeneration to GeminiGen API (async, fire-and-forget)
 */
async function submitToGeminiGen(videoRecord, isImage) {
	try {
		await pb.collection('videos').update(videoRecord.id, { status: 'processing' });

		let result;

		if (isImage) {
			result = await generateImage({
				prompt: videoRecord.prompt,
				model: videoRecord.model,
				aspect_ratio: videoRecord.aspect_ratio,
				resolution: videoRecord.quality === '1080p' ? '2K' : '1K',
			});

			if (result.image_url) {
				await pb.collection('videos').update(videoRecord.id, {
					status: 'completed',
					video_url: result.image_url,
					external_id: result.uuid,
					completed_at: new Date().toISOString(),
				});
				return;
			}
		} else {
			result = await generateVideo({
				prompt: videoRecord.prompt,
				model: videoRecord.model,
				aspect_ratio: videoRecord.aspect_ratio,
				duration: videoRecord.duration,
				resolution: videoRecord.quality || '720p',
			});
		}

		await pb.collection('videos').update(videoRecord.id, {
			external_id: result.uuid,
		});

		logger.info(`Regen submitted: video=${videoRecord.id}, external_id=${result.uuid}`);
	} catch (error) {
		logger.error(`Regen submission error for ${videoRecord.id}:`, error.message);

		await pb.collection('videos').update(videoRecord.id, {
			status: 'failed',
			error_message: `Submission failed: ${error.message}`,
		});

		// Refund credits
		try {
			const user = await pb.collection('users').getOne(videoRecord.user_id);
			const newBalance = user.credits_balance + (videoRecord.credit_cost || 0);
			await pb.collection('users').update(videoRecord.user_id, {
				credits_balance: newBalance,
			});

			await pb.collection('transactions').create({
				user_id: videoRecord.user_id,
				type: 'refund',
				amount: videoRecord.credit_cost || 0,
				balance_after: newBalance,
				description: `Refund: Regeneration failed`,
				video_id: videoRecord.id,
			});
		} catch (refundError) {
			logger.error('Regen refund error:', refundError.message);
		}
	}
}

export default router;
