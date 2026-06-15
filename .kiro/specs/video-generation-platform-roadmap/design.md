# Video Generation Platform - Development Roadmap Design

## 1. Architecture Overview

This design document outlines the technical implementation for each phase of the development roadmap. The architecture follows a layered approach with clear separation between API routes, business logic, and data access.

### 1.1 Current System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ GeneratePage│  │ LibraryPage  │  │ VideoDetailPage  │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Express)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ /videos     │  │ /auth        │  │ /webhooks        │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Business Logic Layer                         │
│  ┌──────────────────────┐  ┌────────────────────────────┐  │
│  │ generationProcessor  │  │ creditCalculator           │  │
│  └──────────────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────────────┐  ┌────────────────────────────┐  │
│  │ PocketBase           │  │ GeminiGen API              │  │
│  └──────────────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: Critical Fixes

### 2.1 Fix Duplicate DELETE Route

**Files to Modify:**
- `apps/api/src/routes/videos.js` - Remove duplicate DELETE route handler (lines ~250 and ~270)

**Implementation:**
```javascript
// Current: Two DELETE routes exist
// DELETE /videos/:id (first handler) - lines 229-243
// DELETE /videos/:id (duplicate handler) - lines 341-380

// Solution: Remove the first handler at lines 229-243 if it's a duplicate,
// OR remove the second handler at lines 341-380
// Keep only ONE DELETE route with proper error handling
```

**Complexity:** Low  
**Dependencies:** None

---

### 2.2 Input Validation Improvements

**Files to Modify:**
- `apps/api/src/routes/videos.js` - Add validation in POST /videos handler
- `apps/api/src/utils/inputSanitizer.js` - **NEW FILE** - Create sanitization utility
- `apps/api/src/constants/validation.js` - **NEW FILE** - Define validation constants

**New Files to Create:**

#### apps/api/src/utils/inputSanitizer.js
```javascript
/**
 * Input sanitization utilities
 */
export const MAX_PROMPT_LENGTH = 2000;
export const MAX_NEGATIVE_PROMPT_LENGTH = 1000;

export function sanitizePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt is required');
  }
  
  const trimmed = prompt.trim().slice(0, MAX_PROMPT_LENGTH);
  
  // Basic sanitization - remove potential injection patterns
  // Note: GeminiGen API handles prompt securely, this is defense-in-depth
  return trimmed;
}

export function validatePromptLength(prompt) {
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`);
  }
  return true;
}
```

#### apps/api/src/constants/validation.js
```javascript
export const VALIDATION = {
  MAX_PROMPT_LENGTH: 2000,
  MAX_NEGATIVE_PROMPT_LENGTH: 1000,
  MAX_ASPECT_RATIOS: ['16:9', '9:16', '1:1'],
  MAX_DURATIONS: [5, 6, 8, 10, 15],
  MAX_QUALITIES: ['480p', '720p', '1080p', '4k'],
};
```

**Complexity:** Low  
**Dependencies:** None

---

### 2.3 SSE Memory Leak Fix

**Files to Modify:**
- `apps/api/src/routes/integrated-ai.js` - Ensure proper cleanup on all error paths

**Implementation:**
```javascript
// Add cleanup handlers for SSE connections
let clientRes = null;

sseStream.on('close', () => {
  // Clean up on client disconnect
  cleanup();
});

sseStream.on('error', (err) => {
  // Clean up on server error
  cleanup();
  logger.error('SSE stream error:', err.message);
});

function cleanup() {
  if (abortController) {
    abortController.abort();
  }
  // Ensure response is ended
  if (clientRes && !clientRes.writableEnded) {
    clientRes.end();
  }
}
```

**Complexity:** Medium  
**Dependencies:** None

---

### 2.4 React Error Boundaries

**Files to Modify:**
- `apps/web/src/App.jsx` - Add error boundary wrapper
- `apps/web/src/components/ErrorBoundary.jsx` - **NEW FILE** - Create error boundary component

**New Files to Create:**

#### apps/web/src/components/ErrorBoundary.jsx
```javascript
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message || 'An unexpected error occurred'}</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
```

**Usage in App.jsx:**
```javascript
import ErrorBoundary from '@/components/ErrorBoundary';

// Wrap routes with error boundaries
<ErrorBoundary>
  <GeneratePage />
</ErrorBoundary>
```

**Complexity:** Low  
**Dependencies:** None

---

### 2.5 Configurable Polling

**Files to Modify:**
- `apps/api/src/workers/generationProcessor.js` - Use ENV variables for polling config
- `.env.example` - Document new environment variables

**Implementation:**
```javascript
// generationProcessor.js
const MAX_POLL_ATTEMPTS = parseInt(process.env.MAX_POLL_ATTEMPTS || '60', 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '10000', 10);
```

**Environment Variables:**
```bash
# Generation settings
MAX_POLL_ATTEMPTS=60
POLL_INTERVAL_MS=10000
```

**Complexity:** Low  
**Dependencies:** None

---

## 3. Phase 2: High-Impact Features

### 3.1 Batch Generation

**Files to Modify:**
- `apps/api/src/routes/videos.js` - Add batch endpoint
- `apps/api/src/utils/creditCalculator.js` - Support batch cost calculation
- `apps/api/src/workers/generationProcessor.js` - Handle parallel processing
- `apps/web/src/pages/GeneratePage.jsx` - Add batch input UI
- `apps/web/src/api/videoApi.js` - Add batch API call

**New Files to Create:**
- `apps/api/src/routes/batch.js` - Batch generation route handler

**Implementation:**

#### Backend Route (apps/api/src/routes/batch.js)
```javascript
router.post('/batch', async (req, res) => {
  const { prompts, settings } = req.body;
  
  // Validate batch size
  if (!Array.isArray(prompts) || prompts.length === 0 || prompts.length > 5) {
    return res.status(400).json({ 
      error: 'Batch must contain 1-5 prompts' 
    });
  }
  
  // Calculate total credit cost
  const costs = prompts.map(p => computeCreditCost({...settings, prompt: p}));
  const totalCost = costs.reduce((sum, c) => sum + c, 0);
  
  // Atomic deduction for entire batch
  await withTransaction(pb, async (ctx) => {
    // Deduct total, create batch record, queue individual generations
  });
  
  // Return batch ID and individual video IDs
  res.json({ batchId, videos: videoRecords });
});
```

#### Frontend UI (apps/web/src/pages/GeneratePage.jsx)
- Add "Add Prompt" button
- Add multi-prompt input list (up to 5)
- Show total credit cost for batch
- Display individual video statuses

**Complexity:** High  
**Dependencies:** Configurable Polling (Phase 1.5)

---

### 3.2 Preview Before Charge

**Files to Modify:**
- `apps/api/src/routes/videos.js` - Add preview generation endpoint
- `apps/api/src/api/geminigen.js` - Support preview mode (short duration, low res)
- `apps/api/src/constants/models.js` - Add preview credit cost
- `apps/web/src/pages/GeneratePage.jsx` - Add preview flow UI
- `apps/web/src/components/PreviewConfirmDialog.jsx` - **NEW FILE**

**New Files to Create:**
- `apps/api/src/routes/preview.js` - Preview generation handler

**Implementation:**

#### Preview Endpoint
```javascript
// POST /videos/preview
// Generates low-res 2-second preview
// Returns preview_url after completion
// User confirms or cancels
// On confirm: charge full credits, generate full video
// On cancel: no charge, preview discarded
```

**Flow:**
1. User configures generation → clicks "Preview"
2. System generates 2-second preview at 480p (cost: ~5 credits)
3. Preview displayed with "Confirm Full Generation" / "Cancel"
4. Confirm: deduct remaining credits, generate full video
5. Cancel: preview discarded, no additional charge

**Complexity:** Medium  
**Dependencies:** Input Validation (Phase 1.2)

---

### 3.3 4K Resolution Support

**Files to Modify:**
- `apps/api/src/constants/models.js` - Add 4K to veo-3.1 variants
- `apps/api/src/utils/creditCalculator.js` - Calculate 4K costs
- `apps/api/src/api/geminigen.js` - Map 4K to API resolution
- `apps/web/src/components/ResolutionPicker.jsx` - Add 4K option

**Implementation:**

#### models.js changes
```javascript
{
  key: 'veo-3.1-fast',
  // ... existing config
  credits: { '720p': 15, '1080p': 15, '4k': 30 }, // 2x for 4K
  // ...
}
```

#### geminigen.js mapping
```javascript
const RESOLUTION_MAP = {
  '480p': 'low',
  '720p': 'standard',
  '1080p': 'high',
  '4k': '4k', // New mapping if API supports
};
```

**Complexity:** Low  
**Dependencies:** None

---

### 3.4 Sora Model Exposure

**Files to Modify:**
- `apps/api/src/constants/models.js` - Add Sora model config
- `apps/api/src/api/geminigen.js` - Add /video-gen/sora routing
- `apps/web/src/components/ModelPicker.jsx` - Add Sora to picker

**Implementation:**

#### models.js addition
```javascript
{
  key: 'sora',
  id: 'sora',
  label: 'Sora',
  provider: 'OpenAI',
  type: 'video',
  billing: 'per_video',
  credits: { '720p': 50, '1080p': 75 },
  durations: [5, 10, 15, 20],
  aspectRatios: ['16:9', '9:16'],
  imageModes: [],
  routed: true,
  enabled: true,
}
```

#### geminigen.js routing
```javascript
async function generateVideo(params) {
  const endpoint = params.model === 'sora' ? '/video-gen/sora' : '/video-gen/veo';
  // ... existing logic with dynamic endpoint
}
```

**Complexity:** Low  
**Dependencies:** None

---

## 4. Phase 3: Advanced Features

### 4.1 Video Regeneration

**Files to Modify:**
- `apps/api/src/routes/video-regenerate.js` - Add regenerate endpoint
- `apps/web/src/pages/VideoDetailPage.jsx` - Add regenerate UI

**Complexity:** Medium  
**Dependencies:** None

---

### 4.2 First/Last Frame Interpolation

**Files to Modify:**
- `apps/api/src/constants/models.js` - Add interpolation mode
- `apps/api/src/api/geminigen.js` - Support interpolation API
- `apps/web/src/components/ImageModePicker.jsx` - Add interpolation options

**Complexity:** Medium  
**Dependencies:** None

---

### 4.3 Native Audio Handling

**Files to Modify:**
- `apps/api/src/api/geminigen.js` - Add audio generation/lip-sync endpoints
- `apps/api/src/constants/models.js` - Add audio-enabled models
- `apps/web/src/pages/GeneratePage.jsx` - Add audio options UI
- `apps/web/src/components/AudioSettings.jsx` - **NEW FILE**

**Complexity:** High  
**Dependencies:** None

---

### 4.4 Queue Management UI

**Files to Modify:**
- `apps/web/src/pages/QueuePage.jsx` - **NEW FILE** - Queue dashboard
- `apps/web/src/components/QueueItem.jsx` - **NEW FILE** - Individual queue item
- `apps/api/src/routes/queue.js` - **NEW FILE** - Queue status endpoints
- `apps/web/src/App.jsx` - Add /app/queue route

**Complexity:** Medium  
**Dependencies:** WebSocket (Phase 4.2)

---

### 4.5 Team Collaboration

**Files to Modify:**
- `apps/api/src/routes/teams.js` - **NEW FILE** - Team management
- `apps/api/src/routes/team-members.js` - **NEW FILE** - Member management
- `apps/api/src/middleware/team-auth.js` - **NEW FILE** - Team-based auth
- `apps/api/src/utils/teamCredits.js` - **NEW FILE** - Shared credit pool
- `apps/web/src/pages/TeamPage.jsx` - **NEW FILE** - Team dashboard
- `apps/web/src/pages/AdminSettingsPage.jsx` - Add team management UI

**Complexity:** High  
**Dependencies:** React Error Boundaries (Phase 1.4)

---

### 4.6 In-Browser Basic Editing

**Files to Modify:**
- `apps/web/src/pages/EditorPage.jsx` - **NEW FILE** - Video editor
- `apps/web/src/components/VideoTrimmer.jsx` - **NEW FILE** - Trim functionality
- `apps/web/src/components/VideoMerger.jsx` - **NEW FILE** - Merge functionality
- `apps/api/src/routes/editor.js` - **NEW FILE** - Video processing endpoints

**Complexity:** High  
**Dependencies:** None

---

## 5. Phase 4: Infrastructure

### 5.1 Redis-Based Rate Limiting

**Files to Modify:**
- `apps/api/src/middleware/global-rate-limit.js` - Add Redis store
- `apps/api/src/middleware/generation-rate-limit.js` - Add Redis store
- `apps/api/src/utils/redisClient.js` - **NEW FILE** - Redis connection

**New Files:**
- `apps/api/src/utils/redisClient.js`

**Implementation:**
```javascript
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const limiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:',
  }),
  // ... other options
});
```

**Complexity:** Medium  
**Dependencies:** Redis infrastructure

---

### 5.2 WebSocket Status Updates

**Files to Modify:**
- `apps/api/src/main.js` - Add WebSocket server setup
- `apps/api/src/websocket/generationSocket.js` - **NEW FILE** - Generation WS handler
- `apps/web/src/contexts/WebSocketContext.jsx` - **NEW FILE** - WS context
- `apps/web/src/hooks/useGenerationStatus.js` - **NEW FILE** - Status hook

**New Files:**
- `apps/api/src/websocket/generationSocket.js`
- `apps/web/src/contexts/WebSocketContext.jsx`
- `apps/web/src/hooks/useGenerationStatus.js`

**Complexity:** High  
**Dependencies:** None

---

### 5.3 CDN Integration

**Files to Modify:**
- `apps/api/src/utils/videoDelivery.js` - **NEW FILE** - CDN URL generation
- `apps/api/src/routes/videos.js` - Use CDN URLs in responses

**Complexity:** Medium  
**Dependencies:** CDN provider contract

---

### 5.4 Database Optimization

**Files to Modify:**
- Database migration scripts (PocketBase schema)
- Add indexes via PocketBase admin or migration

**Implementation:**
```javascript
// In PocketBase - create indexes on:
// videos.user_id (for user video lookups)
// videos.status (for status filtering)
// videos.created (for sorting)
// transactions.user_id (for transaction history)
// transactions.created (for sorting)
```

**Complexity:** Low  
**Dependencies:** None

---

### 5.5 Graceful Shutdown

**Files to Modify:**
- `apps/api/src/main.js` - Add shutdown handlers

**Implementation:**
```javascript
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received, starting graceful shutdown`);
  
  // Stop accepting new connections
  server.close(async () => {
    console.log('HTTP server closed');
    
    // Wait for in-flight requests (max 30 seconds)
    await waitForInflightRequests(30000);
    
    // Close database connections
    await pb.healthCheck();
    
    process.exit(0);
  });
  
  // Force exit after timeout
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 35000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

**Complexity:** Medium  
**Dependencies:** Process management setup

---

### 5.6 API Key Rotation

**Files to Modify:**
- `apps/api/src/utils/keyRotation.js` - **NEW FILE** - Key rotation logic
- `apps/api/src/api/geminigen.js` - Use key rotation utility
- `apps/api/src/utils/keyStore.js` - **NEW FILE** - Secure key storage

**Complexity:** Medium  
**Dependencies:** None

---

## 6. Implementation Order & Dependencies

### Dependency Graph

```
Phase 1 (Critical Fixes)
├── 2.1 DELETE Route Fix ───────────────┐
├── 2.2 Input Validation ───────────────┼──► Phase 2
├── 2.3 SSE Memory Leak ────────────────┤
├── 2.4 Error Boundaries ───────────────┼──► Phase 3
└── 2.5 Configurable Polling ───────────┘

Phase 2 (High-Impact)
├── 3.1 Batch Generation ───────────────┬──► Depends on 2.5
├── 3.2 Preview Before Charge ──────────┼──► Depends on 2.2
├── 3.3 4K Support ─────────────────────┤
└── 3.4 Sora Model ─────────────────────┘

Phase 3 (Advanced)
├── 4.1 Video Regeneration
├── 4.2 Frame Interpolation
├── 4.3 Audio Handling
├── 4.4 Queue Management ───────────────┼──► Depends on 4.2
├── 4.5 Team Features ──────────────────┼──► Depends on 2.4
└── 4.6 In-Browser Editing

Phase 4 (Infrastructure)
├── 5.1 Redis Rate Limiting ────────────┼──► Requires Redis
├── 5.2 WebSocket ──────────────────────┤
├── 5.3 CDN Integration ────────────────┼──► Requires CDN
├── 5.4 Database Optimization
├── 5.5 Graceful Shutdown
└── 5.6 API Key Rotation
```

---

## 7. Summary Table

| Feature | Files to Modify | New Files | Complexity | Dependencies |
|---------|----------------|-----------|------------|--------------|
| DELETE Route Fix | 1 | 0 | Low | None |
| Input Validation | 2 | 2 | Low | None |
| SSE Fix | 1 | 0 | Medium | None |
| Error Boundaries | 1 | 1 | Low | None |
| Configurable Polling | 2 | 0 | Low | None |
| Batch Generation | 4 | 1 | High | 2.5 |
| Preview Before Charge | 4 | 1 | Medium | 2.2 |
| 4K Support | 4 | 0 | Low | None |
| Sora Model | 3 | 0 | Low | None |
| Video Regeneration | 2 | 0 | Medium | None |
| Frame Interpolation | 3 | 0 | Medium | None |
| Audio Handling | 4 | 1 | High | None |
| Queue Management | 3 | 1 | Medium | 4.2 |
| Team Features | 5 | 2 | High | 2.4 |
| In-Browser Editing | 4 | 3 | High | None |
| Redis Rate Limiting | 2 | 1 | Medium | Redis |
| WebSocket | 2 | 3 | High | None |
| CDN Integration | 2 | 1 | Medium | CDN |
| DB Optimization | 1 | 0 | Low | None |
| Graceful Shutdown | 1 | 0 | Medium | None |
| Key Rotation | 2 | 2 | Medium | None |