import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import { getGenerationStatus, GeminiGenStatus } from '../api/geminigen.js';
import { calculateCreditCost, getAllModelCosts, getModelCreditCost } from '../utils/creditCalculator.js';
import { withTransaction, refundCredits } from '../utils/dbTransaction.js';
import { processGeneration } from '../workers/generationProcessor.js';

const router = Router();

// GET /videos/credit-costs - Get all model credit costs (public endpoint)
router.get('/credit-costs', async (req, res) => {
	try {
		const costs = getAllModelCosts();
		res.json({
			creditsPerSecond: 2,
			qualityMultipliers: {
				'720p': 1,
				'1080p': 1.5,
			},
			modelCosts: costs,
		});
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
router.post('/', async (req, res) => {
	const { prompt, negative_prompt, aspect_ratio, duration, quality, provider, model, output_type } = req.body;

	if (!prompt || !provider || !model) {
		return res.status(400).json({ error: 'prompt, provider, and model are required' });
	}

	const isImage = output_type === 'image';
	const creditCost = calculateCreditCost({ quality, duration, isImage, model });

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

			// 3. Create video record with "queued" status
			const video = await ctx.create('videos', {
				user_id: req.pocketbaseUserId,
				prompt,
				negative_prompt: negative_prompt || '',
				status: 'queued',
				aspect_ratio: aspect_ratio || '16:9',
				duration: isImage ? 0 : (duration || 5),
				quality: quality || 'standard',
				provider,
				model,
				output_type: output_type || 'video',
				credit_cost: creditCost,
				share_token: randomBytes(16).toString('hex'),
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
				output_type: video.output_type || 'video',
				credit_cost: video.credit_cost,
				error_message: video.error_message,
				external_id: video.external_id,
				created: video.created,
				updated: video.updated,
			},
			relatedVideos: relatedVideos.items.map(v => ({
				id: v.id,
				prompt: v.prompt,
				status: v.status,
				video_url: v.video_url,
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
						? (genStatus.image_url || genStatus.video_url)
						: (genStatus.video_url || genStatus.image_url);

					await pb.collection('videos').update(id, {
						status: 'completed',
						video_url: mediaUrl || '',
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
			error_message: video.error_message,
			output_type: video.output_type || 'video',
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
router.delete('/:id', async (req, res) => {
	const { id } = req.params;

	try {
		const video = await pb.collection('videos').getOne(id);

		// Verify user owns this video
		if (video.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Forbidden' });
		}

		await pb.collection('videos').delete(id);
		logger.info(`Video deleted: ${id}`);

		res.json({ success: true });
	} catch (error) {
		logger.error('Delete video error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'Video not found' });
		}
		throw error;
	}
});

export default router;
