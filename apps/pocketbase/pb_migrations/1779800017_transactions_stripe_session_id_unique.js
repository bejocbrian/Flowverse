/// <reference path="../pb_data/types.d.ts" />
//
// Make Stripe crediting exactly-once at the DATABASE level - the same pattern
// used for Cashfree (1779800008) and Paytm (1779800014).
//
// Adds `stripe_session_id` (text) to `transactions` and a PARTIAL UNIQUE index
// on it (unique only when non-empty, so existing generation/refund/cashfree/paytm
// rows with an empty value don't collide). With this index, two concurrent
// credit attempts for the same Stripe session can never both succeed - the
// second insert is rejected by the database, making double-crediting
// impossible regardless of which path (webhook vs success-page) runs first.
//
// Idempotent: safe to run more than once.
migrate((app) => {
	const collection = app.findCollectionByNameOrId('transactions');
	if (!collection) {
		console.log('transactions collection not found, skipping');
		return;
	}

	if (!collection.fields.getByName('stripe_session_id')) {
		collection.fields.add(new TextField({ name: 'stripe_session_id', required: false, max: 0, min: 0 }));
	}

	const indexName = 'idx_transactions_stripe_session_id';
	const hasIndex = (collection.indexes || []).some((idx) => idx.includes(indexName));
	if (!hasIndex) {
		collection.indexes = [
			...(collection.indexes || []),
			`CREATE UNIQUE INDEX \`${indexName}\` ON \`transactions\` (\`stripe_session_id\`) WHERE \`stripe_session_id\` != ''`,
		];
	}

	return app.save(collection);
}, (app) => {
	try {
		const collection = app.findCollectionByNameOrId('transactions');
		collection.indexes = (collection.indexes || []).filter(
			(idx) => !idx.includes('idx_transactions_stripe_session_id'),
		);
		collection.fields.removeByName('stripe_session_id');
		return app.save(collection);
	} catch (e) {
		if (e.message.includes('no rows in result set')) return;
		throw e;
	}
});
