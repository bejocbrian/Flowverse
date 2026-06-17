import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import { creditCost as computeCreditCost } from '../utils/creditCalculator.js';
import { getEnabledModels, getVariantByKey } from '../constants/models.js';
import { withTransaction, refundCredits } from '../utils/dbTransaction.js';
import { processGeneration } from '../workers/generationProcessor.js';
import { sanitizePrompt, sanitizeNegativePrompt, validateResolution, validateAspectRatio } from '../utils/inputSanitizer.js';
import { VALIDATION } from '../constants/validation.js';

const router = Router();

router.use(pocketbaseAuth);

/**
 * Preview credit cost configuration
 */
const PREVIEW_COST = VALIDATION.PREVIEW_CREDIT_COST; // 5 credits
const PREVIEW_DURATION = VALIDATION.PREVIEW_DURATION; // 2 seconds
const PREVIEW_QUALITY = VALIDATION.PREVIEW_QUALITY; // 480p

/**
 * POST /preview - Generate a low-res preview before full generation
 * 
 * Request body:
 * {
 *   prompt: "video prompt",
 *   negative_prompt?: "",
 *   aspect_ratio: "16:9",
 *   model_key: "veo-3.1-fast"
 * }
 */
router.post('/', async (req, res) => {
  const { prompt, negative_prompt, aspect_ratio, model_key, ref_images, image_mode } = req.body;

  // Validate prompt
  let sanitizedPrompt;
  let sanitizedNegativePrompt;
  let sanitizedAspectRatio;
  
  try {
    sanitizedPrompt = sanitizePrompt(prompt);
    sanitizedNegativePrompt = sanitizeNegativePrompt(negative_prompt);
    sanitizedAspectRatio = validateAspectRatio(aspect_ratio);
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
    return res.status(400).json({ error: 'No available model for preview' });
  }

  try {
    // Atomic transaction for preview
    const result = await withTransaction(pb, async (ctx) => {
      // 1. Get current user to check credits
      const user = await ctx.getOne('users', req.pocketbaseUserId);

      if (user.credits_balance < PREVIEW_COST) {
        throw new Error('Insufficient credits for preview');
      }

      // 2. Deduct preview credits from user
      const newBalance = user.credits_balance - PREVIEW_COST;
      await ctx.update('users', req.pocketbaseUserId, {
        credits_balance: newBalance,
      });

      // 3. Create preview video record with "preview" status
      const video = await ctx.create('videos', {
        user_id: req.pocketbaseUserId,
        prompt: sanitizedPrompt,
        negative_prompt: sanitizedNegativePrompt,
        status: 'preview', // Special status for preview
        aspect_ratio: sanitizedAspectRatio,
        duration: PREVIEW_DURATION,
        quality: PREVIEW_QUALITY,
        provider: variant.provider.toLowerCase(),
        model: variant.id,
        model_key: variant.key,
        output_type: 'video',
        credit_cost: PREVIEW_COST,
        is_preview: true, // Flag for preview videos
        preview_confirmed: false,
        share_token: randomBytes(16).toString('hex'),
      });

      // 4. Create transaction record
      await ctx.create('transactions', {
        user_id: req.pocketbaseUserId,
        type: 'preview',
        amount: PREVIEW_COST,
        balance_after: newBalance,
        description: `Preview: ${sanitizedPrompt.substring(0, 30)}...`,
        video_id: video.id,
      });

      return { video, newBalance };
    });

    logger.info(`Preview created: ${result.video.id} for user ${req.pocketbaseUserId}`);

    // Start preview generation asynchronously (with override for short duration/low res)
    const previewVideo = {
      ...result.video,
      duration: PREVIEW_DURATION,
      quality: PREVIEW_QUALITY,
    };
    
    processGeneration(previewVideo, false).catch(error => {
      logger.error(`Preview generation failed for video ${result.video.id}:`, error.message);
    });

    res.json({
      preview: {
        id: result.video.id,
        status: 'preview',
        credit_cost: PREVIEW_COST,
        preview_duration: PREVIEW_DURATION,
        preview_quality: PREVIEW_QUALITY,
        created: result.video.created,
      },
      full_generation: {
        credit_cost: computeCreditCost({
          modelKey: variant.key,
          resolution: variant.credits['1080p'] ? '1080p' : Object.keys(variant.credits)[0],
          duration: variant.durations?.[0] || 8,
        }),
        estimated_duration: variant.durations?.[0] || 8,
      },
    });
  } catch (error) {
    logger.error('Preview creation error:', error.message);

    if (error.message === 'Insufficient credits for preview') {
      return res.status(400).json({ error: 'Insufficient credits for preview generation' });
    }

    return res.status(500).json({ error: error.message || 'Failed to create preview' });
  }
});

/**
 * POST /preview/:id/confirm - Confirm full generation after preview
 * 
 * Charges remaining credits and starts full generation
 */
router.post('/:id/confirm', async (req, res) => {
  const { id } = req.params;
  const { quality, duration } = req.body;

  try {
    const video = await pb.collection('videos').getOne(id);

    // Verify user owns this preview
    if (video.user_id !== req.pocketbaseUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Verify this is a preview
    if (!video.is_preview || video.status !== 'preview') {
      return res.status(400).json({ error: 'This is not a pending preview' });
    }

    // Check if already confirmed
    if (video.preview_confirmed) {
      return res.status(400).json({ error: 'Preview already confirmed' });
    }

    // Get model variant for pricing
    const variant = getVariantByKey(video.model_key);
    if (!variant) {
      return res.status(400).json({ error: 'Model not found' });
    }

    // Validate and get final quality/duration
    const finalQuality = quality || '1080p';
    const finalDuration = duration || variant.durations?.[0] || 8;

    // Calculate remaining credit cost (full cost - preview cost already paid)
    const fullCost = computeCreditCost({
      modelKey: variant.key,
      resolution: finalQuality,
      duration: finalDuration,
    });
    
    const remainingCost = fullCost - PREVIEW_COST;

    // Get user balance
    const user = await pb.collection('users').getOne(req.pocketbaseUserId);

    if (user.credits_balance < remainingCost) {
      return res.status(400).json({ 
        error: 'Insufficient credits for full generation',
        required: remainingCost,
        available: user.credits_balance,
        preview_credits: PREVIEW_COST,
      });
    }

    // Update video with full generation settings and charge remaining
    const newBalance = user.credits_balance - remainingCost;
    await pb.collection('users').update(req.pocketbaseUserId, {
      credits_balance: newBalance,
    });

    // Update video to full generation
    await pb.collection('videos').update(id, {
      status: 'queued',
      quality: finalQuality,
      duration: finalDuration,
      credit_cost: fullCost,
      is_preview: false,
      preview_confirmed: true,
    });

    // Create transaction for remaining charge
    await pb.collection('transactions').create({
      user_id: req.pocketbaseUserId,
      type: 'generation',
      amount: remainingCost,
      balance_after: newBalance,
      description: `Full generation (after preview): ${video.prompt.substring(0, 30)}...`,
      video_id: id,
    });

    // Start full generation
    const updatedVideo = await pb.collection('videos').getOne(id);
    processGeneration(updatedVideo, false).catch(error => {
      logger.error(`Full generation failed for video ${id}:`, error.message);
    });

    logger.info(`Preview confirmed for video ${id}, full generation started`);

    res.json({
      video: {
        id: video.id,
        status: 'queued',
        quality: finalQuality,
        duration: finalDuration,
        credit_cost: fullCost,
        preview_credits_paid: PREVIEW_COST,
        additional_credits_charged: remainingCost,
      },
    });
  } catch (error) {
    logger.error('Preview confirmation error:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Preview not found' });
    }
    throw error;
  }
});

/**
 * POST /preview/:id/cancel - Cancel preview without full generation
 * 
 * Preview credits are NOT refunded (user saw the preview)
 */
router.post('/:id/cancel', async (req, res) => {
  const { id } = req.params;

  try {
    const video = await pb.collection('videos').getOne(id);

    // Verify user owns this preview
    if (video.user_id !== req.pocketbaseUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Verify this is a preview
    if (!video.is_preview || video.status !== 'preview') {
      return res.status(400).json({ error: 'This is not a pending preview' });
    }

    // Mark as cancelled
    await pb.collection('videos').update(id, {
      status: 'cancelled',
      preview_confirmed: false,
    });

    logger.info(`Preview cancelled for video ${id}`);

    res.json({
      success: true,
      message: 'Preview cancelled. Preview credits are not refunded.',
      preview_credits_charged: PREVIEW_COST,
    });
  } catch (error) {
    logger.error('Preview cancellation error:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Preview not found' });
    }
    throw error;
  }
});

/**
 * GET /preview/:id - Get preview status
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const video = await pb.collection('videos').getOne(id);

    // Verify user owns this preview
    if (video.user_id !== req.pocketbaseUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Only return if this is a preview video
    if (!video.is_preview) {
      return res.status(400).json({ error: 'This is not a preview video' });
    }

    res.json({
      id: video.id,
      status: video.status,
      video_url: video.video_url,
      thumbnail_url: video.thumbnail_url,
      preview_confirmed: video.preview_confirmed,
      credit_cost: video.credit_cost,
      prompt: video.prompt,
    });
  } catch (error) {
    logger.error('Fetch preview error:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Preview not found' });
    }
    throw error;
  }
});

export default router;