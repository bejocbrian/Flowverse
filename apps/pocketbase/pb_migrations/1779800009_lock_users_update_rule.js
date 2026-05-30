/// <reference path="../pb_data/types.d.ts" />
//
// SECURITY (critical): previously the users collection had
//   updateRule = "id = @request.auth.id"
// which let any authenticated user PATCH their OWN record directly against
// PocketBase - including credits_balance, role, and banned_at. A user could
// give themselves unlimited credits, make themselves admin, or un-ban
// themselves, completely bypassing payment and access control.
//
// PocketBase (this version) has no field-level write rules, so the only safe
// fix is to deny direct updates entirely and force every user mutation
// through the API, which uses the superuser client and whitelists fields
// (see apps/api/src/routes/users.js -> PATCH /users/me, and auth/admin
// routes). This mirrors 1779800000 which already locked createRule.
//
// Self-service writes still work - they just go via the API now:
//   - profile/onboarding: PATCH /users/me
//   - settings/notifications: PUT /users/settings
//   - admin actions: /admin/users/*
migrate((app) => {
	const collection = app.findCollectionByNameOrId('users');
	collection.updateRule = null;
	return app.save(collection);
}, (app) => {
	// Revert to the previous (insecure) self-update rule.
	const collection = app.findCollectionByNameOrId('users');
	collection.updateRule = 'id = @request.auth.id';
	return app.save(collection);
});
