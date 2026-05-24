import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

// POST /videos/:id/share - Create share token
router.post('/:id/share', pocketbaseAuth, async (req, res) => {
	const { id } = req.params;
	const { expiresIn } = req.body;

	try {
		const video = await pb.collection('videos').getOne(id);

		// Verify user owns this video
		if (video.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Forbidden' });
		}

		const shareToken = uuidv4();
		const expiresAt = expiresIn
			? new Date(Date.now() + expiresIn * 1000).toISOString()
			: null;

		// Create shared_videos record
		const sharedVideo = await pb.collection('shared_videos').create({
			video_id: id,
			share_token: shareToken,
			expires_at: expiresAt,
		});

		// Update video is_public flag
		await pb.collection('videos').update(id, {
			is_public: true,
		});

		logger.info(`Video shared: ${id}, token: ${shareToken}`);

		res.json({
			shareToken,
			shareUrl: `/videos/public/${shareToken}`,
			expiresAt,
		});
	} catch (error) {
		logger.error('Share video error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'Video not found' });
		}
		throw error;
	}
});

// GET /videos/public/:shareToken - Get shared video (no auth required)
router.get('/public/:shareToken', async (req, res) => {
	const { shareToken } = req.params;

	try {
		const sharedVideo = await pb.collection('shared_videos').getFirstListItem(`share_token = "${shareToken}"`);

		// Check if token is expired
		if (sharedVideo.expires_at) {
			const expiresAt = new Date(sharedVideo.expires_at);
			if (expiresAt < new Date()) {
				return res.status(410).json({ error: 'Share token has expired' });
			}
		}

		const video = await pb.collection('videos').getOne(sharedVideo.video_id);

		logger.info(`Accessed shared video: ${sharedVideo.video_id}`);

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
				created: video.created,
			},
		});
	} catch (error) {
		logger.error('Access shared video error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'Shared video not found' });
		}
		throw error;
	}
});

// POST /videos/:id/unshare - Remove share token
router.post('/:id/unshare', pocketbaseAuth, async (req, res) => {
	const { id } = req.params;

	try {
		const video = await pb.collection('videos').getOne(id);

		// Verify user owns this video
		if (video.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Forbidden' });
		}

		// Find and delete shared_videos record
		const sharedVideo = await pb.collection('shared_videos').getFirstListItem(`video_id = "${id}"`);
		await pb.collection('shared_videos').delete(sharedVideo.id);

		// Update video is_public flag
		await pb.collection('videos').update(id, {
			is_public: false,
		});

		logger.info(`Video unshared: ${id}`);

		res.json({ success: true });
	} catch (error) {
		logger.error('Unshare video error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'Video not found' });
		}
		throw error;
	}
});

export default router;
