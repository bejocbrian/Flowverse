# Deployment Guide — FlowVerse (Hostinger)

> **TL;DR:** Push to `main` → GitHub Actions builds & FTP-deploys automatically.  
> Frontend is static files on Hostinger. Backend is a Node.js app on Hostinger.  
> **The one manual step:** after the API deploy workflow finishes, restart the Node.js app in hPanel.

---

## Architecture

```
GitHub (main branch)
   │
   ├─ apps/web/ changes  →  [deploy-web.yml]  →  FTP → Hostinger static hosting
   │                                              bisque-hamster-792062.hostingersite.com
   │
   └─ apps/api/ changes  →  [deploy-api.yml]  →  FTP → Hostinger Node.js app
                                                   linen-herring-814961.hostingersite.com
```

**Third service — PocketBase (database):** Hosted separately (PocketHost or another Hostinger Node.js slot). Its URL is set via the `POCKETBASE_URL` environment variable on the API.

---

## How Deploys Trigger

| What you push/merge to `main` | What runs |
|-------------------------------|-----------|
| Changes in `apps/web/**` | `deploy-web.yml` — builds Vite app, FTPs `dist/` to Hostinger |
| Changes in `apps/api/**` | `deploy-api.yml` — installs prod deps, FTPs `apps/api/` to Hostinger |
| Changes in both | Both workflows run in parallel |
| Changes only in docs/config not in `apps/` | Neither deploy runs (saves time) |
| Manually via GitHub → Actions → Run workflow | Either workflow, on demand |

CI (`ci.yml`) also runs on every push and PR — it lints, builds, and validates the lockfile. It does **not** deploy.

---

## Required GitHub Secrets & Variables

Go to **GitHub → your repo → Settings → Secrets and variables → Actions**.

### Secrets (encrypted, never shown in logs)

**Web (bisque-hamster-792062) — static frontend:**

| Secret name | What it is |
|-------------|-----------|
| `FTP_HOST` | FTP IP/hostname (e.g. `82.112.239.205`) |
| `FTP_USERNAME` | FTP username (e.g. `u853826912.bisque-hamster-792062.hostingersite.com`) |
| `FTP_PASSWORD` | FTP password for the web site |

**API (linen-herring-814961) — Node.js backend:**

| Secret name | What it is |
|-------------|-----------|
| `FTP_API_HOST` | FTP IP/hostname (same server: `82.112.239.205`) |
| `FTP_API_USERNAME` | FTP username (e.g. `u853826912.linen-herring-814961.hostingersite.com`) |
| `FTP_API_PASSWORD` | FTP password for the API site |

**Build secrets (used during Vite build):**

| Secret name | What it is |
|-------------|-----------|
| `VITE_API_URL` | Full URL of your API, e.g. `https://linen-herring-814961.hostingersite.com` |
| `VITE_POCKETBASE_URL` | Full URL of your PocketBase instance |
| `VITE_CASHFREE_ENV` | `sandbox` or `production` |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key |

> **Note:** Web and API are on separate Hostinger sites with different FTP accounts. Each needs its own set of FTP secrets.

---

## The One Manual Step After API Deploy

Hostinger's Node.js hosting does **not** auto-restart the process when files change via FTP. After `deploy-api.yml` completes:

1. Log into [hPanel](https://hpanel.hostinger.com)
2. Go to **Websites → linen-herring-814961 → Node.js**
3. Click **Restart**

The old process will keep running the old code until you do this. The frontend never needs a restart — it's just static files served by Apache.

---

## Environment Variables on Hostinger (API)

The `.env` file is excluded from the FTP deploy (by design — never commit secrets). You must set env vars directly in Hostinger hPanel:

1. hPanel → **Websites → linen-herring-814961 → Node.js → Environment Variables**
2. Add each variable from `apps/api/.env.example`

Key variables you must have set:

```
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://bisque-hamster-792062.hostingersite.com
POCKETBASE_URL=<your pocketbase url>
PB_SUPERUSER_EMAIL=<admin email>
PB_SUPERUSER_PASSWORD=<admin password>
GEMINIGEN_API_URL=https://api.geminigen.ai/uapi/v1
GEMINIGEN_API_KEY=<your key>
WEBSITE_ID=<your id>
WEBSITE_DOMAIN=bisque-hamster-792062.hostingersite.com
CASHFREE_APP_ID=<your id>
CASHFREE_SECRET_KEY=<your key>
CASHFREE_ENV=production
CASHFREE_WEBHOOK_URL=https://linen-herring-814961.hostingersite.com/webhooks/cashfree
TURNSTILE_SECRET_KEY=<your key>
```

See `apps/api/.env.example` for the full list with descriptions.

---

## Full Deployment Flow Diagram

```
Developer opens PR
      │
      ▼
ci.yml runs on PR:
  ✓ Lockfile sync check
  ✓ Lint API (if api/ changed)
  ✓ Lint + Build web (if web/ changed)
  ✓ All pass? → PR is green, safe to merge
      │
      ▼
Merge PR into main
      │
      ├──► deploy-web.yml (if web/ changed)
      │       1. Checkout code
      │       2. npm ci (root + web)
      │       3. vite build (uses VITE_* secrets)
      │       4. Verify build output (index.html exists)
      │       5. FTP upload apps/web/dist/ → Hostinger static site
      │       6. Verify deployment (HTTP check)
      │       ✓ Live immediately (Apache serves new files)
      │
      └──► deploy-api.yml (if api/ changed)
              1. Checkout code
              2. npm ci --omit=dev (prod deps only)
              3. FTP upload apps/api/ (src + node_modules) → Hostinger Node.js
              4. ⚠️  MANUAL: restart Node.js app in hPanel
              ✓ Live after restart
```

---

## Finding Your FTP Credentials

1. [hPanel](https://hpanel.hostinger.com) → **Websites** → select the site
2. **Files → FTP Accounts**
3. Use the main FTP account credentials, or create a dedicated one
4. The hostname is shown there (usually `ftp.<yourdomain>` or the server hostname)

---

## Checking Deploy Status

- **GitHub → Actions tab** — see live logs for every workflow run
- A red ✗ on a commit means CI or deploy failed — click it to see which step broke
- **Hostinger hPanel → Node.js → Logs** — see runtime errors from the API process

---

## Rollback

**Frontend:** Upload the previous build's `dist/` via FTP, or re-run the deploy workflow on the previous commit:
- GitHub → Actions → Deploy Web to Hostinger → Run workflow → select the commit SHA

**Backend:** Re-run the deploy workflow on a previous commit SHA, then restart in hPanel.

---

## Common Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Frontend shows old version after merge | Browser cache or `.htaccess` not deployed | Hard refresh (Ctrl+Shift+R). Verify `.htaccess` is in `apps/web/public/` |
| Deploy workflow fails at FTP step | Wrong FTP credentials or FTP blocked | Check `FTP_HOST`, `FTP_USERNAME`, `FTP_PASSWORD` secrets. Verify FTP works from another client |
| Build succeeds but deploy fails | FTP connection timeout or Hostinger rate limit | Re-run the workflow. Check Hostinger FTP status |
| Web build fails in CI | Missing secret `VITE_API_URL` | Add the secret in GitHub Settings |
| API returns old responses after merge | Node.js process not restarted | Restart in hPanel → Node.js |
| API crashes on startup | Bad env var or missing `.env` in hPanel | Check hPanel → Node.js → Environment Variables and compare to `.env.example` |
| CORS errors in browser | `CORS_ORIGIN` env var not matching frontend URL | Update `CORS_ORIGIN` in hPanel to exactly match the frontend domain |
| Payment webhooks not received | Webhook URL not updated | Update `CASHFREE_WEBHOOK_URL` (and equivalent for other gateways) in hPanel to point to the API URL |
| FTP deploy fails with "connection refused" | Hostinger FTP server temporarily down | Wait 5 min and re-run. Check Hostinger status page |
| FTP deploy fails with "530 Login incorrect" | FTP password rotated or account locked | Reset FTP password in hPanel and update GitHub secret |

---

## Branch Strategy

```
main          ← production (protected, deploys automatically)
feature/*     ← development branches, open PRs against main
```

- Never push directly to `main` for significant changes
- Always open a PR — CI runs and must be green before merging
- Merging the PR triggers the deploy automatically

---

## Node.js Version

The project uses **Node.js 22** (defined in `.nvmrc`). Hostinger must be configured to use Node.js 22:

hPanel → **Node.js** → Node.js version → select **22.x**

---

## File Structure Reference

```
horizons-export-…/
├── apps/
│   ├── api/          ← Express backend (deploys to Node.js hosting)
│   │   ├── src/      ← Application source
│   │   ├── package.json
│   │   └── .env.example
│   ├── web/          ← React/Vite frontend (deploys as static files)
│   │   ├── src/
│   │   ├── public/
│   │   │   └── .htaccess   ← SPA routing + cache headers for Apache
│   │   └── package.json
│   └── pocketbase/   ← Local dev only, hosted separately in production
├── .github/
│   └── workflows/
│       ├── ci.yml          ← Lint + build on every PR/push
│       ├── deploy-api.yml  ← Deploy API to Hostinger on main push
│       ├── deploy-web.yml  ← Deploy Web to Hostinger on main push
│       └── codeql.yml      ← Weekly security scan
├── DEPLOYMENT.md      ← This file
└── STARTUP_INSTRUCTIONS.md  ← Local development setup
```

---

## Workflow Details

### deploy-web.yml

- **Trigger:** Push to `main` with changes in `apps/web/**`
- **Steps:** Install deps → Vite build → Verify build output → FTP upload → HTTP verification
- **Action version:** `SamKirkland/FTP-Deploy-Action@v4.4.0`
- **Build output:** `apps/web/dist/` (includes `index.html`, hashed JS/CSS bundles, `.htaccess`)
- **Cache strategy:** `.htaccess` sets `no-cache` on `index.html`, `immutable` on hashed assets
- **Post-deploy:** Automatic HTTP check to verify site is reachable

### deploy-api.yml

- **Trigger:** Push to `main` with changes in `apps/api/**`
- **Steps:** Install prod deps → FTP upload → Reminder to restart
- **Action version:** `SamKirkland/FTP-Deploy-Action@v4.4.0`
- **Deployed files:** `apps/api/` (src + node_modules, excludes `.env`)
- **Post-deploy:** ⚠️ Manual restart required in hPanel

### ci.yml

- **Trigger:** Push to `main` or PR against `main`
- **Steps:** Lockfile sync → Lint API (if changed) → Lint + Build web (if changed)
- **Does NOT deploy** — only validates code quality
- **Concurrency:** Cancels previous in-progress runs for same ref

---

## FTP Connection Notes

- Hostinger shared hosting **blocks SSH from external IPs** — FTP is the only viable option from GitHub Actions runners
- FTP port is typically **21** (standard FTP, not SFTP)
- The FTP action uses incremental sync — only changed files are uploaded
- `dangerous-clean-slate: false` preserves files not in the build output (e.g., `.htaccess` if not in `public/`)
- If FTP credentials expire, update them in hPanel and re-set the GitHub secrets

---

## PocketBase Retention Cron

The project includes a PocketBase hook (`apps/pocketbase/pb_hooks/video-retention.pb.js`) that runs a daily cleanup of videos older than 30 days. This prevents storage bloat on PocketBase.

- **Endpoint:** `GET /cron/video-retention`
- **Retention period:** 30 days (configurable via `VIDEO_RETENTION_DAYS` env var)
- **Scope:** Internal only (localhost/127.0.0.1)
- **What it does:** Deletes old video records and their associated files (video_url, thumbnail_url)

To trigger manually:
```bash
curl http://localhost:8090/cron/video-retention
```
