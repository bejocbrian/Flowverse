/// <reference path="../pb_data/types.d.ts" />
//
// SECURITY: the transactions collection allowed any authenticated user to
// CREATE rows (createRule = "@request.auth.id != ''"). Transactions are an
// audit ledger - only the API (superuser client) should ever write them
// (credit purchases, generation debits, refunds). A user creating arbitrary
// rows can't change their balance (that's on users, now locked too) but can
// pollute the ledger and the wallet history.
//
// Lock create/update/delete to null so only the superuser API can write.
// Read rules are unchanged: users still see their own transactions.
migrate((app) => {
	const collection = app.findCollectionByNameOrId('transactions');
	collection.createRule = null;
	collection.updateRule = null;
	collection.deleteRule = null;
	// listRule / viewRule remain "user_id = @request.auth.id" (own rows).
	return app.save(collection);
}, (app) => {
	const collection = app.findCollectionByNameOrId('transactions');
	collection.createRule = "@request.auth.id != ''";
	return app.save(collection);
});
