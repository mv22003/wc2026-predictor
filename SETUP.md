# WC 2026 Predictor — Setup Guide

## Quick Start (Local Dev)

```bash
# 1. Install all dependencies
cd wc2026-predictor
npm run install:all

# 2. Copy env file and configure
cp .env.example .env
# Edit .env — change ADMIN_KEY to something secret!

# 3. Seed the database with WC 2026 teams & matches
node seed.js

# 4. Start the backend (terminal 1)
npm run dev:server   # runs on http://localhost:3001

# 5. Start the frontend (terminal 2)
npm run dev:client   # runs on http://localhost:5173
```

## Deploy to Render (Production)

1. Push this folder to a **GitHub repo**.
2. Go to https://render.com → New → Web Service → connect your repo.
3. Render auto-detects `render.yaml` — just click **Deploy**.
4. After deploy, open the Render dashboard → your service → **Environment** tab.
5. Copy the auto-generated `ADMIN_KEY` — this is your admin password.
6. **SSH into the service** (or use Render shell) and run the seed once:
   ```bash
   node seed.js
   ```
7. Share the URL with your group!

## Admin Panel

- Visit `/admin` and enter your `ADMIN_KEY`.
- Enter match results as games are played — scores update automatically.
- The leaderboard recalculates instantly for all users.

## Scoring Rules (easy to change)

Edit `server/src/scoring.js`:

| Result | Points |
|--------|--------|
| Exact scoreline | **3 pts** |
| Correct outcome (W/D/L) | **1 pt** |
| Wrong | 0 pts |

## Adding WC 2026 Logo

Replace the `⚽` placeholder in `client/src/App.jsx` and `client/src/pages/Home.jsx`
with an `<img>` tag pointing to your logo file in `client/public/`.

## Verify Team Groups

The seed data in `seed.js` is based on the December 2024 draw.
Double-check and edit the `teams` array if any group assignments are wrong.
