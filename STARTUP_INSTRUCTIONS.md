# Video Generation Platform - Startup Instructions

## First-Time Setup

### 1. Create PocketBase Superuser

Before the API can connect to PocketBase, you need to create a superuser account.

1. **Start only PocketBase first:**
   ```powershell
   cd apps\pocketbase
   npm run dev
   ```

2. **Open the PocketBase admin panel:**
   - The terminal will show a URL like: `http://0.0.0.0:8090/_/#/pbinstall/...`
   - Open that URL in your browser
   - OR manually visit: `http://localhost:8090/_/`

3. **Create superuser with these credentials:**
   - Email: `admin@example.com`
   - Password: `adminpassword123`
   
   ⚠️ **IMPORTANT**: These MUST match the values in `apps/api/.env`:
   ```
   PB_SUPERUSER_EMAIL=admin@example.com
   PB_SUPERUSER_PASSWORD=adminpassword123
   ```

4. **Stop PocketBase** (Ctrl+C) and proceed to the next step.

### 2. Start All Services

Now start the full application:

```powershell
npm run dev
```

This starts:
- **Web** (Vite frontend) → http://localhost:3000
- **API** (Express backend) → http://localhost:3001
- **PocketBase** (Database) → http://localhost:8090

### 3. Create Your First User Account

### Terminal 2: Run the Webhook Tunnel (Localtunnel)
Because SnapGen is on the public internet, it cannot send "Video Completed" webhooks directly to your `localhost:3001`. You must run a tunnel to expose it.

1. Visit http://localhost:3000/signup
2. Create a regular user account (not admin)
3. You'll start with 80 free credits

## Common Issues

### Issue: "Failed to initialize PocketBase client: 400"

**Cause:** Superuser credentials in `.env` don't match PocketBase.

**Fix:**
1. Check `apps/api/.env` has correct `PB_SUPERUSER_EMAIL` and `PB_SUPERUSER_PASSWORD`
2. Visit http://localhost:8090/_/ and verify the superuser exists
3. Restart: `npm run dev`

### Issue: "Signup error: An error occurred while validating the submitted data"

**Important Note about Localtunnel/Ngrok:**
Yes! Every time you close this terminal, the tunnel dies. When you restart it, you will get a **new random URL** (e.g. `https://random-word.loca.lt`). 
Because of this, every time you start a new localtunnel session, you **must** copy the new URL, go to the SnapGen Dashboard, and update your Webhook URL to: `https://<YOUR-NEW-URL>.loca.lt/webhooks/snapgen`

**Cause:** PocketBase schema not initialized, or captcha issues.

**Fix:**
1. Check PocketBase is running: http://localhost:8090/api/health
2. In dev mode, captcha verification is skipped (TURNSTILE_SECRET_KEY is empty)
3. Check browser console for detailed errors

### Issue: "pocketbase is not recognized"

**Cause:** Path issues with spaces in Windows.

**Fix:** Already fixed via `apps/pocketbase/pocketbase.cmd` wrapper script.

## Environment Files

Two `.env` files are required:

### `apps/api/.env`
Contains API configuration including PocketBase credentials, payment gateways, AI API keys.

### `apps/pocketbase/.env`
Contains only the encryption key for PocketBase data.

## Development Workflow

1. **Start development servers:** `npm run dev`
2. **Access frontend:** http://localhost:3000
3. **Access PocketBase admin:** http://localhost:8090/_/
4. **API endpoints:** http://localhost:3001

## Phase 1-2 Completed Features

✅ **Phase 1 (Critical Fixes)**
- Fixed duplicate DELETE route
- Added input validation & sanitization
- Fixed SSE memory leaks
- Added React error boundaries
- Made polling configurable via ENV

✅ **Phase 2 (High-Impact Features - Backend)**
- Batch generation API
- Preview before charge API
- 4K resolution support (Veo 3.1 models)

🔄 **Remaining (Frontend Integration)**
- Batch input UI
- Preview confirmation dialog
- 4K resolution picker option

## Next Steps

After getting the app running, see the roadmap spec at:
`.kiro/specs/video-generation-platform-roadmap/`
