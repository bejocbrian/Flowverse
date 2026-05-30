/// <reference path="../pb_data/types.d.ts" />

// Hide vendor-specific fields on the `videos` collection from end users.
//
// `external_id`  - the third-party provider's request UUID.
// `webhook_data` - the raw provider webhook/poll payload (provider CDN URLs,
//                  model names, credit usage, etc.).
//
// These are operational fields the backend needs, but they leak the upstream
// provider's identity if a normal (non-superuser) client reads the record
// directly via the PocketBase SDK. Marking them `hidden: true` strips them
// from non-superuser API responses.
//
// IMPORTANT: This is safe for all existing flows. The API server authenticates
// as a superuser, and PocketBase always returns/accepts hidden fields for
// superusers. So the generation worker (writes external_id/webhook_data), the
// /videos/:id/status active check (reads external_id), and the webhook lookup
// (filters on external_id) all continue to work unchanged. Stored data is not
// modified — only its visibility to non-superuser requests.
migrate((app) => {
	const collection = app.findCollectionByNameOrId('videos');
	if (!collection) return;

	['external_id', 'webhook_data'].forEach((fieldName) => {
		const field = collection.fields.getByName(fieldName);
		if (field && field.hidden !== true) {
			field.hidden = true;
			collection.fields.add(field);
		}
	});

	app.save(collection);
	console.log("Marked 'external_id' and 'webhook_data' as hidden on videos collection.");
}, (app) => {
	const collection = app.findCollectionByNameOrId('videos');
	if (!collection) return;

	['external_id', 'webhook_data'].forEach((fieldName) => {
		const field = collection.fields.getByName(fieldName);
		if (field && field.hidden !== false) {
			field.hidden = false;
			collection.fields.add(field);
		}
	});

	app.save(collection);
	console.log("Reverted 'external_id' and 'webhook_data' to visible on videos collection.");
});
