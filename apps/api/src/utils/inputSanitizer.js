/**
 * Input sanitization utilities for API requests
 */

import { VALIDATION } from '../constants/validation.js';

/**
 * Sanitize a prompt string
 * Trims whitespace and enforces max length
 * 
 * @param {string} prompt - The prompt to sanitize
 * @returns {string} - Sanitized prompt
 * @throws {Error} - If prompt is invalid or too long
 */
export function sanitizePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt is required');
  }
  
  const trimmed = prompt.trim();
  
  if (trimmed.length < VALIDATION.MIN_PROMPT_LENGTH) {
    throw new Error(`Prompt must be at least ${VALIDATION.MIN_PROMPT_LENGTH} character(s)`);
  }
  
  if (trimmed.length > VALIDATION.MAX_PROMPT_LENGTH) {
    throw new Error(`Prompt exceeds maximum length of ${VALIDATION.MAX_PROMPT_LENGTH} characters`);
  }
  
  return trimmed;
}

/**
 * Sanitize a negative prompt string
 * 
 * @param {string} negativePrompt - The negative prompt to sanitize
 * @returns {string} - Sanitized negative prompt
 * @throws {Error} - If negative prompt is too long
 */
export function sanitizeNegativePrompt(negativePrompt) {
  if (!negativePrompt || typeof negativePrompt !== 'string') {
    return '';
  }
  
  const trimmed = negativePrompt.trim();
  
  if (trimmed.length > VALIDATION.MAX_NEGATIVE_PROMPT_LENGTH) {
    throw new Error(`Negative prompt exceeds maximum length of ${VALIDATION.MAX_NEGATIVE_PROMPT_LENGTH} characters`);
  }
  
  return trimmed;
}

/**
 * Validate and normalize resolution
 * 
 * @param {string} quality - The resolution quality
 * @returns {string} - Normalized quality
 */
export function validateResolution(quality) {
  if (!quality) {
    return VALIDATION.DEFAULT_QUALITY;
  }
  
  const normalized = quality.toLowerCase();
  if (!VALIDATION.MAX_QUALITIES.includes(normalized)) {
    throw new Error(`Invalid resolution. Must be one of: ${VALIDATION.MAX_QUALITIES.join(', ')}`);
  }
  
  return normalized;
}

/**
 * Validate and normalize aspect ratio
 * 
 * @param {string} aspectRatio - The aspect ratio
 * @returns {string} - Normalized aspect ratio
 */
export function validateAspectRatio(aspectRatio) {
  if (!aspectRatio) {
    return VALIDATION.DEFAULT_ASPECT_RATIO;
  }
  
  const normalized = aspectRatio.toLowerCase();
  if (!VALIDATION.MAX_ASPECT_RATIOS.includes(normalized)) {
    throw new Error(`Invalid aspect ratio. Must be one of: ${VALIDATION.MAX_ASPECT_RATIOS.join(', ')}`);
  }
  
  return normalized;
}

/**
 * Validate duration - only basic numeric + range check.
 * Per-model duration validation happens after model resolution.
 * 
 * @param {number} duration - The duration in seconds
 * @param {Array} [allowedDurations] - Optional allowed durations for strict check
 * @returns {number} - Validated duration
 */
export function validateDuration(duration, allowedDurations = null) {
  if (!duration && duration !== 0) {
    return VALIDATION.DEFAULT_DURATION;
  }
  
  const parsed = parseInt(duration, 10);
  
  if (isNaN(parsed)) {
    throw new Error('Duration must be a number');
  }
  
  if (parsed < VALIDATION.MIN_DURATION || parsed > VALIDATION.MAX_DURATION) {
    throw new Error(`Duration must be between ${VALIDATION.MIN_DURATION} and ${VALIDATION.MAX_DURATION} seconds`);
  }
  
  // Only validate against allowed list if explicitly provided (per-model check)
  if (allowedDurations !== null && !allowedDurations.includes(parsed)) {
    throw new Error(`Invalid duration. Must be one of: ${allowedDurations.join(', ')}`);
  }
  
  return parsed;
}

/**
 * Validate output type
 * 
 * @param {string} outputType - The output type
 * @returns {string} - Normalized output type
 */
export function validateOutputType(outputType) {
  if (!outputType) {
    return 'video';
  }
  
  const normalized = outputType.toLowerCase();
  if (!VALIDATION.OUTPUT_TYPES.includes(normalized)) {
    throw new Error(`Invalid output type. Must be one of: ${VALIDATION.OUTPUT_TYPES.join(', ')}`);
  }
  
  return normalized;
}

/**
 * Validate image mode for reference images
 * 
 * @param {string} imageMode - The image mode
 * @param {Array} allowedModes - Allowed image modes for the model
 * @returns {string} - Validated image mode
 */
export function validateImageMode(imageMode, allowedModes = VALIDATION.IMAGE_MODES) {
  if (!imageMode) {
    return allowedModes[0] || null;
  }
  
  const normalized = imageMode.toLowerCase();
  if (!allowedModes.includes(normalized)) {
    throw new Error(`Invalid image mode. Must be one of: ${allowedModes.join(', ')}`);
  }
  
  return normalized;
}

/**
 * Validate reference image count
 * 
 * @param {Array} refImages - Array of reference images
 * @param {string} imageMode - The image mode
 * @param {number} maxRefImages - Maximum allowed reference images
 * @returns {number} - Validated image count
 */
export function validateRefImageCount(refImages, imageMode, maxRefImages = VALIDATION.MAX_REF_IMAGES_TOTAL) {
  if (!refImages || !Array.isArray(refImages)) {
    return 0;
  }
  
  const count = refImages.length;
  
  if (count > maxRefImages) {
    throw new Error(`Too many reference images. Maximum allowed: ${maxRefImages}`);
  }
  
  // Frame mode specifically allows only 2 (start/end frames)
  if (imageMode === 'frame' && count > VALIDATION.MAX_REF_IMAGES_FRAME) {
    throw new Error(`Frame mode allows maximum ${VALIDATION.MAX_REF_IMAGES_FRAME} images (start/end frames)`);
  }
  
  return count;
}

/**
 * Validate idempotency key
 * 
 * @param {string} key - The idempotency key
 * @returns {string} - Validated key
 */
export function validateIdempotencyKey(key) {
  if (!key) {
    return null;
  }
  
  if (typeof key !== 'string') {
    throw new Error('Idempotency key must be a string');
  }
  
  if (key.length > 100) {
    throw new Error('Idempotency key must be 100 characters or less');
  }
  
  return key;
}

/**
 * Validate batch size
 * 
 * @param {Array} prompts - Array of prompts
 * @returns {number} - Validated batch size
 */
export function validateBatchSize(prompts) {
  if (!prompts || !Array.isArray(prompts)) {
    throw new Error('Batch must contain an array of prompts');
  }
  
  const size = prompts.length;
  
  if (size < VALIDATION.MIN_BATCH_SIZE) {
    throw new Error(`Batch must contain at least ${VALIDATION.MIN_BATCH_SIZE} prompt(s)`);
  }
  
  if (size > VALIDATION.MAX_BATCH_SIZE) {
    throw new Error(`Batch cannot exceed ${VALIDATION.MAX_BATCH_SIZE} prompts`);
  }
  
  return size;
}

export default {
  sanitizePrompt,
  sanitizeNegativePrompt,
  validateResolution,
  validateAspectRatio,
  validateDuration,
  validateOutputType,
  validateImageMode,
  validateRefImageCount,
  validateIdempotencyKey,
  validateBatchSize,
};