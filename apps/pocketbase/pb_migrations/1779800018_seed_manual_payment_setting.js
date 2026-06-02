/// <reference path="../pb_data/types.d.ts" />
//
// Seeds `manual_payment_enabled = true` in the settings collection.
//
// This is the DB-driven replacement for the old `PAYMENTS_DISABLED = true`
// hardcoded kill-switch in paymentMethods.js. When true, the wallet shows the
// manual UPI-QR + WhatsApp payment panel instead of automated gateways.
// Toggle it from Admin → Settings → Payments once your gateway is approved.
//
// Idempotent: safe to run more than once (skips if the key already exists).
migrate((app) => {
	try {
		// Check if setting already exists.
		app.findFirstRecordByFilter('settings', 'key = "manual_payment_enabled"');
		// Already exists — nothing to do.
		console.log('manual_payment_enabled setting already exists, skipping seed');
	} catch (e) {
		const notFound =
			(e?.message || '').includes('no rows') ||
			(e?.message || '').includes('not found');
		if (notFound) {
			const collection = app.findCollectionByNameOrId('settings');
			const record = new Record(collection);
			record.set('key', 'manual_payment_enabled');
			record.set('value', true);
			app.save(record);
			console.log('Seeded manual_payment_enabled = true');
		} else {
			throw e;
		}
	}
}, (app) => {
	try {
		const record = app.findFirstRecordByFilter('settings', 'key = "manual_payment_enabled"');
		app.delete(record);
	} catch (e) {
		// Already gone — fine.
	}
});
