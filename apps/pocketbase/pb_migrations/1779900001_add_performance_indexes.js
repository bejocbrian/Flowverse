/// <reference path="../pb_data/types.d.ts" />

/**
 * Performance indexes for high-traffic queries.
 *
 * These cover the most common query patterns:
 *  - videos filtered by user_id and status (dashboard, library, status polling)
 *  - transactions filtered by user_id (wallet history)
 *  - batches filtered by user_id (batch management page)
 */
migrate((app) => {
  // ── videos collection ───────────────────────────────────────────────────
  const videos = app.findCollectionByNameOrId("videos");

  // user_id queries (library page, all user video lookups)
  videos.indexes.push(
    "CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos (user_id)"
  );
  // status queries (generation processor status checks)
  videos.indexes.push(
    "CREATE INDEX IF NOT EXISTS idx_videos_status ON videos (status)"
  );
  // composite: user + created (library sorted by date)
  videos.indexes.push(
    "CREATE INDEX IF NOT EXISTS idx_videos_user_created ON videos (user_id, created DESC)"
  );
  // composite: user + status (in-progress video lookups)
  videos.indexes.push(
    "CREATE INDEX IF NOT EXISTS idx_videos_user_status ON videos (user_id, status)"
  );
  app.save(videos);

  // ── transactions collection ──────────────────────────────────────────────
  const transactions = app.findCollectionByNameOrId("transactions");

  // user_id queries (wallet history page)
  transactions.indexes.push(
    "CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id)"
  );
  // composite: user + created (sorted transaction history)
  transactions.indexes.push(
    "CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions (user_id, created DESC)"
  );
  app.save(transactions);

  // ── batches collection (if it exists) ───────────────────────────────────
  try {
    const batches = app.findCollectionByNameOrId("batches");
    batches.indexes.push(
      "CREATE INDEX IF NOT EXISTS idx_batches_user_id ON batches (user_id)"
    );
    batches.indexes.push(
      "CREATE INDEX IF NOT EXISTS idx_batches_user_created ON batches (user_id, created DESC)"
    );
    app.save(batches);
  } catch (e) {
    // batches collection may not exist yet — skip silently
    console.log("batches collection not found, skipping index creation:", e.message);
  }
}, (app) => {
  const INDEX_NAMES = [
    "idx_videos_user_id",
    "idx_videos_status",
    "idx_videos_user_created",
    "idx_videos_user_status",
    "idx_transactions_user_id",
    "idx_transactions_user_created",
    "idx_batches_user_id",
    "idx_batches_user_created",
  ];

  const removeIndexes = (collectionName) => {
    try {
      const collection = app.findCollectionByNameOrId(collectionName);
      collection.indexes = collection.indexes.filter(
        (idx) => !INDEX_NAMES.some((name) => idx.includes(name))
      );
      app.save(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        console.log(`${collectionName} not found, skipping revert`);
        return;
      }
      throw e;
    }
  };

  removeIndexes("videos");
  removeIndexes("transactions");
  removeIndexes("batches");
});