/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('transactions');
  if (!collection) return;

  const typeField = collection.fields.getByName('type');
  if (typeField) {
    typeField.values = [
      "purchase",
      "generation",
      "refund"
    ];
    collection.fields.add(typeField);
    app.save(collection);
    console.log("Added 'refund' to transactions type enum.");
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('transactions');
  if (!collection) return;

  const typeField = collection.fields.getByName('type');
  if (typeField) {
    typeField.values = [
      "purchase",
      "generation"
    ];
    collection.fields.add(typeField);
    app.save(collection);
  }
});
