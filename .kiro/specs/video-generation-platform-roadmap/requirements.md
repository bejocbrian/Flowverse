# Video Generation Platform - Development Roadmap

## 1. Overview

This document defines the comprehensive development roadmap for the AI video generation wrapper product. The roadmap addresses critical fixes, high-impact features, advanced capabilities, and infrastructure improvements needed to enhance the platform's reliability, competitive positioning, and scalability.

## 2. Scope

**In Scope:**
- Backend API improvements and bug fixes
- Frontend feature additions
- Credit system enhancements
- Generation pipeline improvements
- Infrastructure optimizations

**Out of Scope:**
- Adding new video generation model providers beyond existing GeminiGen integrations
- Mobile application development
- White-label/enterprise features

---

## 3. User Stories

### Phase 1: Critical Fixes

#### US-1: Fix Duplicate DELETE Route
**As a** backend developer  
**I want** the duplicate DELETE route in videos.js to be removed  
**So that** there are no conflicting route handlers causing potential bugs

#### US-2: Input Validation Improvements
**As a** security engineer  
**I want** prompt length validation and basic sanitization to be implemented  
**So that** the system is protected against potential prompt injection and abuse

#### US-3: SSE Memory Leak Fix
**As a** backend developer  
**I want** SSE connections in integrated-ai.js to be properly cleaned up on all error paths  
**So that** the server does not accumulate memory leaks from orphaned connections

#### US-4: React Error Boundaries
**As a** frontend developer  
**I want** error boundaries added to React components  
**So that** application errors are gracefully handled without crashing the entire UI

#### US-5: Configurable Polling
**As a** DevOps engineer  
**I want** generation polling delays to be configurable via environment variables  
**So that** I can tune generation timeout behavior without code changes

---

### Phase 2: High-Impact Features

#### US-6: Batch Generation
**As a** content creator  
**I want** to submit multiple video generation prompts in a single request  
**So that** I can create multiple variations efficiently without making separate API calls

#### US-7: Preview Before Charge
**As a** user  
**I want** to see a low-resolution preview before committing full credits  
**So that** I can verify the output quality before spending my credits

#### US-8: 4K Resolution Support
**As a** professional user  
**I want** to generate videos in 4K resolution  
**So that** I can use the output for professional/high-quality projects

#### US-9: Sora Model Exposure
**As a** user  
**I want** access to Sora model generation  
**So that** I can try the latest video generation technology from OpenAI

---

### Phase 3: Advanced Features

#### US-10: Video Regeneration
**As a** user  
**I want** to regenerate a video with modified prompt while keeping other settings  
**So that** I can refine my generation without starting from scratch

#### US-11: First/Last Frame Interpolation
**As a** video editor  
**I want** smooth transitions between first/last frames  
**So that** I can create more seamless video extensions

#### US-12: Native Audio Handling
**As a** user  
**I want** the system to handle audio generation or lip-sync  
**So that** my generated videos have sound

#### US-13: Queue Management UI
**As a** user  
**I want** to see a real-time queue of my generation requests  
**So that** I can monitor progress and priority of multiple jobs

#### US-14: Team Collaboration
**As a** team lead  
**I want** to share videos and generation quotas with team members  
**So that** our team can collaborate on video projects

#### US-15: In-Browser Basic Editing
**As a** user  
**I want** to trim or merge videos in the browser  
**So that** I can make quick edits without external tools

---

### Phase 4: Infrastructure

#### US-16: Redis-Based Rate Limiting
**As a** platform operator  
**I want** rate limiting to use Redis for distributed environments  
**So that** the system can scale horizontally

#### US-17: WebSocket Status Updates
**As a** frontend developer  
**I want** video generation status via WebSocket instead of polling  
**So that** users get real-time updates without polling overhead

#### US-18: CDN Integration
**As a** DevOps engineer  
**I want** generated videos to be served via CDN  
**So that** video delivery is faster and more reliable

#### US-19: Database Optimization
**As a** backend developer  
I want** proper database indexes on frequently queried fields  
**So that** database queries perform efficiently at scale

#### US-20: Graceful Shutdown
**As a** platform operator  
**I want** the API server to handle graceful shutdowns  
**So that** in-flight generation requests complete before shutdown

#### US-21: API Key Rotation
**As a** security engineer  
**I want** automated API key rotation mechanisms  
**So that** credential exposure risk is minimized

---

## 4. Acceptance Criteria

### Phase 1: Critical Fixes

#### AC-1.1: Duplicate DELETE Route
- [ ] Only ONE DELETE /videos/:id route exists in videos.js
- [ ] No route conflicts when deleting videos

#### AC-1.2: Input Validation
- [ ] Prompt length is validated (max 2000 characters)
- [ ] Prompt is sanitized before being sent to GeminiGen API
- [ ] Invalid prompts return 400 error with clear message

#### AC-1.3: SSE Memory Leak
- [ ] All SSE connections are closed on client disconnect
- [ ] All SSE connections are closed on server errors
- [ ] No memory growth observed under load

#### AC-1.4: React Error Boundaries
- [ ] Error boundary wraps GeneratePage
- [ ] Error boundary wraps LibraryPage
- [ ] Errors show user-friendly message, not crash

#### AC-1.5: Configurable Polling
- [ ] MAX_POLL_ATTEMPTS configurable via ENV
- [ ] POLL_INTERVAL_MS configurable via ENV
- [ ] Default values match current behavior

---

### Phase 2: High-Impact Features

#### AC-2.1: Batch Generation
- [ ] User can submit up to 5 prompts in one request
- [ ] Each prompt generates a separate video
- [ ] Credits deducted atomically for entire batch
- [ ] Partial failure refunds failed items only

#### AC-2.2: Preview Before Charge
- [ ] Low-res preview (480p, 2 seconds) generated first
- [ ] Preview shown to user before confirmation
- [ ] Confirm triggers full generation
- [ ] Cancel discards preview with no credit charge

#### AC-2.3: 4K Resolution Support
- [ ] 4K option available in model configuration
- [ ] Credit cost adjusted for 4K (approximately 2x 1080p)
- [ ] UI shows 4K option for supported models

#### AC-2.4: Sora Model
- [ ] Sora model appears in model picker
- [ ] Generation uses /video-gen/sora endpoint
- [ ] Credit cost configured appropriately

---

### Phase 3: Advanced Features

#### AC-3.1: Video Regeneration
- [ ] User can modify prompt and regenerate
- [ ] Settings (aspect, resolution) preserved
- [ ] New credit deduction applies

#### AC-3.2: Frame Interpolation
- [ ] First frame interpolation mode available
- [ ] Last frame interpolation mode available
- [ ] Smooth transition effect applied

#### AC-3.3: Audio Handling
- [ ] Audio generation option available
- [ ] Lip-sync option available
- [ ] Audio track merged with video

#### AC-3.4: Queue Management
- [ ] User sees list of pending/completed generations
- [ ] Status updates in real-time
- [ ] User can reorder queue priority

#### AC-3.5: Team Features
- [ ] Admin can invite team members
- [ ] Credit quota shared across team
- [ ] Role-based permissions (admin, editor, viewer)

#### AC-3.6: In-Browser Editing
- [ ] Trim functionality works
- [ ] Merge functionality works
- [ ] Changes saved to new video

---

### Phase 4: Infrastructure

#### AC-4.1: Redis Rate Limiting
- [ ] Rate limits use Redis in production
- [ ] Fallback to in-memory for development

#### AC-4.2: WebSocket
- [ ] WebSocket connection for status updates
- [ ] Automatic reconnection on disconnect

#### AC-4.3: CDN
- [ ] Videos served through CDN
- [ ] CDN cache invalidation on new video

#### AC-4.4: Database Indexes
- [ ] Index on videos.user_id
- [ ] Index on videos.status
- [ ] Index on videos.created

#### AC-4.5: Graceful Shutdown
- [ ] SIGTERM triggers shutdown sequence
- [ ] In-flight requests complete before exit
- [ ] Health check returns 503 during shutdown

#### AC-4.6: Key Rotation
- [ ] API keys rotate automatically
- [ ] Old keys remain valid during transition
- [ ] Rotation logged for audit

---

## 5. Technical Constraints

- Must maintain backward compatibility with existing API clients
- Credit system must remain atomic - no partial deductions
- All new features must work with PocketBase backend
- Frontend must remain responsive on mobile devices

## 6. Dependencies

### Feature Dependencies
- Batch Generation depends on: Configurable Polling (AC-1.5)
- Preview Before Charge depends on: Input Validation (AC-1.2)
- Queue Management depends on: WebSocket (AC-4.2)
- Team Features depends on: React Error Boundaries (AC-1.4)

### Infrastructure Dependencies
- Redis Rate Limiting depends on: Redis infrastructure in place
- CDN Integration depends on: CDN provider contract
- Graceful Shutdown depends on: Process management setup (systemd, k8s)

## 7. Non-Functional Requirements

### Performance
- API response time < 200ms for non-generation endpoints
- Generation status updates within 5 seconds of completion
- Frontend initial load < 3 seconds

### Security
- All API keys stored in environment variables
- Webhook signatures verified for all providers
- Rate limits enforced at API gateway level

### Reliability
- 99.9% uptime for API
- Automatic credit refund on generation failure
- Idempotent generation requests

---

## 8. Out of Scope (Not Implemented in This Roadmap)

- Mobile native applications
- White-label/enterprise deployment
- Custom model training
- Video-to-video transformation (style transfer)
- Multi-language UI
## Completed Implementations

The following Phase 1 and Phase 2 features have been implemented:

### Phase 1: Critical Fixes (All Complete)
- ✅ Fixed duplicate DELETE route in videos.js
- ✅ Added input validation with sanitization (prompts, negative prompts, resolution, aspect ratio, duration)
- ✅ Fixed SSE memory leak in integrated-ai.js with proper cleanup handlers
- ✅ Added React Error Boundary component wrapping GeneratePage, LibraryPage, VideoDetailPage
- ✅ Made generation polling configurable via ENV variables

### Phase 2: High-Impact Features (Backend + API Client Complete)
- ✅ Batch Generation - API endpoints created with atomic transactions
- ✅ Preview Before Charge - Preview generation, confirm/cancel endpoints
- ✅ 4K Resolution Support - Added to all Veo 3.1 models (2x credit cost of 1080p)

### Remaining (Frontend Integration)
- Batch input UI in GeneratePage
- PreviewConfirmDialog integration in GeneratePage
- ResolutionPicker 4K option update

The spec is complete and ready for frontend implementation.