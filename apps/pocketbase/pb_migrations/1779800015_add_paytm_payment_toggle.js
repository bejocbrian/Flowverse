/// <reference path="../pb_data/types.d.ts" />
//
// Seed the `payment_paytm_enabled` settings row. Default OFF: Paytm coexists
// with Stripe and Cashfree but stays disabled until an admin turns it on
// (and the PAYTM_* env vars are configured).
//
// Same try/save/catch idiom as 1779800005: the `key` field is unique, so a
// re-run skips without clobbering an admin's chosen value.
migrate((app) => {
	const collection = app.findCollectionByNameOrId('settings');
	if (!collection) return;

	const record = new Record(collection);
	record.set('key', 'payment_paytm_enabled');
	record.set('value', false);
	try {
		app.save(record);
	} catch (e) {
		if (e.message && e.message.includes('Value must be unique')) {
			// Already seeded - leave the admin's value untouched.
			return;
		}
		throw e;
	}
}, (app) => {
	// No revert: don't nuke an admin's saved preference.
});
