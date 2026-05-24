/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('videos');
  if (!collection) return;

  collection.fields.add(new TextField({
    name: "external_id",
    required: false
  }));

  collection.fields.add(new TextField({
    name: "error_message",
    required: false
  }));

  collection.fields.add(new JSONField({
    name: "webhook_data",
    required: false
  }));

  collection.fields.add(new TextField({
    name: "completed_at",
    required: false
  }));

  app.save(collection);
  console.log("Added webhook tracking fields to videos collection.");
}, (app) => {
  const collection = app.findCollectionByNameOrId('videos');
  if (!collection) return;

  collection.fields.removeByName("external_id");
  collection.fields.removeByName("error_message");
  collection.fields.removeByName("webhook_data");
  collection.fields.removeByName("completed_at");

  app.save(collection);
});
