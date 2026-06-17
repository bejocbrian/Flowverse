/// <reference path="../pb_data/types.d.ts" />

/**
 * Add fields required for the video extend+merge feature.
 *
 * clip_urls      — JSON array of all individual clip URLs that form the
 *                  merged video. Populated only on extended videos.
 * total_duration — Cumulative duration in seconds of the merged video.
 * merged_video   — PocketBase file field for the server-merged MP4.
 */
migrate((app) => {
  const collection = app.findCollectionByNameOrId("videos");
  if (!collection) return;

  // JSON array of individual clip URLs (text field storing JSON string)
  collection.fields.add(new TextField({
    name: "clip_urls",
    required: false,
  }));

  // Cumulative video duration in seconds
  collection.fields.add(new NumberField({
    name: "total_duration",
    required: false,
    min: 0,
    max: 7200,
  }));

  // Merged video file uploaded by the server after FFmpeg concatenation
  collection.fields.add(new FileField({
    name: "merged_video",
    required: false,
    maxSelect: 1,
    maxSize: 209715200,
    mimeTypes: ["video/mp4", "video/quicktime"],
    thumbs: [],
    protected: false,
  }));

  app.save(collection);
  console.log("Added clip_urls, total_duration, merged_video to videos collection.");
}, (app) => {
  const collection = app.findCollectionByNameOrId("videos");
  if (!collection) return;

  collection.fields.removeByName("clip_urls");
  collection.fields.removeByName("total_duration");
  collection.fields.removeByName("merged_video");

  app.save(collection);
  console.log("Reverted clip_urls, total_duration, merged_video from videos collection.");
});