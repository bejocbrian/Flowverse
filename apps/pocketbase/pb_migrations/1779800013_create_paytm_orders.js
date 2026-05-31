/// <reference path="../pb_data/types.d.ts" />
//
// Create the `paytm_orders` collection: the server-side source of truth that
// makes Paytm crediting mismatch-proof.
//
// WHY THIS EXISTS: Paytm's Transaction Status API does NOT echo back custom
// merchant metadata (unlike Cashfree's order_tags). So we cannot recover
// "which user / how many credits / expected amount" from Paytm at credit
// time. We persist that here at order-create time and credit strictly from
// this record, asserting Paytm's confirmed txnAmount == expected_amount.
//
// Fields:
//   - order_id        (text, UNIQUE) our generated Paytm orderId
//   - user_id         (text) who to credit
//   - pack_id         (text) which credit pack
//   - credit_amount   (number) credits to grant on success
//   - expected_amount (number) INR we asked Paytm to charge (mismatch guard)
//   - currency        (text) always INR for now
//   - status          (text) CREATED | PAID  (observability only)
//   - txn_id          (text) Paytm txnId once known (observability only)
//
// Write rules are locked to null: only the superuser API may read/write this
// ledger-adjacent collection. Users never touch it directly.
//
// Uses the raw schema-object form (same as 1778785223_001_created_transactions)
// for maximum cross-version compatibility - a throwing migration would crash
// PocketBase at boot.
migrate((app) => {
	const collection = new Collection({
		name: 'paytm_orders',
		type: 'base',
		listRule: null,
		viewRule: null,
		createRule: null,
		updateRule: null,
		deleteRule: null,
		fields: [
			{
				autogeneratePattern: '[a-z0-9]{15}',
				hidden: false,
				id: 'text_po_id',
				max: 15,
				min: 15,
				name: 'id',
				pattern: '^[a-z0-9]+$',
				presentable: false,
				primaryKey: true,
				required: true,
				system: true,
				type: 'text',
			},
			{ hidden: false, id: 'text_po_order', name: 'order_id', presentable: false, primaryKey: false, required: true, system: false, type: 'text', autogeneratePattern: '', max: 0, min: 0, pattern: '' },
			{ hidden: false, id: 'text_po_user', name: 'user_id', presentable: false, primaryKey: false, required: true, system: false, type: 'text', autogeneratePattern: '', max: 0, min: 0, pattern: '' },
			{ hidden: false, id: 'text_po_pack', name: 'pack_id', presentable: false, primaryKey: false, required: true, system: false, type: 'text', autogeneratePattern: '', max: 0, min: 0, pattern: '' },
			{ hidden: false, id: 'num_po_credit', name: 'credit_amount', presentable: false, primaryKey: false, required: true, system: false, type: 'number', max: null, min: null, onlyInt: false },
			{ hidden: false, id: 'num_po_amount', name: 'expected_amount', presentable: false, primaryKey: false, required: true, system: false, type: 'number', max: null, min: null, onlyInt: false },
			{ hidden: false, id: 'text_po_cur', name: 'currency', presentable: false, primaryKey: false, required: false, system: false, type: 'text', autogeneratePattern: '', max: 0, min: 0, pattern: '' },
			{ hidden: false, id: 'text_po_status', name: 'status', presentable: false, primaryKey: false, required: false, system: false, type: 'text', autogeneratePattern: '', max: 0, min: 0, pattern: '' },
			{ hidden: false, id: 'text_po_txn', name: 'txn_id', presentable: false, primaryKey: false, required: false, system: false, type: 'text', autogeneratePattern: '', max: 0, min: 0, pattern: '' },
			{ hidden: false, id: 'autodate_po_created', name: 'created', onCreate: true, onUpdate: false, presentable: false, system: false, type: 'autodate' },
			{ hidden: false, id: 'autodate_po_updated', name: 'updated', onCreate: true, onUpdate: true, presentable: false, system: false, type: 'autodate' },
		],
		indexes: [
			'CREATE UNIQUE INDEX `idx_paytm_orders_order_id` ON `paytm_orders` (`order_id`)',
		],
	});

	try {
		return app.save(collection);
	} catch (e) {
		if (e.message.includes('Collection name must be unique')) {
			console.log('paytm_orders already exists, skipping');
			return;
		}
		throw e;
	}
}, (app) => {
	try {
		const collection = app.findCollectionByNameOrId('paytm_orders');
		return app.delete(collection);
	} catch (e) {
		if (e.message.includes('no rows in result set')) return;
		throw e;
	}
});
