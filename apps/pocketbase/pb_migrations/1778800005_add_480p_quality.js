/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('videos');
  if (!collection) return;

  const qualityField = collection.fields.getByName('quality');
  if (qualityField) {
    qualityField.values = [
      "Fast",
      "Standard",
      "High",
      "480p",
      "720p",
      "1080p",
      "1K",
      "2K",
      "4K"
    ];
    collection.fields.add(qualityField);
    app.save(collection);
    console.log("Added '480p' to videos quality field for Grok 3 support.");
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('videos');
  if (!collection) return;

  const qualityField = collection.fields.getByName('quality');
  if (qualityField) {
    qualityField.values = [
      "Fast",
      "Standard",
      "High",
      "720p",
      "1080p",
      "1K",
      "2K",
      "4K"
    ];
    collection.fields.add(qualityField);
    app.save(collection);
  }
});
