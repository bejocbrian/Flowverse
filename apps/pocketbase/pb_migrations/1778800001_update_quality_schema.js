/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('videos');
  
  if (!collection) {
    return;
  }

  // Find the quality field
  const qualityField = collection.fields.getByName('quality');
  if (qualityField) {
    // Add the new resolution values to the allowed options
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
    console.log("Updated videos collection quality field enum values.");
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('videos');
  
  if (!collection) {
    return;
  }

  const qualityField = collection.fields.getByName('quality');
  if (qualityField) {
    qualityField.values = [
      "Fast",
      "Standard",
      "High"
    ];
    collection.fields.add(qualityField);
    app.save(collection);
  }
});
