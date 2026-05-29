/// <reference path="../pb_data/types.d.ts" />
//
// Make Cashfree the default payment method and turn Stripe off.
//
// The earlier seed (1779800005) already created these rows with
// stripe=true / cashfree=false, so editing that migration would not
// re-run. This migration updates the existing rows in place. It also
// creates them if they happen to be missing.
//
// Safety: this overwrites whatever values are currently stored. That is
// intentional here - we are deliberately changing the platform default.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('settings');
  if (!collection) return;

  const desired = [
    { key: 'payment_stripe_enabled', value: false },
    { key: 'payment_cashfree_enabled', value: true },
  ];

  for (const { key, value } of desired) {
    let record;
    try {
      record = app.findFirstRecordByFilter('settings', `key = "${key}"`);
    } catch (_) {
      record = null;
    }

    if (!record) {
      record = new Record(collection);
      record.set('key', key);
    }

    record.set('value', value);
    app.save(record);
  }

  console.log('Payment defaults set: cashfree=on, stripe=off');
}, (app) => {
  // Revert to the original seed defaults (stripe on, cashfree off).
  const collection = app.findCollectionByNameOrId('settings');
  if (!collection) return;

  const previous = [
    { key: 'payment_stripe_enabled', value: true },
    { key: 'payment_cashfree_enabled', value: false },
  ];

  for (const { key, value } of previous) {
    try {
      const record = app.findFirstRecordByFilter('settings', `key = "${key}"`);
      record.set('value', value);
      app.save(record);
    } catch (_) {
      // row not present, nothing to revert
    }
  }
});
