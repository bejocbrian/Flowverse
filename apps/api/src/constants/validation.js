/**
 * Validation constants for API input validation
 */

export const VALIDATION = {
  // Prompt validation
  MAX_PROMPT_LENGTH: 2000,
  MIN_PROMPT_LENGTH: 1,
  
  // Negative prompt validation
  MAX_NEGATIVE_PROMPT_LENGTH: 1000,
  
  // Resolution options
  MAX_QUALITIES: ['480p', '720p', '1080p', '4k'],
  DEFAULT_QUALITY: '720p',
  
  // Aspect ratio options
  MAX_ASPECT_RATIOS: ['16:9', '9:16', '1:1', '4:3'],
  DEFAULT_ASPECT_RATIO: '16:9',
  
  // Duration options (seconds)
  MAX_DURATIONS: [5, 6, 8, 10, 15, 20],
  DEFAULT_DURATION: 8,
  MIN_DURATION: 1,
  MAX_DURATION: 30,
  
  // Output types
  OUTPUT_TYPES: ['video', 'image'],
  
  // Image modes for reference images
  IMAGE_MODES: ['frame', 'ingredient', 'reference', 'interpolation'],
  
  // Reference images
  MAX_REF_IMAGES_TOTAL: 10,
  MAX_REF_IMAGES_FRAME: 2,
  
  // Batch generation
  MAX_BATCH_SIZE: 5,
  MIN_BATCH_SIZE: 1,
  
  // Preview settings
  PREVIEW_DURATION: 2,
  PREVIEW_QUALITY: '480p',
  PREVIEW_CREDIT_COST: 5,
};

export default VALIDATION;