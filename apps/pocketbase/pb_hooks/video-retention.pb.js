/// <reference path="../pb_data/types.d.ts" />

// Video retention cron hook
// Runs daily to delete videos older than RETENTION_DAYS and their associated
// PocketBase files to prevent storage bloat.
//
// Default retention: 30 days. Override via env var VIDEO_RETENTION_DAYS.

const RETENTION_DAYS = parseInt($os.getenv("VIDEO_RETENTION_DAYS") || "30", 10);
const BATCH_SIZE = 50;

routerAdd("GET", "/cron/video-retention", (e) => {
    // Only allow internal calls (cron or localhost)
    const ip = e.request?.remoteAddr || "";
    if (!ip.includes("127.0.0.1") && !ip.includes("localhost")) {
        throw new ForbiddenError("Internal endpoint only");
    }

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    let totalDeleted = 0;

    try {
        // Paginate through old videos
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const oldVideos = $app.dao().db().newRecordQuery("videos")
                .select("id", "video_url", "thumbnail_url")
                .andWhere($dbx.exp("created < {0}", { 0: cutoff }))
                .limit(BATCH_SIZE)
                .offset((page - 1) * BATCH_SIZE)
                .all();

            if (oldVideos.length === 0) {
                hasMore = false;
                break;
            }

            for (const video of oldVideos) {
                try {
                    // Delete associated files first
                    const filesToDelete = [];
                    if (video.getString("video_url")) {
                        const match = video.getString("video_url").match(/\/files\/[^/]+\/([^?]+)/);
                        if (match) filesToDelete.push(match[1]);
                    }
                    if (video.getString("thumbnail_url")) {
                        const match = video.getString("thumbnail_url").match(/\/files\/[^/]+\/([^?]+)/);
                        if (match) filesToDelete.push(match[1]);
                    }

                    for (const fileName of filesToDelete) {
                        try {
                            $app.dao().files().delete(fileName);
                        } catch (fileErr) {
                            // File may already be deleted; log and continue
                            console.log(`File cleanup skip for ${fileName}: ${fileErr.message}`);
                        }
                    }

                    // Delete the video record
                    $app.dao().db().deleteRecord("videos", video.id);
                    totalDeleted++;
                } catch (recordErr) {
                    console.log(`Failed to delete video ${video.id}: ${recordErr.message}`);
                }
            }

            // If we got fewer than batch size, we're done
            if (oldVideos.length < BATCH_SIZE) {
                hasMore = false;
            } else {
                page++;
            }
        }

        return e.json(200, {
            success: true,
            deleted: totalDeleted,
            retentionDays: RETENTION_DAYS,
            cutoff,
        });
    } catch (err) {
        throw new BadRequestError(`Video retention cleanup failed: ${err.message}`);
    }
});
