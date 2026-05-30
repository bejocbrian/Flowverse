import { Router } from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

router.use(pocketbaseAuth);

// GET /credits/balance - Get user's credit balance
router.get('/balance', async (req, res) => {
	if (!req.pocketbaseUserId) {
		return res.status(401).json({ error: 'Authentication required' });
	}
	try {
		const user = await pb.collection('users').getOne(req.pocketbaseUserId);
		logger.info(`Fetched balance for user: ${req.pocketbaseUserId}`);
		res.json({ balance: user.credits_balance });
	} catch (error) {
		logger.error('Fetch balance error:', error.message);
		throw error;
	}
});

// NOTE: The old POST /credits/purchase and POST /credits/deduct endpoints
// were REMOVED for security.
//
//  - /credits/purchase was a mock that granted credits for free with no
//    payment - any authenticated user could call it to top up their balance
//    without paying. Real purchases now go through Cashfree (/cashfree/*)
//    or Stripe (/stripe/*), credited only after the payment is verified.
//  - /credits/deduct was an unused manual endpoint. Real debits happen
//    atomically inside the generation flow (see routes/videos.js).
//
// Do not reintroduce client-callable balance-mutating endpoints. All credit
// changes must be tied to a verified payment or a server-side generation.

export default router;
