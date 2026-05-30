/// <reference path="../pb_data/types.d.ts" />
//
// Add `description` and `video_id` text fields to the transactions
// collection. Multiple code paths already write these fields:
//   - cashfree-webhook.js: description "Cashfree order <id>" (idempotency
//     filter + create)
//   - webhooks.js refund path: description + video_id
// Without these columns, PocketBase rejects the create/filter with a
// generic error and credits/refunds silently fail.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('transactions');
  if (!collection) {
    console.log('transactions collection not found, skipping');
    return;
  }

  if (!collection.fields.getByName('description')) {
    collection.fields.add(new TextField({
      name: 'description',
      required: false,
      max: 0,
      min: 0,
    }));
  }

  if (!collection.fields.getByName('video_id')) {
    collection.fields.add(new TextField({
      name: 'video_id',
      required: false,
      max: 0,
      min: 0,
    }));
  }

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('transactions');
    collection.fields.removeByName('description');
    collection.fields.removeByName('video_id');
    return app.save(collection);
  } catch (e) {
    if (e.message.includes('no rows in result set')) return;
    throw e;
  }
});
