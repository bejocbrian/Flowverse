/// <reference path="../pb_data/types.d.ts" />
//
// Make Cashfree crediting exactly-once at the DATABASE level.
//
// Adds to `transactions`:
//   - description       (text)  human-readable audit; also used by the
//                               GeminiGen refund path in webhooks.js
//   - video_id          (text)  used by the refund path
//   - cashfree_order_id (text)  the idempotency key for paid Cashfree orders
//
// And a PARTIAL UNIQUE index on cashfree_order_id (unique only when the
// value is non-empty, so existing generation/refund rows with an empty
// value don't collide). This is the same pattern PocketBase uses for the
// users.email unique index. With this index, two concurrent credit attempts
// for the same order can never both succeed - the second insert is rejected
// by the database, making double-crediting impossible regardless of app
// timing or which path (webhook vs success-page) runs first.
//
// Idempotent: safe to run even if 1779800007 already added description/video_id.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('transactions');
  if (!collection) {
    console.log('transactions collection not found, skipping');
    return;
  }

  if (!collection.fields.getByName('description')) {
    collection.fields.add(new TextField({ name: 'description', required: false, max: 0, min: 0 }));
  }
  if (!collection.fields.getByName('video_id')) {
    collection.fields.add(new TextField({ name: 'video_id', required: false, max: 0, min: 0 }));
  }
  if (!collection.fields.getByName('cashfree_order_id')) {
    collection.fields.add(new TextField({ name: 'cashfree_order_id', required: false, max: 0, min: 0 }));
  }

  // Add a partial unique index if not already present.
  const indexName = 'idx_transactions_cashfree_order_id';
  const hasIndex = (collection.indexes || []).some((idx) => idx.includes(indexName));
  if (!hasIndex) {
    collection.indexes = [
      ...(collection.indexes || []),
      `CREATE UNIQUE INDEX \`${indexName}\` ON \`transactions\` (\`cashfree_order_id\`) WHERE \`cashfree_order_id\` != ''`,
    ];
  }

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('transactions');
    collection.indexes = (collection.indexes || []).filter(
      (idx) => !idx.includes('idx_transactions_cashfree_order_id'),
    );
    collection.fields.removeByName('cashfree_order_id');
    // Leave description/video_id in place on revert - other code relies on
    // them and 1779800007 owns their lifecycle.
    return app.save(collection);
  } catch (e) {
    if (e.message.includes('no rows in result set')) return;
    throw e;
  }
});
