/// <reference path="../pb_data/types.d.ts" />

// Defense-in-depth: only the API (using a superuser PocketBase client) can
// create user records. Hitting PocketBase directly to create a user must be
// rejected. Our /auth/signup route uses the superuser client and is unaffected.
migrate((app) => {
	const collection = app.findCollectionByNameOrId('users');
	collection.createRule = null;
	return app.save(collection);
}, (app) => {
	const collection = app.findCollectionByNameOrId('users');
	collection.createRule = '';
	return app.save(collection);
});
