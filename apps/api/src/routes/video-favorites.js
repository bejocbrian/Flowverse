import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

router.use(pocketbaseAuth);

// POST /videos/:id/favorite - Add to favorites
router.post('/:id/favorite', async (req, res) => {
	const { id } = req.params;

	try {
		const video = await pb.collection('videos').getOne(id);

		// Verify user owns this video
		if (video.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Forbidden' });
		}

		// Check if already favorited
		try {
			await pb.collection('favorites').getFirstListItem(
				`user_id = "${req.pocketbaseUserId}" && video_id = "${id}"`
			);
			return res.status(400).json({ error: 'Video already favorited' });
		} catch (error) {
			// Not found, continue
		}

		// Create favorite record
		await pb.collection('favorites').create({
			user_id: req.pocketbaseUserId,
			video_id: id,
		});

		// Update video is_favorite flag
		await pb.collection('videos').update(id, {
			is_favorite: true,
		});

		logger.info(`Video favorited: ${id}`);

		res.json({ success: true });
	} catch (error) {
		logger.error('Favorite video error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'Video not found' });
		}
		throw error;
	}
});

// DELETE /videos/:id/favorite - Remove from favorites
router.delete('/:id/favorite', async (req, res) => {
	const { id } = req.params;

	try {
		const video = await pb.collection('videos').getOne(id);

		// Verify user owns this video
		if (video.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Forbidden' });
		}

		// Find and delete favorite record
		const favorite = await pb.collection('favorites').getFirstListItem(
			`user_id = "${req.pocketbaseUserId}" && video_id = "${id}"`
		);
		await pb.collection('favorites').delete(favorite.id);

		// Update video is_favorite flag
		await pb.collection('videos').update(id, {
			is_favorite: false,
		});

		logger.info(`Video unfavorited: ${id}`);

		res.json({ success: true });
	} catch (error) {
		logger.error('Unfavorite video error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'Video not found' });
		}
		throw error;
	}
});

export default router;
