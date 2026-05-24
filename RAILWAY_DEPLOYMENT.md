# Railway Deployment Guide

This guide walks you through deploying your LocalayerAI application to Railway.

## Architecture

We'll deploy 3 separate services on Railway:

1. **API** (Node.js Express) - Port 3001
2. **Web** (React static files) - Port 3000  
3. **PocketBase** (Database) - Port 8090

## Prerequisites

- GitHub account with your code pushed to a repository
- Railway account (sign up at [railway.app](https://railway.app))

## Step 1: Push Code to GitHub

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Add your GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to GitHub
git push -u origin main
```

## Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub
5. Select your repository

## Step 3: Deploy PocketBase (Database)

### Option A: Use Railway's PocketBase Template

1. In your Railway project, click "Add Service"
2. Search for "PocketBase" in the templates
3. Click to deploy
4. Set the following environment variables:
   - `PB_SUPERUSER_EMAIL` = your-admin-email@example.com
   - `PB_SUPERUSER_PASSWORD` = your-secure-password
5. Deploy and note the generated URL (e.g., `https://pocketbase-production-xxx.up.railway.app`)

### Option B: Use PocketHost (Free, Easier)

1. Go to [pockethost.io](https://pockethost.io)
2. Create a free account
3. Create a new PocketBase instance
4. Note your PocketBase URL (e.g., `https://your-instance.pockethost.io`)

## Step 4: Deploy the API

1. In your Railway project, click "Add Service"
2. Select "GitHub Repo"
3. Select your repository
4. Set the **Root Directory** to `apps/api`
5. Set environment variables:

```env
PORT=3001
CORS_ORIGIN=${{RailwayStaticURL}}
NODE_ENV=production

POCKETBASE_URL=https://your-pocketbase-url
PB_SUPERUSER_EMAIL=your-admin-email
PB_SUPERUSER_PASSWORD=your-admin-password

INTEGRATED_AI_API_URL=https://api.geminigen.ai/uapi/v1
INTEGRATED_AI_API_KEY=your-geminigen-api-key
WEBSITE_ID=your-website-id
WEBSITE_DOMAIN=your-railway-url

STRIPE_SECRET_KEY=sk_live_your-stripe-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
```

6. Click "Deploy"

## Step 5: Deploy the Web App

1. In your Railway project, click "Add Service"
2. Select "GitHub Repo"
3. Select your repository
4. Set the **Root Directory** to `apps/web`
5. Set environment variables:

```env
VITE_API_URL=https://your-api-url.up.railway.app
VITE_POCKETBASE_URL=https://your-pocketbase-url
```

6. Click "Deploy"

## Step 6: Configure CORS

Update your API's `CORS_ORIGIN` environment variable to include your web app's Railway URL.

## Step 7: Set Up Custom Domain (Optional)

1. In each service, go to "Settings" > "Domains"
2. Add your custom domain
3. Follow Railway's DNS instructions

## Environment Variables Reference

### API (`apps/api`)

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `CORS_ORIGIN` | Allowed frontend origin | `https://your-frontend.railway.app` |
| `NODE_ENV` | Environment | `production` |
| `POCKETBASE_URL` | PocketBase instance URL | `https://pb.yourdomain.com` |
| `PB_SUPERUSER_EMAIL` | PocketBase admin email | `admin@example.com` |
| `PB_SUPERUSER_PASSWORD` | PocketBase admin password | `your-secure-password` |
| `INTEGRATED_AI_API_URL` | GeminiGen API URL | `https://api.geminigen.ai/uapi/v1` |
| `INTEGRATED_AI_API_KEY` | GeminiGen API key | `geminiai-xxx` |
| `WEBSITE_ID` | GeminiGen website ID | `your-website-id` |
| `WEBSITE_DOMAIN` | Your website domain | `yourdomain.com` |
| `STRIPE_SECRET_KEY` | Stripe API key | `sk_live_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | `whsec_xxx` |

### Web (`apps/web`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://api.yourdomain.com` |
| `VITE_POCKETBASE_URL` | PocketBase URL | `https://pb.yourdomain.com` |

## Troubleshooting

### Build Fails

1. Check the build logs in Railway
2. Ensure all dependencies are in `package.json`
3. Verify the root directory is set correctly

### API Can't Connect to PocketBase

1. Verify `POCKETBASE_URL` is correct
2. Check if PocketBase is running
3. Ensure CORS is configured in PocketBase

### Frontend Shows Blank Page

1. Check browser console for errors
2. Verify `VITE_API_URL` and `VITE_POCKETBASE_URL` are set
3. Ensure API is running and accessible

## Monitoring

Railway provides:
- Real-time logs
- Metrics (CPU, Memory, Network)
- Deployment history
- Automatic restarts on failure

## Costs

Railway offers:
- $5 free credit per month
- Pay-as-you-go pricing after that
- Estimated cost for MVP: $5-15/month

## Need Help?

- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
