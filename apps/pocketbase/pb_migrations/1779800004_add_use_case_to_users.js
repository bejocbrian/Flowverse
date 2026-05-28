/// <reference path="../pb_data/types.d.ts" />
//
// Adds a `use_case` field to the users collection so the onboarding
// flow can persist what the user picked on the first step. Without
// this, the page kept asking again on every visit because the answer
// was only kept in component state.
migrate((app) => {
  const collection = app.findCollectionByNameOrId('users');

  const existing = collection.fields.getByName('use_case');
  if (existing) {
    if (existing.type === 'select') return;
    collection.fields.removeByName('use_case');
  }

  collection.fields.add(new SelectField({
    name: 'use_case',
    required: false,
    maxSelect: 1,
    values: ['marketing', 'social', 'film', 'personal', 'other'],
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('users');
    collection.fields.removeByName('use_case');
    return app.save(collection);
  } catch (e) {
    if (e.message.includes('no rows in result set')) return;
    throw e;
  }
});
