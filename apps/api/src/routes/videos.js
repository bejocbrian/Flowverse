import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import { getGenerationStatus, GeminiGenStatus } from '../api/geminigen.js';
import { creditCost as computeCreditCost, variantPricingDisplay } from '../utils/creditCalculator.js';
import { getEnabledModels } from '../constants/models.js';
import { withTransaction, refundCredits } from '../utils/dbTransaction.js';
import { processGeneration } from '../workers/generationProcessor.js';
import { checkDailyGenerationCap } from '../utils/generationLimit.js';
import { freeUserGenerationRateLimit } from '../middleware/generation-rate-limit.js';
import { uploadRefImages } from '../utils/refImageUpload.js';
import { isPaidUser } from '../utils/userTier.js';
import { 
  sanitizePrompt, 
  sanitizeNegativePrompt, 
  validateResolution, 
  validateAspectRatio, 
  validateDuration,
  validateOutputType,
  validateImageMode,
  validateRefImageCount,
  validateIdempotencyKey
} from '../utils/inputSanitizer.js';

const router = Router();

// GET /videos/credit-costs - Per-model pricing for the picker (public).
// Catalog-driven; same data /models returns. Kept for backwards compat.
router.get('/credit-costs', async (_req, res) => {
	try {
		const modelCosts = {};
		for (const v of getEnabledModels()) {
			modelCosts[v.key] = { billing: v.billing, ...variantPricingDisplay(v) };
		}
		res.json({ modelCosts });
	} catch (error) {
		logger.error('Fetch credit costs error:', error.message);
		res.status(500).json({ error: 'Failed to fetch credit costs' });
	}
});

router.use(pocketbaseAuth);

// GET /videos - Fetch user's videos with pagination
router.get('/', async (req, res) => {
	const { page = 1, perPage = 10 } = req.query;

	try {
		const videos = await pb.collection('videos').getList(page, perPage, {
			filter: `user_id = "${req.pocketbaseUserId}"`,
			sort: '-created',
		});

		logger.info(`Fetched videos for user: ${req.pocketbaseUserId}`);

		res.json({
			items: videos.items.map(video => ({
				id: video.id,
				prompt: video.prompt,
				negative_prompt: video.negative_prompt,
				status: video.status,
				aspect_ratio: video.aspect_ratio,
				duration: video.duration,
				quality: video.quality,
				provider: video.provider,
				model: video.model,
				video_url: video.video_url,
				thumbnail_url: video.thumbnail_url,
				output_type: video.output_type || 'video',
				error_message: video.error_message,
				created: video.created,
				updated: video.updated,
			})),
			totalItems: videos.totalItems,
			totalPages: videos.totalPages,
			currentPage: videos.page,
		});
	} catch (error) {
		logger.error('Fetch videos error:', error.message);
		throw error;
	}
});

// POST /videos - Create video/image generation request and submit to GeminiGen
router.post('/', freeUserGenerationRateLimit, async (req, res) => {
	const { prompt, negative_prompt, aspect_ratio, duration, quality, provider, model, model_key, output_type, idempotency_key, image_mode, ref_images } = req.body;

	// Validate and sanitize required fields
	let sanitizedPrompt;
	let sanitizedNegativePrompt;
	let sanitizedAspectRatio;
	let sanitizedDuration;
	let sanitizedQuality;
	let sanitizedOutputType;
	let sanitizedIdempotencyKey;
	let sanitizedImageMode;
	
	try {
		sanitizedPrompt = sanitizePrompt(prompt);
		sanitizedNegativePrompt = sanitizeNegativePrompt(negative_prompt);
		sanitizedAspectRatio = validateAspectRatio(aspect_ratio);
		sanitizedDuration = validateDuration(duration);
		sanitizedQuality = validateResolution(quality);
		sanitizedOutputType = validateOutputType(output_type);
		sanitizedIdempotencyKey = validateIdempotencyKey(idempotency_key);
	} catch (validationError) {
		return res.status(400).json({ error: validationError.message });
	}

	if (!provider || !model) {
		return res.status(400).json({ error: 'provider and model are required' });
	}

	// Idempotency: if the same user re-submits the same key within 5 minutes,
	// return the existing video instead of creating a new charge. The key is
	// generated client-side per "intent to generate" - retrying a failed
	// network request reuses the key, two double-clicks reuse the key.
	if (sanitizedIdempotencyKey && typeof sanitizedIdempotencyKey === 'string' && sanitizedIdempotencyKey.length <= 100) {
		try {
			const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
			const existing = await pb.collection('videos').getList(1, 1, {
				filter: `user_id = "${req.pocketbaseUserId}" && idempotency_key = "${idempotency_key}" && created >= "${fiveMinutesAgo}"`,
			});

			if (existing.items.length > 0) {
				const v = existing.items[0];
				logger.info(`Idempotent replay: returning existing video ${v.id} for user ${req.pocketbaseUserId}`);
				return res.json({
					video: {
						id: v.id,
						prompt: v.prompt,
						negative_prompt: v.negative_prompt,
						status: v.status,
						aspect_ratio: v.aspect_ratio,
						duration: v.duration,
						quality: v.quality,
						provider: v.provider,
						model: v.model,
						output_type: v.output_type,
						credit_cost: v.credit_cost,
						created: v.created,
					},
					idempotent: true,
				});
			}
		} catch (idemErr) {
			// If the lookup fails for any reason (collection field not yet
			// migrated, etc.), fall through and proceed with a fresh create.
			logger.warn('Idempotency lookup failed, proceeding:', idemErr.message);
		}
	}

	const isImage = sanitizedOutputType === 'image';

	// Resolve the catalog variant. The picker sends `model_key`; older clients
	// may only send `model` (the vendor id) - fall back to the first enabled
	// variant with that id. Server is authoritative: only enabled+routed
	// models can be generated, and pricing comes from the catalog (never the
	// client), so a user can't select a disabled model or spoof a price.
	const enabled = getEnabledModels();
	let variant = null;
	if (model_key) {
		variant = enabled.find((m) => m.key === model_key) || null;
	}
	if (!variant) {
		variant = enabled.find((m) => m.id === model) || null;
	}
	if (!variant) {
		return res.status(400).json({ error: 'Unknown or unavailable model' });
	}

	// Model access tier: free users may only generate with models flagged
	// `freeAccess` (currently Veo 3.1 Lite). Everything else needs a purchase.
	// Both 720p and 1080p are allowed on the free model.
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
		creditCost = computeCreditCost({
			modelKey: variant.key,
			resolution: quality,
			duration,
		});
	} catch (priceErr) {
		logger.error(`Pricing error for ${variant.key}: ${priceErr.message}`);
		return res.status(400).json({ error: 'Could not price this generation' });
	}

	// Reference images (image-to-video). Validate against the model's declared
	// capabilities BEFORE uploading anything. `image_mode` is 'frame' (Veo
	// keyframes) | 'ingredient' (Veo refs) | 'reference' (Grok refs).
	let refImageUrls = [];
	let resolvedImageMode = null;
	if (!isImage && Array.isArray(ref_images) && ref_images.length > 0) {
		const supportedModes = Array.isArray(variant.imageModes) ? variant.imageModes : [];
		if (supportedModes.length === 0) {
			return res.status(400).json({ error: 'This model does not support reference images' });
		}
		// Validate image_mode against supported modes
		try {
			sanitizedImageMode = validateImageMode(image_mode, supportedModes);
		} catch (modeError) {
			return res.status(400).json({ error: modeError.message });
		}
		resolvedImageMode = sanitizedImageMode || supportedModes[0];

		// 'frame' allows at most 2 (start/end); everything else up to maxRefImages.
		const maxForMode = resolvedImageMode === 'frame' ? 2 : (variant.maxRefImages || 1);
		if (ref_images.length > maxForMode) {
			return res.status(400).json({
				error: `Too many images for ${resolvedImageMode} mode (max ${maxForMode})`,
			});
		}

		try {
			refImageUrls = await uploadRefImages(ref_images, maxForMode);
		} catch (upErr) {
			logger.warn(`Ref image upload failed for user ${req.pocketbaseUserId}: ${upErr.message}`);
			return res.status(400).json({ error: upErr.message || 'Invalid reference image' });
		}
	}

	// Anti-abuse: enforce a rolling 24h cap on how many generations a user can
	// submit. Placed AFTER the idempotency replay check above, so genuine
	// retries of an already-created generation are never counted against the
	// cap. Every generation hits a paid provider, and failed generations are
	// refunded, so this bounds the "submit → fail → refund → resubmit" loop
	// that a credit balance alone does not.
	const cap = await checkDailyGenerationCap({ userId: req.pocketbaseUserId });
	if (!cap.allowed) {
		logger.warn(`Daily generation cap hit for user ${req.pocketbaseUserId}: used=${cap.used}/${cap.cap} (paid=${cap.isPaid})`);
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
		// Use atomic transaction for credit deduction, video creation, and transaction record
		const result = await withTransaction(pb, async (ctx) => {
			// 1. Get current user to check credits
			const user = await ctx.getOne('users', req.pocketbaseUserId);

			if (user.credits_balance < creditCost) {
				throw new Error('Insufficient credits');
			}

			// 2. Deduct credits from user
			const newBalance = user.credits_balance - creditCost;
			await ctx.update('users', req.pocketbaseUserId, {
				credits_balance: newBalance,
			});

			// 3. Create video record with "queued" status (using sanitized values)
			const video = await ctx.create('videos', {
				user_id: req.pocketbaseUserId,
				prompt: sanitizedPrompt,
				negative_prompt: sanitizedNegativePrompt,
				status: 'queued',
				aspect_ratio: sanitizedAspectRatio,
				duration: isImage ? 0 : sanitizedDuration,
				quality: sanitizedQuality,
				provider,
				model,
				output_type: sanitizedOutputType,
				credit_cost: creditCost,
				share_token: randomBytes(16).toString('hex'),
				...(resolvedImageMode && { mode_image: resolvedImageMode }),
				...(refImageUrls.length > 0 && { ref_image_urls: JSON.stringify(refImageUrls) }),
				...(sanitizedIdempotencyKey && { idempotency_key: sanitizedIdempotencyKey }),
			});

			// 4. Create transaction record
			await ctx.create('transactions', {
				user_id: req.pocketbaseUserId,
				type: 'generation',
				amount: creditCost,
				balance_after: newBalance,
				description: `${isImage ? 'Image' : 'Video'} generation: ${prompt.substring(0, 50)}...`,
				video_id: video.id,
			});

			return { video, newBalance };
		});

		logger.info(`Generation record created for user: ${req.pocketbaseUserId}, cost: ${creditCost}`);

		// Start generation processing asynchronously
		processGeneration(result.video, isImage).catch(error => {
			logger.error(`Generation failed for video ${result.video.id}:`, error.message);
		});

		res.json({
			video: {
				id: result.video.id,
				prompt: result.video.prompt,
				negative_prompt: result.video.negative_prompt,
				status: result.video.status,
				aspect_ratio: result.video.aspect_ratio,
				duration: result.video.duration,
				quality: result.video.quality,
				provider: result.video.provider,
				model: result.video.model,
				output_type: result.video.output_type,
				credit_cost: result.video.credit_cost,
				created: result.video.created,
			},
		});
	} catch (error) {
		logger.error('Create video error:', error.message);
		
		// Handle specific error types
		if (error.message === 'Insufficient credits') {
			return res.status(400).json({ error: 'Insufficient credits' });
		}
		
		if (error.data && error.data.data) {
			logger.error('Validation errors:', JSON.stringify(error.data.data));
			return res.status(400).json({ error: 'Database validation failed', details: error.data.data });
		}
		
		return res.status(500).json({ error: error.message || 'Internal server error' });
	}
});

// GET /videos/:id - Fetch single video with related videos
router.get('/:id', async (req, res) => {
	const { id } = req.params;

	try {
		const video = await pb.collection('videos').getOne(id);

		// Verify user owns this video
		if (video.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Forbidden' });
		}

		// Fetch related videos (same model, different prompts)
		const relatedVideos = await pb.collection('videos').getList(1, 5, {
			filter: `user_id = "${req.pocketbaseUserId}" && id != "${id}" && model = "${video.model}"`,
			sort: '-created',
		});

		logger.info(`Fetched video: ${id}`);

		res.json({
			video: {
				id: video.id,
				prompt: video.prompt,
				negative_prompt: video.negative_prompt,
				status: video.status,
				aspect_ratio: video.aspect_ratio,
				duration: video.duration,
				quality: video.quality,
				provider: video.provider,
				model: video.model,
				video_url: video.video_url,
				thumbnail_url: video.thumbnail_url,
				output_type: video.output_type || 'video',
				credit_cost: video.credit_cost,
				error_message: video.error_message,
				created: video.created,
				updated: video.updated,
			},
			relatedVideos: relatedVideos.items.map(v => ({
				id: v.id,
				prompt: v.prompt,
				status: v.status,
				video_url: v.video_url,
				thumbnail_url: v.thumbnail_url,
				output_type: v.output_type || 'video',
				created: v.created,
			})),
		});
	} catch (error) {
		logger.error('Fetch video error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'Video not found' });
		}
		throw error;
	}
});

// GET /videos/:id/status - Quick status check (used by frontend polling)
// If video is still "generating" and has an external_id, actively check GeminiGen
router.get('/:id/status', async (req, res) => {
	const { id } = req.params;

	try {
		let video = await pb.collection('videos').getOne(id);

		if (video.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Forbidden' });
		}

		// Active check: if video is stuck in "generating", check GeminiGen directly
		if ((video.status === 'generating' || video.status === 'queued') && video.external_id) {
			try {
				const genStatus = await getGenerationStatus(video.external_id);
				logger.info(`Active status check for ${id}: GeminiGen status=${genStatus.status} (${genStatus.status_desc || ''})`);

				if (genStatus.status === GeminiGenStatus.COMPLETED) {
					const isImage = video.output_type === 'image';
					const mediaUrl = isImage
						? (genStatus.image_url || genStatus.media_url || genStatus.video_url)
						: (genStatus.video_url || genStatus.media_url || genStatus.image_url);
					// For images, fall back to the media url for the thumbnail.
					const thumbnailUrl = genStatus.thumbnail_url || (isImage ? mediaUrl : '');

					await pb.collection('videos').update(id, {
						status: 'completed',
						video_url: mediaUrl || '',
						thumbnail_url: thumbnailUrl || '',
						completed_at: new Date().toISOString(),
						webhook_data: JSON.stringify(genStatus.raw),
					});

					logger.info(`Generation completed via active check: ${id}`);
					video = await pb.collection('videos').getOne(id);
				} else if (genStatus.status === GeminiGenStatus.FAILED) {
					const errMsg = genStatus.error_message || 'Generation failed on provider side';
					await pb.collection('videos').update(id, {
						status: 'failed',
						error_message: errMsg,
						webhook_data: JSON.stringify(genStatus.raw),
					});

					// Refund credits using helper
					if (video.credit_cost) {
						try {
							await refundCredits(pb, video.user_id, video.credit_cost, `Refund: ${errMsg}`, video.id);
							logger.info(`Credits refunded via active check: ${id}`);
						} catch (refundErr) {
							logger.error('Refund error in active check:', refundErr.message);
						}
					}

					video = await pb.collection('videos').getOne(id);
				}
				// If still PROCESSING, just return current status
			} catch (checkError) {
				logger.warn(`Active GeminiGen check failed for ${id}: ${checkError.message}`);
				// Return current DB status if check fails
			}
		}

		res.json({
			id: video.id,
			status: video.status,
			video_url: video.video_url,
			thumbnail_url: video.thumbnail_url,
			error_message: video.error_message,
			output_type: video.output_type || 'video',
			aspect_ratio: video.aspect_ratio || '16:9',
		});
	} catch (error) {
		logger.error('Status check error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'Video not found' });
		}
		throw error;
	}
});

// DELETE /videos/:id - Delete video
// PocketBase delete rules already enforce user-scope, but we double-check
// here so the API can return clean error codes.
router.delete('/:id', async (req, res) => {
	const { id } = req.params;
	if (!req.pocketbaseUserId) {
		return res.status(401).json({ error: 'Authentication required' });
	}
	try {
		const video = await pb.collection('videos').getOne(id);
		if (video.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Forbidden' });
		}
		await pb.collection('videos').delete(id);
		logger.info(`Video deleted via API: ${id}`);
		return res.json({ success: true });
	} catch (error) {
		logger.error('Delete video error:', error.message);
		if (error?.status === 404 || (error?.message || '').includes('not found')) {
			return res.status(404).json({ error: 'Video not found' });
		}
		return res.status(500).json({ error: 'Failed to delete video' });
	}
});

export default router;
