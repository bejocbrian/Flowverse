# Aether Video — Abuse Defense Plan

A living document. Tracks what's shipped, what's pending, and what's queued for later.

## Status legend

- ✅ Implemented and shipped to production
- 🟡 Implemented in code but waiting on external setup (env vars, third-party account, etc.)
- 🔴 Not started
- ⏸️ Intentionally deferred

---

## Threat model

The product gives every authenticated user 10 free credits worth of video/image generations. Each generation calls a paid third-party API (GeminiGen). So **every successful abuse = real money out**. Two main attack patterns:

1. **Account farming** — bot creates N email accounts to get N × 10 free credits.
2. **Single-account amplification** — one user finds a bug or race condition that lets them generate without consuming credits.

Secondary concerns:
- Direct PocketBase calls bypassing API logic
- Stripe webhook spoofing
- Rate limit bypass via IP rotation

---

## Tier 1 — Implemented in code

Core defenses written, committed, and deployed (subject to external steps below).

| # | Defense | Status | Files |
|---|---|---|---|
| 1 | Cloudflare Turnstile on signup + login | 🟡 Code shipped, **needs Turnstile site/secret keys** | `apps/api/src/utils/turnstile.js`, `apps/web/src/components/TurnstileWidget.jsx` |
| 2 | Email verification before granting free credits | 🟡 Code shipped, **needs SMTP** | `apps/pocketbase/pb_hooks/grant-initial-credits.pb.js` |
| 3 | Disposable email domain blocklist (~121k providers) | ✅ | `apps/api/src/utils/disposableEmails.js` |
| 4 | PocketBase `users.createRule = null` (only API can create users) | ✅ | `apps/pocketbase/pb_migrations/1779800000_lock_users_create_rule.js` |
| 5 | Free credits dropped from 100 to 10 (granted on verification) | ✅ | `pb_hooks/grant-initial-credits.pb.js` constant `INITIAL_CREDITS` |
| 6 | Idempotency key on video generate + regenerate (5-min window) | ✅ | `apps/api/src/routes/videos.js`, `apps/api/src/routes/video-regenerate.js`, `apps/pocketbase/pb_migrations/1779800001_add_idempotency_key_to_videos.js` |
| 7 | Per-route rate limiters (signup 5/h, login 10/15min, reset 5/h) | ✅ | `apps/api/src/routes/auth.js` |
| 8 | Frontend goes through `/auth/login` (not direct PB) so captcha + rate limits actually apply | ✅ | `apps/web/src/contexts/AuthContext.jsx` |

### Tier 1 — External setup remaining (you do these)

These are config, not code. Without them, items 1 and 2 above are no-ops.

#### 1A. Cloudflare Turnstile keys (free)

1. <https://dash.cloudflare.com/sign-up>
2. Turnstile → **Add a site** → enter `bisque-hamster-792062.hostingersite.com`
3. Mode: **Managed** (invisible to most users)
4. Copy the **Site Key** and **Secret Key**
5. **Site key** → `apps/web/.env.production`:
   ```
   VITE_TURNSTILE_SITE_KEY=0x4AAAA...
   ```
6. **Secret key** → Hostinger Node.js app environment variables:
   ```
   TURNSTILE_SECRET_KEY=0x4AAAA-secret...
   ```
7. Restart the Node.js app
8. Rebuild the frontend: `cd apps/web && npx vite build --outDir dist`
9. Re-upload `dist/` contents to `bisque-hamster-792062`'s `public_html`

#### 1B. Resend SMTP for verification emails

Without SMTP, signups stay at 0 credits forever (because `verified` never flips to `true`).

1. Sign up at <https://resend.com>
2. Either use `onboarding@resend.dev` (limited to your own email — fine for testing) or add and verify your own domain
3. Create an API key (starts with `re_...`)
4. PocketBase admin → Settings → Mail settings → enable SMTP:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: `<your re_... API key>`
   - TLS: ON
   - Auth method: PLAIN
5. Set sender address (`onboarding@resend.dev` or your own)
6. Save and click **Send test email** to verify

---

## Tier 2 — Backlog (do within a few weeks)

Address race conditions and harden against more determined attackers.

### 2.1 Replace compensation-based "transactions" with atomic updates

**Why:** `withTransaction` in `apps/api/src/utils/dbTransaction.js` is best-effort. PocketBase doesn't have row locks, so two concurrent generations from the same user can both pass the `credits_balance < cost` check before either deducts.

**Options:**

- **A. Optimistic locking via the `updated` field**
  Read user with `updated` timestamp, attempt update where `updated = X`. If conflict, retry.
- **B. Append-only `credit_ledger` collection**
  Every charge/refund is an INSERT, never UPDATE. Balance = `SUM(amount) WHERE user_id = X`. Auditable, race-proof. Bigger refactor.

Recommendation: B for new features, A as a quick patch.

### 2.2 Daily generation cap per user ✅

**Why:** A single compromised paying account can drain GeminiGen budget overnight. Equally, free users are only balance-capped on *successful* generations — failed generations are auto-refunded, leaving a "submit → fail → refund → resubmit" loop that hammers the paid provider without draining credits.

**Implemented:** Middleware-style check `checkDailyGenerationCap` (`apps/api/src/utils/generationLimit.js`) runs inside both `POST /videos` and `POST /videos/:id/regenerate`, after the idempotency replay check (so genuine retries are exempt). Counts `videos` rows created by the user in the last 24h and rejects with HTTP 429 (`code: DAILY_LIMIT_REACHED`) once the cap is hit. Regenerate reserves `variationCount` slots up front.

- Free vs paid: a user is "paid" once they have any `transactions.type='purchase'`.
- Caps configurable from the admin Settings page ("Abuse Controls" tab), backed by `settings` keys `free_daily_generation_cap` (default 50) and `paid_daily_generation_cap` (default 500); env (`FREE_DAILY_GENERATION_CAP` / `PAID_DAILY_GENERATION_CAP`) provides the fallback defaults.
- Fail-open: if the count query errors, the request is allowed (never block a paying customer on a transient PB hiccup).
- A complementary per-user **burst rate limit** throttles free users only (`apps/api/src/middleware/generation-rate-limit.js`); paid users bypass it. Burst max is admin-configurable (`free_generation_rate_max`, default 5/60s). Tier lookups are cached (`utils/userTier.js`) and settings are cached with fail-open defaults (`utils/abuseSettings.js`).

Storage: PocketBase aggregate query (`getList(1, 1, { filter: 'user_id="X" && created >= ...' })`) with `totalItems`. No Redis needed.

### 2.3 Persistent rate limiter store

**Why:** `express-rate-limit` is in-memory. API restarts wipe counters. Multiple workers each have separate counters.

**Where:** Add a `rate_limit_buckets` PocketBase collection or wire a Redis adapter. Replace `validate: { trustProxy: false }` once we've decided on the persistent store.

Note: Hostinger Node.js currently runs as a single process per app, so this is a lower priority until you scale.

### 2.4 Stripe webhook verification end-to-end

**Why:** I haven't audited the full Stripe flow. If `STRIPE_WEBHOOK_SECRET` is missing or wrong, fake webhook calls could grant credits.

**Where:** `apps/api/src/routes/stripe.js`. Confirm `stripe.webhooks.constructEvent` is called and rejects bad signatures BEFORE any credit grant. Add an integration test.

Also: GeminiGen webhook signature (`GEMINIGEN_WEBHOOK_PUBLIC_KEY_PATH`) is currently optional (`apps/api/src/routes/webhooks.js`). Make it required in production env.

### 2.5 Tighten PocketBase access rules

Currently the Railway PocketBase URL is publicly callable. Auth rules limit damage but a determined attacker can probe.

- Make sure all collection `listRule`/`viewRule`/`updateRule`/`deleteRule` are user-scoped where appropriate (most already are).
- Add a CORS allow-list to the PocketBase admin: Settings → Application → only allow your frontend domain.

### 2.6 Concurrency limit per user

Max 1 in-flight generation. Forces sequential use, makes credit-burning slower.

Implementation: before creating a video, count `where user_id = X AND status IN ('queued', 'generating')`. If >= 1, reject with 429.

### 2.7 Lower bundle's exposure to direct PocketBase calls

Several places in the frontend still call `pb.collection(...).update(...)` directly (e.g., `AuthContext.updateProfile`, video favorites). These bypass our API entirely.

Audit and decide: either keep the calls (relying purely on PB rules) or route them through the API for centralized logging and rate limiting.

---

## Tier 3 — Only if abuse continues despite Tier 1 + 2

These cost money or add user friction.

### 3.1 Phone verification for free credits

Twilio Verify, Resend.io's phone product, or similar. ~$0.05/SMS. Stops everything except very motivated attackers.

Pattern: signup grants 0 credits → user adds phone → SMS code → 10 credits.

### 3.2 Card auth (no charge) to claim free credits

Stripe SetupIntent — verify the user has a real card without charging. Combine with "free credits given on first paid generation" so they have skin in the game.

### 3.3 ML fraud signals

Sift, Castle, or Stripe Radar. Looks at signup velocity, IP reputation, device fingerprints. Overkill unless you're seeing real money lost.

### 3.4 Device / browser fingerprinting

FingerprintJS Pro free tier. Detects "same device, 50 different emails". Reject the second+ signup from the same fingerprint within a window.

### 3.5 Freeze on suspicious activity

A user who generates 50 videos in 10 minutes from 5 different IPs gets auto-frozen pending review. Notify your admin via email/Discord webhook.

### 3.6 Honeypot fields on signup

Add hidden form fields. If filled, reject (most bots fill all fields). Cheap, complementary to Turnstile.

---

## Operational notes

### Secrets that have been in repo history (rotate when convenient)

These were committed before we cleaned things up. Treat as compromised.

- GeminiGen API key: `geminiai-621d1d1e12986601bf0af0ce4a1201d4` — rotate at GeminiGen dashboard
- Old PocketBase admin password (`Admin123456!`) — already replaced with a new password, but the old one is in history

### How to verify Tier 1 defenses are actually working

Once Turnstile keys + SMTP are configured, run these manually:

```bash
# 1. Disposable email blocked
curl -X POST https://linen-herring-814961.hostingersite.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"x@mailinator.com","password":"smoke12345","name":"Bot"}'
# Expect: 400 "This email provider is not allowed."

# 2. Captcha required (when TURNSTILE_SECRET_KEY is set)
curl -X POST https://linen-herring-814961.hostingersite.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"a@gmail.com","password":"smoke12345","name":"Bot"}'
# Expect: 400 "Captcha verification failed"

# 3. Rate limit on signup
for i in {1..10}; do
  curl -X POST https://linen-herring-814961.hostingersite.com/auth/signup \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"x$i@gmail.com\",\"password\":\"smoke12345\",\"name\":\"X\"}"
done
# Expect: first ~5 fail validation/captcha, the rest 429 "Too many signup attempts"

# 4. Direct PocketBase user creation rejected
curl -X POST https://pocketbase-production-4ff9.up.railway.app/api/collections/users/records \
  -H "Content-Type: application/json" \
  -d '{"email":"a@gmail.com","password":"smoke12345","passwordConfirm":"smoke12345","name":"Bot"}'
# Expect: 403 or "createRule"-style rejection

# 5. New signup gets 0 credits, gets 10 after verification
# (Manual: sign up via the UI, check users table - credits_balance=0, then click email link, recheck - credits_balance=10)

# 6. Idempotency replay returns same video
# (Manual: open DevTools, fire two POST /videos in <5s with same idempotency_key - expect identical response and only one new row)
```

### Monitoring abuse signals

Without a SIEM, the cheapest signals to watch are:

- **Spike in `/auth/signup` 4xx responses** — bot probing
- **Spike in PocketBase `users` collection size with low `verified=true` ratio** — disposable signups slipping through
- **Sudden GeminiGen bill increase** — credit burn vector
- **Rate of `transactions.type='generation'` per user** — anomaly detection

For now, eyeball the Hostinger Node.js logs and Railway PocketBase admin's `users` and `transactions` views weekly.

---

## Decision log

- **2026-05-26** — Tier 1 #1 (Turnstile) and #2 (email verification) implemented but external setup deferred at user's request. Will revisit before a real launch.
- **2026-05-26** — Free credits 100 → 10. Granted on email verification, not on signup.
- **2026-05-26** — `users.createRule` set to `null`. All user creation must go through API superuser client.
