/// <reference path="../pb_data/types.d.ts" />
//
// PRODUCTION CLEAN SLATE
//
// Wipes all user-generated test data before go-live. Schema, settings, and
// providers are preserved. Superuser is NOT touched here — manage that via
// the PB_SUPERUSER_EMAIL/PASSWORD env vars (the create_superuser migration
// handles seeding on fresh boots).
//
// Collections cleared:
//   users, videos, transactions, shared_videos, favorites,
//   paytm_orders, prompt_history, integrated_ai_messages, integrated_ai_images
//
// IMPORTANT: This migration is intentionally NOT reversible (down does nothing).
// It is a one-time pre-launch operation. Once you go live and real users sign
// up, this migration has already run and will never run again (PocketBase
// tracks applied migrations).

const COLLECTIONS_TO_WIPE = [
	'transactions',       // must go before users (FK-like dependency in app logic)
	'shared_videos',
	'favorites',
	'paytm_orders',
	'videos',
	'prompt_history',
	'prompts',
	'integrated_ai_messages',
	'integrated_ai_images',
	'users',
];

migrate((app) => {
	for (const name of COLLECTIONS_TO_WIPE) {
		let collection;
		try {
			collection = app.findCollectionByNameOrId(name);
		} catch (e) {
			// Collection doesn't exist on this instance — skip silently.
			console.log(`clean-slate: collection "${name}" not found, skipping`);
			continue;
		}

		try {
			const records = app.findAllRecords(collection);
			let deleted = 0;
			for (const record of records) {
				try {
					app.delete(record);
					deleted++;
				} catch (delErr) {
					console.log(`clean-slate: could not delete ${name}/${record.id}: ${delErr.message}`);
				}
			}
			console.log(`clean-slate: deleted ${deleted} records from "${name}"`);
		} catch (e) {
			console.log(`clean-slate: error wiping "${name}": ${e.message}`);
		}
	}

	console.log('clean-slate: done. Database is ready for production launch.');
}, (_app) => {
	// No revert — this is a one-way pre-launch operation.
	console.log('clean-slate: revert is a no-op (intentional).');
});
