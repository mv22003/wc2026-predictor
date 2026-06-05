# WC 2026 Predictor

A full-stack World Cup 2026 prediction game. Players predict scorelines for every group stage match, earn points based on accuracy, and compete on a live leaderboard. An admin panel manages match results, which automatically recalculate standings and knockout bracket assignments in real time.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | SQLite via Node's built-in `node:sqlite` (v22.5+, no native compilation) |
| Routing | React Router v6 |

---

## Project Structure

```
wc2026-predictor/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── pages/
│       │   ├── Home.jsx         # Landing page with stats + leaderboard preview
│       │   ├── LiveResults.jsx  # Groups / Calendar / Bracket tabs
│       │   ├── Predict.jsx      # Prediction form for all group matches
│       │   ├── Leaderboard.jsx  # Full player rankings
│       │   └── Admin.jsx        # Score entry + knockout management
│       ├── components/
│       │   └── Flag.jsx         # Flag image component
│       ├── bracketUtils.js      # Slot definitions + standings logic (shared)
│       └── App.jsx              # Routing + navbar
│
├── server/                  # Express API
│   └── src/
│       ├── routes/
│       │   ├── matches.js       # GET /api/matches
│       │   ├── predictions.js   # GET/POST /api/predictions
│       │   ├── leaderboard.js   # GET /api/leaderboard
│       │   └── admin.js         # Admin-only result + KO management endpoints
│       ├── bracketUtils.js      # CJS port of client bracketUtils (for server-side R32 recalc)
│       ├── db.js                # SQLite init + node:sqlite compat shim
│       └── scoring.js           # Points calculation logic
│
├── data/
│   └── wc2026.db            # SQLite database (gitignored)
│
├── world-cup-2026-schedule.json  # Full 104-match schedule with dates/venues
├── seed.js                       # Seeds teams + group stage matches from schedule JSON
└── package.json                  # Root scripts
```

---

## Deploying to Production (Render)

[Render](https://render.com) is the recommended host — persistent disk, Node 22 support, and auto-deploys from GitHub. The **Starter plan** is ~$7/month (includes the persistent disk needed for SQLite).

> The free tier does **not** include a persistent disk, so the database would reset on every deploy — not suitable for production.

### 1. Push your repo to GitHub

### 2. Create a new Web Service on Render

- Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
- Connect your GitHub repo
- Render will detect `render.yaml` automatically and pre-fill all settings

### 3. Set your admin key

In the Render dashboard → **Environment** tab, find the auto-generated `ADMIN_KEY` value and save it somewhere safe — you'll need it to access `/admin`.

### 4. Deploy

Render will:
1. Install all dependencies (`npm run install:all`)
2. Build the React frontend (`npm run build`)
3. Mount a 1 GB persistent disk at `/data`
4. Start the server (`npm start`)

On first boot, `seed.js` runs automatically and loads all 48 teams and 72 group-stage matches. On subsequent deploys it detects existing data and skips seeding.

### 5. Done

Your app will be live at `https://wc2026-predictor.onrender.com` (or similar). Every `git push` to `main` triggers a redeploy.

> **Note:** Knockout matches (R32 → Final) are created manually via the Admin panel as teams advance.

---

## Getting Started (Local Dev)

### Prerequisites

- **Node.js v22.5+** (required for `node:sqlite`)

### Install

```bash
npm run install:all
```

### Seed the database

```bash
npm run seed
```

This inserts all 48 teams and 72 group stage matches (with dates, venues, and kickoff times from the official schedule).

### Run in development

Open two terminals:

```bash
# Terminal 1 — API server (default port 3001)
npm run dev:server

# Terminal 2 — Vite dev server (default port 5173)
npm run dev:client
```

### Build for production

```bash
npm run build     # builds client to client/dist/
npm start         # serves API (serve client/dist statically from Express)
```

---

## Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=3001
ADMIN_KEY=your_secret_key      # required to access the admin panel
DB_PATH=../data/wc2026.db      # optional, defaults to data/wc2026.db
```

---

## Scoring System

| Result | Points |
|---|---|
| Exact scoreline | 5 pts |
| Correct result + goal difference | 3 pts |
| Correct result (W/D/L) only | 1 pt |
| Wrong prediction | 0 pts |

---

## Key Features

### Live Results (`/live`)
Three tabs in one page:
- **Groups** — standings tables for all 12 groups with colour-coded qualification zones
- **Calendar** — full match schedule with per-group and per-KO-round filters; date grouping is timezone-safe (keyed by ET date string, not local browser date)
- **Bracket** — projected knockout bracket built from live standings; unlocks only after every team has played at least one group match

### Admin Panel (`/admin`)
- Enter and correct match scores for group stage and knockouts
- **R32 auto-sync** — saving any group result immediately recalculates pending R32 team assignments from live standings, including Annexe C best-3rd-place resolution
- Knockout round management (R32 → R16 → QF → SF → Final), gated so each round unlocks only after the previous one completes
- KO match dates auto-populated from the schedule JSON by match number
- Live score sync (optional external API integration)
- Manual points recalculation

### Predict (`/predict`)
Players submit scoreline predictions for all 72 group stage matches. Points are calculated and stored automatically when results are entered in the admin panel.

---

## Database Schema

```sql
teams       (id, name, code, group_name, flag_emoji)
matches     (id, home_team_id, away_team_id, match_date, venue,
             phase, group_name, home_score, away_score, status, match_number)
users       (id, name, created_at, submitted_at)
predictions (id, user_id, match_id, pred_home, pred_away, points)
```

---

## Knockout Bracket Logic

R32 slot assignments follow the official FIFA WC 2026 bracket structure defined in `bracketUtils.js`. Best-3rd-place team placement uses the official Annexe C lookup table (all 8-of-12 group combinations pre-computed). The server re-runs this resolution after every group result change, updating only non-finished KO matches.
