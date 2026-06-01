/// <reference path="../pb_data/types.d.ts" />
//
// Add image-to-video input fields to the `videos` collection:
//   - mode_image      (text) 'frame' | 'ingredient' (Veo); how ref images are used
//   - ref_image_urls  (text) JSON-encoded array of public reference-image URLs
//                            we uploaded to the _integratedAiImages store
//
// These let the generation worker pass reference images to GeminiGen. Hidden
// from end users (vendor-ish detail), same as external_id/webhook_data.
//
// Idempotent: safe to run more than once.
migrate((app) => {
	const collection = app.findCollectionByNameOrId('videos');
	if (!collection) {
		console.log('videos collection not found, skipping');
		return;
	}

	if (!collection.fields.getByName('mode_image')) {
		collection.fields.add(new TextField({ name: 'mode_image', required: false, max: 0, min: 0, hidden: true }));
	}
	if (!collection.fields.getByName('ref_image_urls')) {
		collection.fields.add(new TextField({ name: 'ref_image_urls', required: false, max: 0, min: 0, hidden: true }));
	}

	return app.save(collection);
}, (app) => {
	try {
		const collection = app.findCollectionByNameOrId('videos');
		collection.fields.removeByName('mode_image');
		collection.fields.removeByName('ref_image_urls');
		return app.save(collection);
	} catch (e) {
		if (e.message.includes('no rows in result set')) return;
		throw e;
	}
});
