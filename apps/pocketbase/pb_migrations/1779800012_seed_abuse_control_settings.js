/// <reference path="../pb_data/types.d.ts" />

// Seed the admin-configurable anti-abuse control settings. These back the
// "Abuse Controls" tab of the admin Settings page and are read by the API
// (utils/abuseSettings.js) to enforce:
//   - free_daily_generation_cap : max generations / 24h for free users
//   - paid_daily_generation_cap : max generations / 24h for paid users
//   - free_generation_rate_max  : max generations / burst window for free users
//
// Values are stored as JSON numbers. Idempotent: skips any key that already
// exists, so it is safe to run against an existing production DB.
migrate((app) => {
	const collection = app.findCollectionByNameOrId('settings');
	if (!collection) return;

	const seeds = [
		{ key: 'free_daily_generation_cap', value: 50 },
		{ key: 'paid_daily_generation_cap', value: 500 },
		{ key: 'free_generation_rate_max', value: 5 },
	];

	for (const seed of seeds) {
		// Skip if a record with this key already exists.
		let existing = null;
		try {
			existing = app.findFirstRecordByFilter('settings', `key = "${seed.key}"`);
		} catch (e) {
			existing = null; // not found — create path
		}
		if (existing) {
			console.log(`Setting '${seed.key}' already exists, skipping`);
			continue;
		}

		const record = new Record(collection);
		record.set('key', seed.key);
		record.set('value', seed.value);
		try {
			app.save(record);
			console.log(`Seeded setting '${seed.key}' = ${seed.value}`);
		} catch (e) {
			if (e.message.includes('Value must be unique')) {
				console.log(`Setting '${seed.key}' already exists (unique), skipping`);
			} else {
				throw e;
			}
		}
	}
}, (app) => {
	// Rollback: remove the three seeded settings if present.
	for (const key of ['free_daily_generation_cap', 'paid_daily_generation_cap', 'free_generation_rate_max']) {
		try {
			const record = app.findFirstRecordByFilter('settings', `key = "${key}"`);
			if (record) {
				app.delete(record);
			}
		} catch (e) {
			// not found — nothing to remove
		}
	}
})
