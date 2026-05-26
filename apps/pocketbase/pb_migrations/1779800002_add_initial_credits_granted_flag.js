/// <reference path="../pb_data/types.d.ts" />

// Tracks whether a user has been granted their initial free credits. The
// PocketBase hook (pb_hooks/grant-initial-credits.pb.js) only grants credits
// once, and only when the user is verified. This field prevents repeat grants
// if the verification flag flips back and forth somehow.
migrate((app) => {
	const collection = app.findCollectionByNameOrId('users');

	const existing = collection.fields.getByName('initial_credits_granted');
	if (existing) {
		return; // already added
	}

	collection.fields.add(new BoolField({
		name: 'initial_credits_granted',
		required: false,
	}));

	return app.save(collection);
}, (app) => {
	const collection = app.findCollectionByNameOrId('users');
	try { collection.fields.removeByName('initial_credits_granted'); } catch (_e) { /* ignore */ }
	return app.save(collection);
});
