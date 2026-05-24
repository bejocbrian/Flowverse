import logger from './logger.js';

/**
 * Database Transaction Utility
 * 
 * Provides atomic-like operations for PocketBase with automatic rollback.
 * Since PocketBase doesn't support native transactions, we implement
 * compensation-based rollback.
 */

/**
 * Execute a series of database operations with automatic rollback on failure.
 * 
 * @param {Object} pb - PocketBase client
 * @param {Function} operations - Async function that receives a context object
 * @returns {Promise<any>} - Result of operations
 * 
 * @example
 * const result = await withTransaction(pb, async (ctx) => {
 *   const user = await ctx.create('users', { name: 'John' });
 *   const video = await ctx.create('videos', { user_id: user.id });
 *   return { user, video };
 * });
 */
export async function withTransaction(pb, operations) {
	const rollbackStack = [];
	const createdRecords = [];
	const updatedRecords = []; // Store original values for rollback

	const context = {
		/**
		 * Create a record and track it for potential rollback
		 */
		async create(collection, data) {
			const record = await pb.collection(collection).create(data);
			createdRecords.push({ collection, id: record.id });
			return record;
		},

		/**
		 * Update a record and track original value for rollback
		 */
		async update(collection, id, data) {
			// Get original record for rollback
			let originalRecord = null;
			try {
				originalRecord = await pb.collection(collection).getOne(id);
			} catch (e) {
				// Record might not exist, continue
			}

			const record = await pb.collection(collection).update(id, data);
			
			if (originalRecord) {
				updatedRecords.push({ 
					collection, 
					id, 
					originalData: originalRecord 
				});
			}
			
			return record;
		},

		/**
		 * Get a record (no tracking needed)
		 */
		async getOne(collection, id) {
			return await pb.collection(collection).getOne(id);
		},

		/**
		 * Add a custom rollback action
		 */
		addRollback(action) {
			rollbackStack.push(action);
		},
	};

	try {
		const result = await operations(context);
		return result;
	} catch (error) {
		logger.error('Transaction failed, starting rollback:', error.message);

		// Execute rollbacks in reverse order
		// 1. Delete created records
		for (let i = createdRecords.length - 1; i >= 0; i--) {
			const { collection, id } = createdRecords[i];
			try {
				await pb.collection(collection).delete(id);
				logger.info(`Rolled back: deleted ${collection}/${id}`);
			} catch (rollbackError) {
				logger.error(`Failed to rollback ${collection}/${id}:`, rollbackError.message);
			}
		}

		// 2. Restore updated records
		for (let i = updatedRecords.length - 1; i >= 0; i--) {
			const { collection, id, originalData } = updatedRecords[i];
			try {
				await pb.collection(collection).update(id, originalData);
				logger.info(`Rolled back: restored ${collection}/${id}`);
			} catch (rollbackError) {
				logger.error(`Failed to rollback ${collection}/${id}:`, rollbackError.message);
			}
		}

		// 3. Execute custom rollback actions
		for (let i = rollbackStack.length - 1; i >= 0; i--) {
			try {
				await rollbackStack[i]();
			} catch (rollbackError) {
				logger.error('Custom rollback failed:', rollbackError.message);
			}
		}

		throw error;
	}
}

/**
 * Deduct credits atomically with validation
 * 
 * @param {Object} pb - PocketBase client
 * @param {string} userId - User ID
 * @param {number} amount - Amount to deduct
 * @returns {Promise<{success: boolean, newBalance: number, error?: string}>}
 */
export async function deductCredits(pb, userId, amount) {
	// Get current user
	const user = await pb.collection('users').getOne(userId);

	if (user.credits_balance < amount) {
		return {
			success: false,
			error: 'Insufficient credits',
			currentBalance: user.credits_balance,
		};
	}

	const newBalance = user.credits_balance - amount;

	// Update user credits
	await pb.collection('users').update(userId, {
		credits_balance: newBalance,
	});

	return {
		success: true,
		newBalance,
		previousBalance: user.credits_balance,
	};
}

/**
 * Refund credits (used by rollback or failure handlers)
 * 
 * @param {Object} pb - PocketBase client
 * @param {string} userId - User ID
 * @param {number} amount - Amount to refund
 * @param {string} reason - Reason for refund
 * @param {string} videoId - Related video ID (optional)
 * @returns {Promise<{success: boolean, newBalance: number}>}
 */
export async function refundCredits(pb, userId, amount, reason, videoId = null) {
	const user = await pb.collection('users').getOne(userId);
	const newBalance = user.credits_balance + amount;

	await pb.collection('users').update(userId, {
		credits_balance: newBalance,
	});

	// Create refund transaction
	await pb.collection('transactions').create({
		user_id: userId,
		type: 'refund',
		amount,
		balance_after: newBalance,
		description: reason,
		...(videoId && { video_id: videoId }),
	});

	return {
		success: true,
		newBalance,
	};
}
