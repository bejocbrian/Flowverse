/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('videos');
  if (!collection) return;

  collection.fields.add(new SelectField({
    name: "output_type",
    required: false,
    values: ["video", "image"],
    maxSelect: 1,
  }));

  app.save(collection);
  console.log("Added 'output_type' select field to videos collection.");
}, (app) => {
  const collection = app.findCollectionByNameOrId('videos');
  if (!collection) return;

  collection.fields.removeByName("output_type");

  app.save(collection);
});
