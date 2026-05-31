import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import { generateVideo, generateImage } from '../api/geminigen.js';
import { checkDailyGenerationCap } from '../utils/generationLimit.js';
import { freeUserGenerationRateLimit } from '../middleware/generation-rate-limit.js';
import { creditCost as computeCreditCost } from '../utils/creditCalculator.js';
import { getEnabledModels } from '../constants/models.js';

const router = Router();

router.use(pocketbaseAuth);

// POST /videos/:id/regenerate - Regenerate video with variations
router.post('/:id/regenerate', freeUserGenerationRateLimit, async (req, res) => {
	const { id } = req.params;
	const {
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
				prompt: video.prompt,
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
