/**
 * SnapGen webhook handler.
 *
 * Reference (https://docs.snapgen.ai):
 *
 *   {
 *     "event": "VIDEO_GENERATION_COMPLETED",
 *     "uuid": "<event uuid for signature verification>",
 *     "data": {
 *       "uuid":            "<request uuid - matches our external_id>",
 *       "model_name":      "veo-2",
 *       "input_text":      "Dog is running",
 *       "used_credit":     60000,
 *       "status":          2,
 *       "status_percentage": 100,
 *       "error_message":   "",
 *       "media_url":       "https://....mp4",
 *       "thumbnail_url":   "https://cdn.snapgen.ai/.../uuid_0_200px.jpg",
 *       "created_at":      "...",
 *       "updated_at":      "..."
 *     }
 *   }
 *
 * Image webhooks omit `thumbnail_url` and use `media_url` for the image itself.
 *
 * Older field names (event_name/event_type, request_id, video_url, image_url) are
 * accepted as fallbacks in case the upstream sends a slightly different shape.
 */
import { Router } from 'express';
import { createHash, createVerify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { refundCredits } from '../utils/dbTransaction.js';

const router = Router();

const VIDEO_COMPLETED_EVENTS = new Set([
	'VIDEO_GENERATION_COMPLETED',
	'video.generated',
	'video.completed',
]);
const VIDEO_FAILED_EVENTS = new Set([
	'VIDEO_GENERATION_FAILED',
	'video.failed',
]);
const IMAGE_COMPLETED_EVENTS = new Set([
	'IMAGE_GENERATION_COMPLETED',
	'image.generated',
	'image.completed',
]);
const IMAGE_FAILED_EVENTS = new Set([
	'IMAGE_GENERATION_FAILED',
	'image.failed',
]);

router.post('/snapgen', async (req, res) => {
	try {
		const body = req.body || {};
		const event = body.event_name || body.event || body.event_type;
		const data = body.data || body.payload || body;
		// data.uuid is the request UUID we stored as external_id at submit time.
		const requestUuid = data?.uuid || body.request_id || body.uuid || data?.id;
		// event_uuid is the per-delivery UUID we sign against.
		const eventUuid = body.event_uuid || requestUuid;
		const signature = req.headers['x-signature'];

		if (process.env.SNAPGEN_WEBHOOK_PUBLIC_KEY_PATH && signature && eventUuid) {
			try {
				if (!verifySignature(eventUuid, signature)) {
					logger.warn('Webhook signature verification failed');
					return res.status(401).json({ error: 'Invalid signature' });
				}
			} catch (verifyError) {
				logger.warn('Webhook signature verification error:', verifyError.message);
				// fall through and process - signing is best-effort when no key is provisioned
			}
		}

		if (!event || !requestUuid) {
			return res.status(400).json({ error: 'Missing event or uuid' });
		}

		logger.info(`SnapGen webhook: ${event} request=${requestUuid}`);

		if (VIDEO_COMPLETED_EVENTS.has(event)) {
			await handleVideoCompleted(data, requestUuid);
		} else if (VIDEO_FAILED_EVENTS.has(event)) {
			await handleVideoFailed(data, requestUuid);
		} else if (IMAGE_COMPLETED_EVENTS.has(event)) {
			await handleImageCompleted(data, requestUuid);
		} else if (IMAGE_FAILED_EVENTS.has(event)) {
			await handleImageFailed(data, requestUuid);
		} else {
			logger.warn(`Unhandled webhook event: ${event}`);
		}

		// Always 200. We don't want SnapGen retrying delivery if our processing
		// errors - we have polling fallback for that.
		res.status(200).json({ received: true });
	} catch (error) {
		logger.error('Webhook processing error:', error.message);
		res.status(200).json({ received: true, error: error.message });
	}
});

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Find the video record we created when the user first submitted. */
async function findByExternalId(uuid) {
	const list = await pb.collection('videos').getList(1, 1, {
		filter: `external_id = "${uuid}"`,
	});
	return list.items[0] || null;
}

function pickMediaUrl(data) {
	return (
		data?.media_url ||
		data?.video_url ||
		data?.image_url ||
		data?.url ||
		data?.output_url ||
		''
	);
}

function pickThumbnailUrl(data) {
	return data?.thumbnail_url || data?.thumb_url || '';
}

/* -------------------------------------------------------------------------- */
/*  Video handlers                                                            */
/* -------------------------------------------------------------------------- */

async function handleVideoCompleted(data, uuid) {
	const video = await findByExternalId(uuid);
	if (!video) {
		logger.warn(`No video record for webhook uuid: ${uuid}`);
		return;
	}
	if (video.status === 'completed') {
		logger.info(`Video ${video.id} already completed, skipping webhook`);
		return;
	}

	await pb.collection('videos').update(video.id, {
		status: 'completed',
		video_url: pickMediaUrl(data),
		thumbnail_url: pickThumbnailUrl(data),
		completed_at: new Date().toISOString(),
		webhook_data: JSON.stringify(data),
	});

	logger.info(`Video completed: ${video.id}`);
}

async function handleVideoFailed(data, uuid) {
	const video = await findByExternalId(uuid);
	if (!video) {
		logger.warn(`No video record for webhook uuid: ${uuid}`);
		return;
	}
	if (video.status === 'failed' || video.status === 'completed') {
		logger.info(`Video ${video.id} already ${video.status}, skipping webhook`);
		return;
	}

	await pb.collection('videos').update(video.id, {
		status: 'failed',
		error_message: data?.error_message || data?.error || data?.message || 'Generation failed',
		webhook_data: JSON.stringify(data),
	});

	await refundCredits(pb, video.user_id, video.credit_cost || 0, 'Refund: Video generation failed', video.id);
	logger.info(`Video failed: ${video.id}`);
}

/* -------------------------------------------------------------------------- */
/*  Image handlers                                                            */
/* -------------------------------------------------------------------------- */

async function handleImageCompleted(data, uuid) {
	const record = await findByExternalId(uuid);
	if (!record) {
		logger.warn(`No record for image webhook uuid: ${uuid}`);
		return;
	}
	if (record.status === 'completed') {
		logger.info(`Image ${record.id} already completed, skipping`);
		return;
	}

	await pb.collection('videos').update(record.id, {
		status: 'completed',
		video_url: pickMediaUrl(data),
		// For images, the media URL serves as both source and thumbnail.
		thumbnail_url: pickThumbnailUrl(data) || pickMediaUrl(data),
		completed_at: new Date().toISOString(),
		webhook_data: JSON.stringify(data),
	});

	logger.info(`Image completed: ${record.id}`);
}

async function handleImageFailed(data, uuid) {
	const record = await findByExternalId(uuid);
	if (!record) {
		logger.warn(`No record for image webhook uuid: ${uuid}`);
		return;
	}
	if (record.status === 'failed' || record.status === 'completed') {
		logger.info(`Image ${record.id} already ${record.status}, skipping`);
		return;
	}

	await pb.collection('videos').update(record.id, {
		status: 'failed',
		error_message: data?.error_message || data?.error || data?.message || 'Image generation failed',
		webhook_data: JSON.stringify(data),
	});

	await refundCredits(pb, record.user_id, record.credit_cost || 0, 'Refund: Image generation failed', record.id);
	logger.info(`Image failed: ${record.id}`);
}

/* -------------------------------------------------------------------------- */
/*  Signature verification                                                    */
/* -------------------------------------------------------------------------- */

function verifySignature(eventUuid, signature) {
	try {
		const publicKeyPath = process.env.SNAPGEN_WEBHOOK_PUBLIC_KEY_PATH;
		if (!publicKeyPath) return true;

		const publicKey = readFileSync(publicKeyPath, 'utf-8');
		const md5Digest = createHash('md5').update(eventUuid, 'utf8').digest();

		const verify = createVerify('RSA-SHA256');
		verify.update(md5Digest);
		verify.end();

		return verify.verify(publicKey, Buffer.from(signature, 'hex'));
	} catch (error) {
		logger.error('Signature verification error:', error.message);
		return false;
	}
}

export default router;
