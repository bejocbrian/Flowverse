/// <reference path="../pb_data/types.d.ts" />
//
// Seeds two settings rows that toggle payment methods at runtime.
// Defaults preserve current behavior: Stripe on, Cashfree off.
//
// We use the same try/save/catch idiom as 1778786042_004_seed_settings:
// the `key` field has a unique index, so if the row already exists from
// a re-run we just skip it and leave whatever value the admin has set.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('settings');
  if (!collection) return;

  const seeds = [
    { key: 'payment_stripe_enabled', value: true },
    { key: 'payment_cashfree_enabled', value: false },
  ];

  for (const { key, value } of seeds) {
    const record = new Record(collection);
    record.set('key', key);
    record.set('value', value);
    try {
      app.save(record);
    } catch (e) {
      if (e.message && e.message.includes('Value must be unique')) {
        // Already seeded - skip without touching the admin's value.
        continue;
      }
      throw e;
    }
  }
}, (app) => {
  // No revert: we don't want to nuke an admin's saved preference. Manual
  // cleanup if truly needed.
});
