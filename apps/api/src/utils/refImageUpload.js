import pb from './pocketbaseClient.js';
import logger from './logger.js';

/**
 * Reference-image upload helper for image-to-video generation.
 *
 * Why base64-in-JSON (not multipart): main.js installs a global
 * express.raw({ type: () => true }) body parser that consumes ANY request body
 * - including multipart - before multer could read it. So the generate route
 * accepts reference images as base64 data URLs in the JSON body. We decode
 * them here, store them in the existing public `_integratedAiImages` file
 * collection, and hand GeminiGen the resulting public URLs.
 */

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
// Per-image cap on the DECODED bytes. The JSON body limit (20MB) bounds the
// total request; this bounds a single image so a few images can't blow it.
const MAX_DECODED_BYTES = 8 * 1024 * 1024; // 8MB

/**
 * Parse a data URL ("data:image/png;base64,....") into { mime, buffer }.
 * Returns null if the string isn't a supported image data URL.
 */
function parseDataUrl(dataUrl) {
	if (typeof dataUrl !== 'string') return null;
	const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/s.exec(dataUrl.trim());
	if (!match) return null;
	const mime = match[1].toLowerCase();
	if (!ALLOWED_MIME.has(mime)) return null;
	let buffer;
	try {
		buffer = Buffer.from(match[2], 'base64');
	} catch {
		return null;
	}
	if (!buffer.length || buffer.length > MAX_DECODED_BYTES) return null;
	return { mime, buffer };
}

function publicUrlFor(record) {
	const url = pb.files.getURL(record, record.file);
	// In production the PocketBase origin isn't publicly reachable under its
	// internal URL; rewrite to the proxied platform path like the integrated-ai
	// uploader does. WEBSITE_DOMAIN is the public frontend domain.
	if (process.env.WEBSITE_DOMAIN) {
		return url.replace(
			/^https?:\/\/[^/]+/,
			`https://${process.env.WEBSITE_DOMAIN}/hcgi/platform`,
		);
	}
	return url;
}

/**
 * Upload up to `max` base64 reference images and return their public URLs in
 * the SAME ORDER they were given (important for Veo 'frame' start/end order).
 *
 * @param {string[]} dataUrls - array of base64 data URLs
 * @param {number} max - hard cap on how many to accept
 * @returns {Promise<string[]>} public URLs
 * @throws if any provided entry is not a valid/supported image
 */
export async function uploadRefImages(dataUrls, max) {
	if (!Array.isArray(dataUrls) || dataUrls.length === 0) return [];
	if (dataUrls.length > max) {
		throw new Error(`Too many reference images (max ${max})`);
	}

	const parsed = dataUrls.map(parseDataUrl);
	if (parsed.some((p) => p === null)) {
		throw new Error('Invalid reference image (must be JPEG/PNG/WebP under 8MB)');
	}

	const urls = [];
	for (const { mime, buffer } of parsed) {
		const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
		const formData = new FormData();
		const blob = new Blob([buffer], { type: mime });
		formData.append('file', blob, `ref_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
		const record = await pb.collection('_integratedAiImages').create(formData);
		urls.push(publicUrlFor(record));
	}

	logger.info(`uploadRefImages: stored ${urls.length} reference image(s)`);
	return urls;
}
