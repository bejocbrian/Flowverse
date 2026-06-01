import logger from '../utils/logger.js';

/**
 * GeminiGen API client for video and image generation.
 *
 * API Reference (from docs.geminigen.ai):
 *   Base URL:  https://api.geminigen.ai/uapi/v1
 *   Auth:      x-api-key header
 *   Format:    multipart/form-data
 *
 * Video endpoints:
 *   POST /video-gen/veo   — Veo models (veo-3.1, veo-3.1-fast, veo-2)
 *   POST /video-gen/sora  — Sora models (sora-2, sora-2-pro, sora-2-pro-hd)
 *
 * Image endpoint:
 *   POST /generate_image  — Image models (nano-banana-pro, nano-banana-2, imagen-4)
 *
 * History/polling:
 *   GET /history/{uuid}
 *
 * Status codes: 1 = Processing, 2 = Completed, 3 = Failed
 */

const API_BASE_URL = () => process.env.INTEGRATED_AI_API_URL || 'https://api.geminigen.ai/uapi/v1';
const API_KEY = () => process.env.INTEGRATED_AI_API_KEY;

/** GeminiGen status codes */
export const GeminiGenStatus = {
	PROCESSING: 1,
	COMPLETED: 2,
	FAILED: 3,
};

/** Retry configuration */
const RETRY_CONFIG = {
	maxRetries: 3,
	baseDelayMs: 1000,  // Start with 1 second
	maxDelayMs: 10000,  // Max 10 seconds
	retryableStatuses: [429, 500, 502, 503, 504], // Statuses worth retrying
};

/** Model → provider mapping for routing to the correct endpoint */
const MODEL_PROVIDER_MAP = {
	// Veo models → /video-gen/veo
	'veo-3.1': 'veo',
	'veo-3.1-fast': 'veo',
	'veo-3.1-lite': 'veo',
	'veo-2': 'veo',
	// Grok models → /video-gen/grok
	'grok-3': 'grok',
};

/**
 * Common headers for GeminiGen API requests
 */
function getHeaders() {
	return {
		'x-api-key': API_KEY(),
	};
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateDelay(attempt) {
	const delay = Math.min(
		RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
		RETRY_CONFIG.maxDelayMs
	);
	// Add jitter (±20%) to prevent thundering herd
	const jitter = delay * 0.2 * (Math.random() * 2 - 1);
	return Math.floor(delay + jitter);
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error, statusCode) {
	// Network errors
	if (error.cause?.code === 'ECONNRESET' || 
	    error.cause?.code === 'ETIMEDOUT' ||
	    error.cause?.code === 'ENOTFOUND') {
		return true;
	}
	
	// Rate limiting or server errors
	if (RETRY_CONFIG.retryableStatuses.includes(statusCode)) {
		return true;
	}
	
	return false;
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(endpoint, options, context = 'API') {
	let lastError = null;
	let lastStatusCode = null;

	for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
		try {
			const response = await fetch(endpoint, options);

			if (!response.ok) {
				lastStatusCode = response.status;
				const errorBody = await response.text().catch(() => 'Unknown error');
				
				// Check if we should retry
				if (attempt < RETRY_CONFIG.maxRetries && isRetryableError({ cause: {} }, response.status)) {
					const delay = calculateDelay(attempt);
					logger.warn(`${context} request failed (${response.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`);
					await sleep(delay);
					continue;
				}

				logger.error(`${context} API error: ${response.status} — ${errorBody}`);
				throw new Error(`${context} request failed (${response.status}): ${errorBody}`);
			}

			return response;
		} catch (error) {
			lastError = error;
			
			// Check if we should retry
			if (attempt < RETRY_CONFIG.maxRetries && isRetryableError(error, lastStatusCode)) {
				const delay = calculateDelay(attempt);
				logger.warn(`${context} request error: ${error.message}, retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`);
				await sleep(delay);
				continue;
			}

			throw error;
		}
	}

	throw lastError || new Error(`${context} request failed after ${RETRY_CONFIG.maxRetries} retries`);
}

/**
 * Submit a video generation request to GeminiGen.
 * Uses multipart/form-data as required by the API.
 *
 * @param {Object} params
 * @param {string} params.prompt - Text prompt for video generation
 * @param {string} [params.model='veo-3.1'] - Model id (veo-3.1, veo-3.1-fast, veo-3.1-lite, veo-2, grok-3)
 * @param {string} [params.resolution='720p'] - Resolution. Veo: 720p/1080p. Grok: 480p/720p.
 * @param {number} [params.duration=8] - Duration in seconds.
 * @param {string} [params.aspect_ratio='16:9'] - '16:9' | '9:16' (mapped to vendor vocab per provider)
 * @param {string} [params.mode_image] - Veo only: 'frame' (1-2 keyframes) or 'ingredient' (1-3 refs)
 * @param {string[]} [params.ref_image_urls] - Public URLs of reference images (already uploaded)
 * @returns {Promise<{uuid: string, status: number}>}
 */
export async function generateVideo({
	prompt,
	model = 'veo-3.1',
	resolution = '720p',
	duration = 8,
	aspect_ratio = '16:9',
	mode_image,
	ref_image_urls,
}) {
	const provider = MODEL_PROVIDER_MAP[model];
	if (!provider) {
		throw new Error(`Unknown video model: ${model}. Supported: ${Object.keys(MODEL_PROVIDER_MAP).join(', ')}`);
	}

	const refs = Array.isArray(ref_image_urls) ? ref_image_urls.filter(Boolean) : [];

	const form = new FormData();
	form.append('prompt', prompt);
	form.append('model', model);

	if (provider === 'veo') {
		form.append('resolution', resolution);
		form.append('duration', String(duration));
		form.append('aspect_ratio', aspect_ratio);
		if (refs.length > 0) {
			// Veo: ref_images accepts public URLs. mode_image selects how they
			// are used: 'frame' (start/end keyframes, max 2) or 'ingredient'
			// (subject/style references, max 3). Order matters for 'frame'.
			form.append('mode_image', mode_image === 'ingredient' ? 'ingredient' : 'frame');
			for (const url of refs) {
				form.append('ref_images', url);
			}
		}
	} else if (provider === 'grok') {
		form.append('resolution', resolution);
		form.append('duration', String(duration));
		// Grok uses descriptive aspect-ratio vocab instead of '16:9'/'9:16'.
		const grokAspect = aspect_ratio === '9:16' ? 'portrait' : 'landscape';
		form.append('aspect_ratio', grokAspect);
		form.append('mode', 'custom');
		if (refs.length > 0) {
			// Grok takes reference images via file_urls (public URLs). Only one
			// of files/file_urls/ref_images may be used per request; we always
			// use file_urls since we host the uploads ourselves.
			for (const url of refs) {
				form.append('file_urls', url);
			}
		}
	}

	const endpoint = `${API_BASE_URL()}/video-gen/${provider}`;
	logger.info(`GeminiGen video request: POST ${endpoint} model=${model} refs=${refs.length} mode=${mode_image || 'none'}`);

	const response = await fetchWithRetry(endpoint, {
		method: 'POST',
		headers: getHeaders(),
		body: form,
	}, 'GeminiGen video');

	const data = await response.json();
	logger.info(`GeminiGen video submitted: uuid=${data.uuid || data.id || 'unknown'}, status=${data.status}`);

	return {
		uuid: data.uuid || data.id || data.request_id,
		status: data.status,
		raw: data,
	};
}

/**
 * Extend an existing GeminiGen Veo video by its generation UUID.
 * POST /video-extend/veo with { prompt, ref_history }.
 * Model/aspect/resolution are inherited from the source video by the vendor.
 *
 * @param {Object} params
 * @param {string} params.prompt - What should happen in the continuation.
 * @param {string} params.ref_history - UUID of a video previously generated on GeminiGen.
 * @returns {Promise<{uuid: string, status: number}>}
 */
export async function extendVideo({ prompt, ref_history }) {
	if (!ref_history) {
		throw new Error('extendVideo requires ref_history (source video UUID)');
	}

	const form = new FormData();
	form.append('prompt', prompt);
	form.append('ref_history', ref_history);

	const endpoint = `${API_BASE_URL()}/video-extend/veo`;
	logger.info(`GeminiGen extend request: POST ${endpoint} ref_history=${ref_history}`);

	const response = await fetchWithRetry(endpoint, {
		method: 'POST',
		headers: getHeaders(),
		body: form,
	}, 'GeminiGen extend');

	const data = await response.json();
	logger.info(`GeminiGen extend submitted: uuid=${data.uuid || data.id || 'unknown'}, status=${data.status}`);

	return {
		uuid: data.uuid || data.id || data.request_id,
		status: data.status,
		raw: data,
	};
}

/**
 * Submit an image generation request to GeminiGen.
 * Uses multipart/form-data as required by the API.
 *
 * @param {Object} params
 * @param {string} params.prompt - Text prompt for image generation
 * @param {string} [params.model='nano-banana-pro'] - Model: nano-banana-pro, nano-banana-2, imagen-4
 * @param {string} [params.aspect_ratio='1:1'] - Aspect ratio: 1:1, 16:9, 9:16, 4:3, 3:4
 * @param {string} [params.output_format='jpeg'] - Output format: jpeg or png
 * @param {string} [params.resolution='1K'] - Resolution: 1K or 2K
 * @returns {Promise<{uuid: string, status: number, image_url?: string}>}
 */
export async function generateImage({
	prompt,
	model = 'nano-banana-pro',
	aspect_ratio = '1:1',
	output_format = 'jpeg',
	resolution = '1K',
}) {
	const form = new FormData();
	form.append('prompt', prompt);
	form.append('model', model);
	form.append('aspect_ratio', aspect_ratio);
	form.append('output_format', output_format);
	form.append('resolution', resolution);

	const endpoint = `${API_BASE_URL()}/generate_image`;
	logger.info(`GeminiGen image request: POST ${endpoint} model=${model}`);

	const response = await fetchWithRetry(endpoint, {
		method: 'POST',
		headers: getHeaders(),
		body: form,
	}, 'GeminiGen image');

	const data = await response.json();
	logger.info(`GeminiGen image submitted: uuid=${data.uuid || 'unknown'}`);

	return {
		uuid: data.uuid || data.id || data.request_id,
		status: data.status,
		image_url: data.generate_result || null,
		raw: data,
	};
}

/**
 * Fetch generation history/status from GeminiGen API (polling fallback).
 * GET /history/{conversion_uuid}
 *
 * Per GeminiGen docs the response shape includes:
 *   { id, uuid, status (1/2/3), status_desc, error_message,
 *     media_url, thumbnail_url,
 *     generated_video: [{ video_url, aspect_ratio }],
 *     generated_image: [{ image_url }] }
 *
 * `media_url` and `thumbnail_url` are the canonical fields once a generation
 * completes. The legacy `generated_video` / `generated_image` arrays are used
 * as fallbacks.
 *
 * @param {string} uuid - The generation request UUID
 * @returns {Promise<Object>}
 */
export async function getGenerationStatus(uuid) {
	const endpoint = `${API_BASE_URL()}/history/${uuid}`;

	const response = await fetchWithRetry(endpoint, {
		method: 'GET',
		headers: getHeaders(),
	}, 'GeminiGen status');

	const data = await response.json();

	const mediaUrl =
		data.media_url ||
		data.generated_video?.[0]?.video_url ||
		data.generated_image?.[0]?.image_url ||
		null;

	return {
		uuid: data.uuid,
		status: data.status,
		status_desc: data.status_desc,
		error_message: data.error_message,
		media_url: mediaUrl,
		thumbnail_url: data.thumbnail_url || null,
		// keep these for backwards compatibility with any caller still using them
		video_url: data.generated_video?.[0]?.video_url || mediaUrl || null,
		image_url: data.generated_image?.[0]?.image_url || (data.media_type === 'image' ? mediaUrl : null),
		raw: data,
	};
}
