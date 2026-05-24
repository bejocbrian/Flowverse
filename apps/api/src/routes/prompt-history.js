import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

router.use(pocketbaseAuth);

// GET /prompts/history - Get user's prompt history
router.get('/history', async (req, res) => {
	try {
		const prompts = await pb.collection('prompt_history').getList(1, 10, {
			filter: `user_id = "${req.pocketbaseUserId}"`,
			sort: '-created',
		});

		logger.info(`Fetched prompt history for user: ${req.pocketbaseUserId}`);

		res.json({
			prompts: prompts.items.map(prompt => ({
				id: prompt.id,
				prompt: prompt.prompt,
				negative_prompt: prompt.negative_prompt,
				model: prompt.model,
				created: prompt.created,
			})),
			totalItems: prompts.totalItems,
		});
	} catch (error) {
		logger.error('Fetch prompt history error:', error.message);
		throw error;
	}
});

// DELETE /prompts/:id - Delete prompt from history
router.delete('/:id', async (req, res) => {
	const { id } = req.params;

	try {
		const prompt = await pb.collection('prompt_history').getOne(id);

		// Verify user owns this prompt
		if (prompt.user_id !== req.pocketbaseUserId) {
			return res.status(403).json({ error: 'Forbidden' });
		}

		await pb.collection('prompt_history').delete(id);
		logger.info(`Prompt deleted: ${id}`);

		res.json({ success: true });
	} catch (error) {
		logger.error('Delete prompt error:', error.message);
		if (error.message.includes('not found')) {
			return res.status(404).json({ error: 'Prompt not found' });
		}
		throw error;
	}
});

export default router;
