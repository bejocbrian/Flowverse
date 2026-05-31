/// <reference path="../pb_data/types.d.ts" />
//
// Make Paytm crediting exactly-once at the DATABASE level - the same pattern
// used for Cashfree in 1779800008.
//
// Adds `paytm_order_id` (text) to `transactions` and a PARTIAL UNIQUE index
// on it (unique only when non-empty, so existing generation/refund/cashfree
// rows with an empty value don't collide). With this index, two concurrent
// credit attempts for the same Paytm order can never both succeed - the
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

	if (!collection.fields.getByName('paytm_order_id')) {
		collection.fields.add(new TextField({ name: 'paytm_order_id', required: false, max: 0, min: 0 }));
	}

	const indexName = 'idx_transactions_paytm_order_id';
	const hasIndex = (collection.indexes || []).some((idx) => idx.includes(indexName));
	if (!hasIndex) {
		collection.indexes = [
			...(collection.indexes || []),
			`CREATE UNIQUE INDEX \`${indexName}\` ON \`transactions\` (\`paytm_order_id\`) WHERE \`paytm_order_id\` != ''`,
		];
	}

	return app.save(collection);
}, (app) => {
	try {
		const collection = app.findCollectionByNameOrId('transactions');
		collection.indexes = (collection.indexes || []).filter(
			(idx) => !idx.includes('idx_transactions_paytm_order_id'),
		);
		collection.fields.removeByName('paytm_order_id');
		return app.save(collection);
	} catch (e) {
		if (e.message.includes('no rows in result set')) return;
		throw e;
	}
});
