# Deploy PocketBase to Railway from this repo

This folder builds into a self-contained Docker image that:
- Bundles `pb_migrations/` and `pb_hooks/` into `/app/`
- On every boot, PocketBase auto-runs any new migrations against the SQLite DB at `/pb_data/`
- Persists data via a Railway volume mounted at `/pb_data`

So the workflow is: add a migration file → `git push` → Railway rebuilds → migration runs.

---

## One-time Railway setup

1. **Create a new Railway service** (or reconfigure the existing one to build from the repo):
   - Railway dashboard → your project → **+ New** → **GitHub Repo**
   - Pick this repository
   - When asked for **Root Directory**, set: `apps/pocketbase`
   - Builder will auto-detect the `Dockerfile`

2. **Add a volume**:
   - Click the new service → **Settings** → **Volumes** → **+ New Volume**
   - Mount path: `/pb_data`
   - Size: 1 GB is plenty to start

3. **Set environment variables**:
   - `PB_SUPERUSER_EMAIL` = `nikhil@localayerai.com`
   - `PB_SUPERUSER_PASSWORD` = `<your password>`
   - (Railway auto-injects `PORT`; do not override it)

4. **Generate a public domain**:
   - Service → **Settings** → **Networking** → **Generate Domain**
   - Note this URL. Example: `https://pocketbase-production-xxxx.up.railway.app`

5. **First deploy**:
   - Railway builds the Docker image and starts the container
   - On first boot, PocketBase creates a fresh SQLite DB in the volume, then runs every file in `pb_migrations/` in order
   - The `1764579159_create_superuser.js` migration seeds your superuser from the env vars above

6. **Verify**:
   - Open `https://<your-domain>/api/health` → should return `{"message":"API is healthy.",...}`
   - Open `https://<your-domain>/_/` → log in with the superuser email/password
   - Confirm collections `users`, `videos`, `transactions`, `settings`, `favorites`, `shared_videos`, `providers`, `prompts` exist

---

## Switching the API to the new PocketBase

Once verified:

1. In Hostinger → Node.js app → **Environment Variables**, change:
   ```
   POCKETBASE_URL=https://<your-new-domain>
   PB_SUPERUSER_EMAIL=nikhil@localayerai.com
   PB_SUPERUSER_PASSWORD=<your password>
   ```
2. Restart the Node.js app
3. Test signup:
   ```
   curl -X POST https://linen-herring-814961.hostingersite.com/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"u1@example.com","password":"test12345","name":"User One"}'
   ```
   You should get back a `token` and a row in the `users` collection.

4. Once stable, you can decommission the old Railway PocketBase service.

---

## Adding a new migration later

1. Create a new file under `apps/pocketbase/pb_migrations/` with a timestamp prefix higher than any existing one. The simplest approach is to run PocketBase locally, make the schema change in the admin UI, then export migrations:

   ```bash
   cd apps/pocketbase
   ./pocketbase migrate collections
   ```

   That writes a new migration file capturing the change.

2. Commit and push. Railway rebuilds, container restarts, PocketBase runs only the new file (it tracks applied migrations in the SQLite DB).

---

## Troubleshooting

**Build fails on `pocketbase_X.X.X_linux_amd64.zip` 404**

- Pin the version in `Dockerfile` (`ARG PB_VERSION=...`) to a release that exists at <https://github.com/pocketbase/pocketbase/releases>.

**Container restarts in a loop**

- Look at Railway logs. Common cause: a migration threw because the field/collection it expects already exists with a different shape. Most of our migrations guard against that, but a custom one might not. Fix the migration to be idempotent.

**Data wiped after deploy**

- The volume is not mounted at `/pb_data`. Confirm the volume is attached and the mount path is exactly `/pb_data`.

**`Failed to authenticate` from the API**

- The `PB_SUPERUSER_*` env vars in Hostinger don't match what's in PocketBase. They must match the values you set on the PocketBase service (which is what the migration uses to seed the superuser on first boot).
