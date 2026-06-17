import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import { creditCost as computeCreditCost } from '../utils/creditCalculator.js';
import { getEnabledModels } from '../constants/models.js';
import { withTransaction, refundCredits } from '../utils/dbTransaction.js';
import { processGeneration } from '../workers/generationProcessor.js';
import { checkDailyGenerationCap } from '../utils/generationLimit.js';
import { isPaidUser } from '../utils/userTier.js';
import { sanitizePrompt, sanitizeNegativePrompt, validateResolution, validateAspectRatio, validateDuration, validateOutputType, validateBatchSize } from '../utils/inputSanitizer.js';
import { VALIDATION } from '../constants/validation.js';

const router = Router();

router.use(pocketbaseAuth);

/**
 * POST /batch - Create multiple video generations in a single request
 * 
 * Request body:
 * {
 *   prompts: [
 *     { prompt: "prompt1", negative_prompt?: "", ... },
 *     { prompt: "prompt2", ... }
 *   ],
 *   settings: {
 *     aspect_ratio: "16:9",
 *     duration: 8,
 *     quality: "720p",
 *     model_key: "veo-3.1-fast"
 *   }
 * }
 */
router.post('/', async (req, res) => {
  const { prompts, settings = {} } = req.body;

  // Validate batch size
  try {
    validateBatchSize(prompts);
  } catch (validationError) {
    return res.status(400).json({ error: validationError.message });
  }

  const {
    aspect_ratio,
    duration,
    quality,
    model_key,
    output_type = 'video'
  } = settings;

  // Validate and sanitize settings
  let sanitizedSettings;
  try {
    sanitizedSettings = {
      aspectRatio: validateAspectRatio(aspect_ratio),
      duration: validateDuration(duration),
      quality: validateResolution(quality),
      outputType: validateOutputType(output_type),
    };
  } catch (validationError) {
    return res.status(400).json({ error: validationError.message });
  }

  // Resolve model variant
  const enabled = getEnabledModels();
  let variant = null;
  if (model_key) {
    variant = enabled.find((m) => m.key === model_key) || null;
  }
  if (!variant) {
    variant = enabled.find((m) => m.enabled && m.routed) || null;
  }
  if (!variant) {
    return res.status(400).json({ error: 'No available model for batch generation' });
  }

  // Model access tier check
  if (!variant.freeAccess) {
    const paid = await isPaidUser(req.pocketbaseUserId).catch(() => false);
    if (!paid) {
      return res.status(403).json({
        error: 'This model is available for paid users only. Purchase credits to unlock all models.',
        code: 'MODEL_LOCKED',
      });
    }
  }

  // Calculate credit costs for each prompt
  const creditCosts = [];
  for (const promptData of prompts) {
    try {
      const cost = computeCreditCost({
        modelKey: variant.key,
        resolution: sanitizedSettings.quality,
        duration: sanitizedSettings.duration,
      });
      creditCosts.push(cost);
    } catch (priceErr) {
      return res.status(400).json({ error: `Could not price generation: ${priceErr.message}` });
    }
  }

  const totalCreditCost = creditCosts.reduce((sum, c) => sum + c, 0);

  // Sanitize all prompts
  const sanitizedPrompts = [];
  for (let i = 0; i < prompts.length; i++) {
    const promptData = prompts[i];
    try {
      sanitizedPrompts.push({
        prompt: sanitizePrompt(promptData.prompt),
        negativePrompt: sanitizeNegativePrompt(promptData.negative_prompt),
      });
    } catch (err) {
      return res.status(400).json({ 
        error: `Prompt ${i + 1}: ${err.message}` 
      });
    }
  }

  // Check daily generation cap (total count, not individual)
  const cap = await checkDailyGenerationCap({ userId: req.pocketbaseUserId });
  const totalNeeded = cap.used + prompts.length;
  if (totalNeeded > cap.cap) {
    return res.status(429).json({
      error: cap.isPaid
        ? `Daily generation limit would be exceeded (${cap.cap}/day). Please try again tomorrow.`
        : `Daily free generation limit would be exceeded (${cap.cap}/day). Purchase credits to raise your limit.`,
      code: 'DAILY_LIMIT_REACHED',
      cap: cap.cap,
      used: cap.used,
      requested: prompts.length,
    });
  }

  try {
    // Atomic transaction for entire batch
    const result = await withTransaction(pb, async (ctx) => {
      // 1. Get current user to check credits
      const user = await ctx.getOne('users', req.pocketbaseUserId);

      if (user.credits_balance < totalCreditCost) {
        throw new Error('Insufficient credits for batch');
      }

      // 2. Deduct total credits from user
      const newBalance = user.credits_balance - totalCreditCost;
      await ctx.update('users', req.pocketbaseUserId, {
        credits_balance: newBalance,
      });

      // 3. Create batch record
      const batch = await ctx.create('batches', {
        user_id: req.pocketbaseUserId,
        status: 'processing',
        total_videos: prompts.length,
        completed_videos: 0,
        failed_videos: 0,
        credit_cost: totalCreditCost,
      });

      // 4. Create video records for each prompt
      const videoRecords = [];
      for (let i = 0; i < sanitizedPrompts.length; i++) {
        const promptData = sanitizedPrompts[i];
        const video = await ctx.create('videos', {
          user_id: req.pocketbaseUserId,
          batch_id: batch.id,
          prompt: promptData.prompt,
          negative_prompt: promptData.negativePrompt,
          status: 'queued',
          aspect_ratio: sanitizedSettings.aspectRatio,
          duration: sanitizedSettings.outputType === 'image' ? 0 : sanitizedSettings.duration,
          quality: sanitizedSettings.quality,
          provider: variant.provider.toLowerCase(),
          model: variant.id,
          model_key: variant.key,
          output_type: sanitizedSettings.outputType,
          credit_cost: creditCosts[i],
          share_token: randomBytes(16).toString('hex'),
        });
        videoRecords.push(video);

        // 5. Create transaction record for each video
        await ctx.create('transactions', {
          user_id: req.pocketbaseUserId,
          type: 'generation',
          amount: creditCosts[i],
          balance_after: newBalance,
          description: `Batch #${batch.id.substring(0, 8)}: ${promptData.prompt.substring(0, 30)}...`,
          video_id: video.id,
          batch_id: batch.id,
        });
      }

      // 6. Create transaction for total batch deduction
      await ctx.create('transactions', {
        user_id: req.pocketbaseUserId,
        type: 'batch_charge',
        amount: totalCreditCost,
        balance_after: newBalance,
        description: `Batch generation: ${prompts.length} videos`,
        batch_id: batch.id,
      });

      return { batch, videoRecords, newBalance };
    });

    logger.info(`Batch created: ${result.batch.id} with ${prompts.length} videos for user ${req.pocketbaseUserId}`);

    // Start generation processing for each video asynchronously
    for (const video of result.videoRecords) {
      processGeneration(video, sanitizedSettings.outputType === 'image').catch(error => {
        logger.error(`Batch generation failed for video ${video.id}:`, error.message);
      });
    }

    res.json({
      batch: {
        id: result.batch.id,
        status: result.batch.status,
        total_videos: result.videoRecords.length,
        credit_cost: totalCreditCost,
        created: result.batch.created,
      },
      videos: result.videoRecords.map(v => ({
        id: v.id,
        prompt: v.prompt,
        status: v.status,
        credit_cost: v.credit_cost,
        created: v.created,
      })),
    });
  } catch (error) {
    logger.error('Batch creation error:', error.message);

    if (error.message === 'Insufficient credits for batch') {
      return res.status(400).json({ error: 'Insufficient credits for batch generation' });
    }

    return res.status(500).json({ error: error.message || 'Failed to create batch' });
  }
});

/**
 * GET /batch/:id - Get batch status with all videos
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const batch = await pb.collection('batches').getOne(id);

    // Verify user owns this batch
    if (batch.user_id !== req.pocketbaseUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get all videos in the batch
    const videos = await pb.collection('videos').getList(1, 100, {
      filter: `batch_id = "${id}"`,
      sort: 'created',
    });

    // Calculate completion stats
    const stats = {
      total: videos.items.length,
      completed: videos.items.filter(v => v.status === 'completed').length,
      failed: videos.items.filter(v => v.status === 'failed').length,
      generating: videos.items.filter(v => v.status === 'generating').length,
      queued: videos.items.filter(v => v.status === 'queued').length,
    };

    // Update batch status if needed
    if (batch.status === 'processing' && stats.completed + stats.failed === stats.total) {
      const newStatus = stats.failed === stats.total ? 'failed' : 'completed';
      await pb.collection('batches').update(id, { status: newStatus });
      batch.status = newStatus;
    }

    res.json({
      batch: {
        id: batch.id,
        status: batch.status,
        credit_cost: batch.credit_cost,
        created: batch.created,
        stats,
      },
      videos: videos.items.map(v => ({
        id: v.id,
        prompt: v.prompt,
        status: v.status,
        credit_cost: v.credit_cost,
        video_url: v.video_url,
        thumbnail_url: v.thumbnail_url,
        error_message: v.error_message,
        created: v.created,
      })),
    });
  } catch (error) {
    logger.error('Fetch batch error:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    throw error;
  }
});

/**
 * GET /batch - List user's batches
 */
router.get('/', async (req, res) => {
  const { page = 1, perPage = 10 } = req.query;

  try {
    const batches = await pb.collection('batches').getList(page, perPage, {
      filter: `user_id = "${req.pocketbaseUserId}"`,
      sort: '-created',
    });

    res.json({
      items: batches.items.map(b => ({
        id: b.id,
        status: b.status,
        total_videos: b.total_videos,
        credit_cost: b.credit_cost,
        created: b.created,
      })),
      totalItems: batches.totalItems,
      totalPages: batches.totalPages,
      currentPage: batches.page,
    });
  } catch (error) {
    logger.error('Fetch batches error:', error.message);
    throw error;
  }
});

export default router;