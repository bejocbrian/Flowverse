/// <reference path="../pb_data/types.d.ts" />

// Grant initial free credits ONLY when a user is verified for the first time.
//
// Flow:
//   1. /auth/signup creates the user with credits_balance=0, verified=false.
//   2. PocketBase emails a verification link (or OAuth providers mark the
//      user verified on first sign-in).
//   3. When the user clicks the link, PocketBase flips `verified` to true
//      and runs this hook.
//   4. We then top up credits and record a one-shot "bonus" transaction.
//
// Bots that can sign up but cannot verify get nothing.

const INITIAL_CREDITS = 10;

onRecordAfterUpdateSuccess((e) => {
	try {
		const record = e.record;

		if (!record.getBool('verified')) return e.next();
		if (record.getBool('initial_credits_granted')) return e.next();

		const userId = record.id;
		const currentBalance = record.getFloat('credits_balance') || 0;
		const newBalance = currentBalance + INITIAL_CREDITS;

		record.set('credits_balance', newBalance);
		record.set('initial_credits_granted', true);
		e.app.save(record);

		// Audit row in transactions.
		try {
			const txCol = e.app.findCollectionByNameOrId('transactions');
			const tx = new Record(txCol);
			tx.set('user_id', userId);
			tx.set('type', 'bonus');
			tx.set('amount', INITIAL_CREDITS);
			tx.set('balance_after', newBalance);
			tx.set('description', 'Welcome bonus on email verification');
			e.app.save(tx);
		} catch (txErr) {
			console.log('grant-initial-credits: tx insert failed:', txErr.message);
		}

		console.log(`grant-initial-credits: granted ${INITIAL_CREDITS} to ${userId}`);
	} catch (err) {
		console.log('grant-initial-credits: hook error:', err.message);
	}

	e.next();
}, 'users');
