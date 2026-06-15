# Deferred Tasks — Video Generation Platform Roadmap

This document tracks tasks that are **not yet implemented** and require either external dependencies, product decisions, or significant engineering effort. Each task includes a precise description of what needs to be done, which files to modify, what to watch out for, and what decisions are needed before starting.

---

## T9: Sora Model Exposure

**Status:** ⏸️ Deferred by user request  
**Complexity:** Low  
**External Dependency:** None — GeminiGen already has `/video-gen/sora`

### What needs to be done

1. **`apps/api/src/constants/models.js`** — Uncomment/add Sora model entry:
   ```js
   {
     key: 'sora',
     id: 'sora',             // must match the model name GeminiGen expects
     label: 'Sora',
     provider: 'OpenAI',
     type: 'video',
     billing: 'per_video',
     credits: { '720p': 50, '1080p': 75 },
     durations: [5, 10, 15, 20],
     maxDuration: 20,
     aspectRatios: ['16:9', '9:16'],
     imageModes: [],
     maxRefImages: 0,
     routed: true,
     enabled: true,
   }
   ```
   > ⚠️ **Confirm the exact model ID string** GeminiGen expects for Sora (could be `sora`, `sora-2`, `sora-2-pro`, etc.) by checking the GeminiGen docs. The `id` field is what gets sent to the API.

2. **`apps/api/src/api/geminigen.js`** — Add Sora to `MODEL_PROVIDER_MAP`:
   ```js
   'sora': 'sora',
   ```
   The provider `'sora'` will route to `/video-gen/sora`. The endpoint logic already handles dynamic routing via `MODEL_PROVIDER_MAP`.

3. **Credit pricing** — Decide the display credit cost (remember K=5 multiplier: vendor cost × 5 = display). Currently placeholder is 50/75 cr — confirm actual vendor cost from GeminiGen pricing page.

4. **No frontend changes needed** — The model picker reads from the API's `/models` endpoint dynamically; enabling Sora in models.js is all that's needed for it to appear.

**Decision needed before starting:** Confirm exact model IDs and credit pricing from GeminiGen dashboard.

---

## T12: Native Audio Handling

**Status:** ⏳ To be done — needs GeminiGen audio API confirmed  
**Complexity:** High  
**External Dependency:** GeminiGen audio/lip-sync API availability

### What needs to be done

1. **Confirm GeminiGen audio endpoints** — Check docs.geminigen.ai for:
   - Audio generation endpoint (text-to-video with sound)
   - Lip-sync endpoint (add speech to a silent video)
   - What models support audio natively (Kling 2.6 Audio is defined in models.js but currently disabled)

2. **`apps/api/src/api/geminigen.js`** — Add new export functions:
   ```js
   // Audio-enabled video generation
   export async function generateVideoWithAudio({ prompt, model, resolution, duration, aspect_ratio, audio_prompt }) { ... }
   
   // Lip-sync: sync audio to existing video
   export async function lipSyncVideo({ video_url, audio_url }) { ... }
   ```

3. **`apps/api/src/constants/models.js`** — Add `supportsAudio: true` flag to models that support it, and enable Kling 2.6 Audio if routing is confirmed:
   ```js
   { key: 'kling-2.6-audio', ..., routed: true, enabled: true }
   ```

4. **`apps/api/src/routes/videos.js`** — Handle `output_type: 'video_with_audio'` or an `audio_prompt` field in the POST body, routing to the audio endpoint when present.

5. **`apps/web/src/components/AudioSettings.jsx`** — **New file** — UI for:
   - Audio prompt text field (describe the sound/music)
   - Toggle: generated audio vs uploaded audio file
   - Audio file upload (for lip-sync)

6. **`apps/web/src/pages/GeneratePage.jsx`** — Add `AudioSettings` to the SettingsPanel when `selectedModel.supportsAudio === true`.

**Decision needed before starting:** Verify GeminiGen audio API is available for your account tier. Check which models actually support it.

---

## T14: Team Collaboration

**Status:** ⏳ To be done — needs product decision  
**Complexity:** High  
**External Dependency:** None, but requires PocketBase schema changes and product decisions

### What needs to be done

1. **Product decisions required first:**
   - How are credits shared? (Pooled team wallet vs individual with shared quota)
   - What roles exist? (Owner, Admin, Editor, Viewer)
   - How are members invited? (Email invite, link, direct add)
   - Can team members see each other's videos?

2. **PocketBase migrations** (`apps/pocketbase/pb_migrations/`):
   ```
   [timestamp]_create_teams.js         — teams collection { name, owner_id, credits_balance }
   [timestamp]_create_team_members.js  — team_members { team_id, user_id, role, invited_by }
   [timestamp]_add_team_id_to_videos.js — videos.team_id (nullable)
   ```

3. **`apps/api/src/routes/teams.js`** — **New file** — CRUD endpoints:
   - `POST /teams` — create team
   - `GET /teams/me` — my teams
   - `POST /teams/:id/invite` — invite member by email
   - `DELETE /teams/:id/members/:userId` — remove member
   - `GET /teams/:id/videos` — team video library

4. **`apps/api/src/middleware/team-auth.js`** — **New file** — check team membership on team-scoped routes.

5. **`apps/api/src/utils/teamCredits.js`** — **New file** — Handle deducting from team vs personal credits.

6. **`apps/api/src/routes/videos.js`** — Accept optional `team_id` in POST /videos to charge team credits.

7. **`apps/web/src/pages/TeamPage.jsx`** — **New file** — Dashboard for managing team (invite, remove, view usage).

8. **`apps/web/src/App.jsx`** — Add `/app/team` route.

9. **`apps/web/src/components/MainLayout.jsx`** — Add Team nav item.

---

## T15: In-Browser Basic Editing (Trim + Merge)

**Status:** ⏳ To be done — needs library decision  
**Complexity:** High  
**External Dependency:** Video processing library choice

### What needs to be done

1. **Library decision required first:**
   - **Option A: FFmpeg.wasm** — Full FFmpeg in the browser. Powerful but ~30MB download.
   - **Option B: Server-side FFmpeg** — Send video to backend, process there. Requires FFmpeg on the server.
   - **Option C: Cloudflare Stream / Mux** — Outsource editing to a video platform API. Easiest but adds cost.
   > Recommendation: Option B (server-side) for simplicity and reliability.

2. **If server-side chosen:**
   - Install `fluent-ffmpeg` in `apps/api/package.json`
   - **`apps/api/src/routes/editor.js`** — **New file**:
     - `POST /editor/trim` — trim video to start/end timestamps
     - `POST /editor/merge` — concatenate 2+ video URLs into one
   - Both endpoints download the source video, process with FFmpeg, upload result to storage, return URL.

3. **`apps/web/src/pages/EditorPage.jsx`** — **New file** — Editor UI:
   - Video timeline with trim handles
   - Multi-video merge (drag-and-drop order)
   - Export/save button

4. **`apps/web/src/App.jsx`** — Add `/app/editor` route.

5. **`apps/web/src/components/MainLayout.jsx`** — Add Editor nav item.

6. **Credit model** — Decide if editing is free or credits-based.

---

## T16: Redis-Based Rate Limiting

**Status:** ⏳ To be done — needs Redis infrastructure  
**Complexity:** Medium  
**External Dependency:** Redis instance (Railway, Upstash, ElastiCache, etc.)

### What needs to be done

1. **Provision Redis** — Add Redis to your Railway/Render/Vercel deployment. Get the `REDIS_URL` connection string.

2. **`apps/api/package.json`** — Add dependencies:
   ```json
   "ioredis": "^5.x.x",
   "rate-limit-redis": "^4.x.x"
   ```

3. **`apps/api/src/utils/redisClient.js`** — **New file**:
   ```js
   import Redis from 'ioredis';
   
   const redisUrl = process.env.REDIS_URL;
   
   export const redis = redisUrl
     ? new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 })
     : null;  // Falls back to in-memory if not configured
   ```

4. **`apps/api/src/middleware/global-rate-limit.js`** — Add Redis store when available:
   ```js
   import { redis } from '../utils/redisClient.js';
   import RedisStore from 'rate-limit-redis';
   
   const store = redis ? new RedisStore({ sendCommand: (...args) => redis.call(...args) }) : undefined;
   
   export const globalRateLimit = rateLimit({ store, windowMs: 5 * 60 * 1000, max: 100 });
   ```

5. **`apps/api/src/middleware/generation-rate-limit.js`** — Same pattern.

6. **`apps/api/.env.example`** — Add:
   ```
   # Redis (optional - for distributed rate limiting across multiple API instances)
   # If not set, in-memory rate limiting is used (fine for single-instance deployments)
   REDIS_URL=redis://localhost:6379
   ```

> ⚠️ The current in-memory rate limiting works fine for a **single server instance**. Redis is only needed when you scale to multiple API instances (horizontal scaling). Do not block on this until you need to scale.

---

## T17: WebSocket Status Updates

**Status:** ⏳ To be done — significant refactor  
**Complexity:** High  
**External Dependency:** None, but requires careful migration from polling

### What needs to be done

The current architecture polls `GET /videos/:id/status` every 5 seconds from the frontend. This works but is inefficient at scale. WebSocket replaces this with a push model.

1. **`apps/api/src/main.js`** — Upgrade HTTP server to support WS:
   ```js
   import { WebSocketServer } from 'ws';
   const wss = new WebSocketServer({ server });
   ```

2. **`apps/api/src/websocket/generationSocket.js`** — **New file** — Connection manager:
   - Authenticate WS connection using the same PocketBase token from query param
   - Register a per-user channel: `ws.subscribe(userId)`
   - Push status updates when generation completes/fails/progresses
   - Emit from `generationProcessor.js` when status changes

3. **`apps/api/src/workers/generationProcessor.js`** — Import and call the WS emitter after each status update:
   ```js
   import { emitGenerationUpdate } from '../websocket/generationSocket.js';
   // After pb.collection('videos').update(...)
   emitGenerationUpdate(videoRecord.user_id, { id: videoRecord.id, status: 'completed', video_url });
   ```

4. **`apps/web/src/contexts/WebSocketContext.jsx`** — **New file** — React context that:
   - Establishes WS connection on login, closes on logout
   - Reconnects automatically on disconnect (exponential backoff)
   - Exposes a `subscribe(videoId, callback)` method

5. **`apps/web/src/hooks/useGenerationStatus.js`** — **New file** — Replaces polling:
   ```js
   // Instead of polling /videos/:id/status, subscribe to WS events
   export function useGenerationStatus(videoId, onUpdate) { ... }
   ```

6. **`apps/web/src/pages/GeneratePage.jsx`** — Replace `startPolling` / `pollingRef` logic with `useGenerationStatus` hook.

> ⚠️ Keep polling as a fallback for WS disconnects. Don't remove it until WS is confirmed stable in production.

---

## T18: CDN Integration for Video Delivery

**Status:** ⏳ To be done — needs CDN provider  
**Complexity:** Medium  
**External Dependency:** CDN provider (Cloudflare, BunnyCDN, AWS CloudFront, etc.)

### What needs to be done

Currently, `video_url` is a direct URL from GeminiGen's storage. When users download/play videos, they hit GeminiGen's servers directly.

1. **CDN provider decision** — Recommendation: **Cloudflare R2 + CDN** (cheapest, no egress fees) or **BunnyCDN** (simple, cheap). Avoid AWS CloudFront unless you're already on AWS.

2. **`apps/api/src/utils/videoDelivery.js`** — **New file**:
   ```js
   const CDN_BASE_URL = process.env.CDN_BASE_URL;  // e.g. https://cdn.yourdomain.com
   
   export function toCdnUrl(originalUrl) {
     if (!CDN_BASE_URL || !originalUrl) return originalUrl;
     // Map GeminiGen storage URL → CDN URL
     // This depends on how you've configured your CDN origin
     return originalUrl.replace('https://storage.geminigen.ai', CDN_BASE_URL);
   }
   ```

3. **`apps/api/src/routes/videos.js`** — Wrap all `video_url` and `thumbnail_url` fields through `toCdnUrl()` before returning in API responses.

4. **`apps/api/.env.example`** — Add:
   ```
   # CDN base URL for video delivery (optional - falls back to direct GeminiGen URLs)
   CDN_BASE_URL=https://cdn.yourdomain.com
   ```

> ⚠️ You need to set up the CDN to proxy/pull from GeminiGen's storage. This is a CDN configuration step outside the codebase — do that first, confirm URLs work, then add the rewrite logic.

---

## T21: API Key Rotation Mechanism

**Status:** ⏳ To be done  
**Complexity:** Medium  
**External Dependency:** None

### What "API Key Rotation" means

The app uses one API key (`INTEGRATED_AI_API_KEY`) to call GeminiGen. If that key is ever leaked (e.g., in logs, a git commit, an error response), attackers can generate unlimited videos at your expense.

**Key rotation** means:
- You can swap to a new API key without downtime
- The old key stays valid briefly during transition
- The rotation is logged so you know when it happened

### What needs to be done

1. **Support multiple keys in ENV** — `apps/api/.env.example`:
   ```
   # Primary GeminiGen API key
   INTEGRATED_AI_API_KEY=your-primary-key
   
   # Secondary key (used during rotation - optional)
   INTEGRATED_AI_API_KEY_SECONDARY=
   ```

2. **`apps/api/src/utils/keyRotation.js`** — **New file** — Key selector with fallback:
   ```js
   /**
    * Returns the active API key. During rotation, tries the primary first,
    * falls back to secondary if primary returns 401/403.
    */
   export function getActiveApiKey() {
     return process.env.INTEGRATED_AI_API_KEY || '';
   }
   
   export function getSecondaryApiKey() {
     return process.env.INTEGRATED_AI_API_KEY_SECONDARY || '';
   }
   ```

3. **`apps/api/src/api/geminigen.js`** — Update `API_KEY()` to use the rotation utility, and in `fetchWithRetry`, if a 401 is received and a secondary key exists, retry once with the secondary key:
   ```js
   import { getActiveApiKey, getSecondaryApiKey } from '../utils/keyRotation.js';
   
   // In fetchWithRetry, on 401:
   if (response.status === 401 && getSecondaryApiKey()) {
     // Retry with secondary key
     headers['x-api-key'] = getSecondaryApiKey();
     continue;
   }
   ```

4. **`apps/api/src/routes/admin-settings.js`** — Add admin endpoint to trigger key rotation:
   - `POST /admin/rotate-api-key` — logs rotation event, signals to switch to secondary

5. **Logging** — Every key switch should log to the logger with timestamp (no actual key values in logs):
   ```js
   logger.warn('API key rotation triggered — switching to secondary key');
   ```

> **Practical note:** For most deployments, the simplest "rotation" is just:
> 1. Generate new key in GeminiGen dashboard
> 2. Add it as `INTEGRATED_AI_API_KEY_SECONDARY` in your ENV
> 3. Deploy with both keys active
> 4. Remove the old key from GeminiGen dashboard
> 5. Promote secondary to primary in ENV
> 6. Remove secondary from ENV
>
> The code above automates the fallback step so there's zero downtime during steps 3-4.

---

## Summary Table

| Task | Status | Complexity | Blocked By | Est. Days |
|------|--------|------------|-----------|-----------|
| T9: Sora Model | ⏸️ Deferred | Low | Confirm model ID + pricing | 0.5 |
| T12: Audio Handling | ⏳ To do | High | Confirm GeminiGen audio API | 3–5 |
| T14: Team Collaboration | ⏳ To do | High | Product decisions on roles/credits | 5–8 |
| T15: In-Browser Editing | ⏳ To do | High | Library decision (FFmpeg.wasm vs server) | 4–6 |
| T16: Redis Rate Limiting | ⏳ To do | Medium | Redis infrastructure provisioned | 1 |
| T17: WebSocket Updates | ⏳ To do | High | None (pure code) | 3–4 |
| T18: CDN Integration | ⏳ To do | Medium | CDN provider + config | 1–2 |
| T21: API Key Rotation | ⏳ To do | Medium | None (pure code) | 1 |