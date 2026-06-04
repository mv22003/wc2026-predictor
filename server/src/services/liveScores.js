/**
 * Live Scores Service
 * Syncs match results from worldcup26.ir into our database,
 * then recalculates all affected prediction points.
 */

const { getDb }           = require('../db');
const { calculatePoints } = require('../scoring');

const API_BASE = process.env.WORLDCUP_API_URL || 'https://worldcup26.ir';

// ─── Auth ─────────────────────────────────────────────────────────────────────

let _cachedToken = null;

async function getToken() {
  if (_cachedToken) return _cachedToken;
  if (process.env.WORLDCUP_API_TOKEN) {
    _cachedToken = process.env.WORLDCUP_API_TOKEN;
    return _cachedToken;
  }

  const email    = process.env.WORLDCUP_API_EMAIL;
  const password = process.env.WORLDCUP_API_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'No live scores API credentials. ' +
      'Set WORLDCUP_API_TOKEN (or WORLDCUP_API_EMAIL + WORLDCUP_API_PASSWORD) in .env'
    );
  }

  const res = await fetch(`${API_BASE}/auth/authenticate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  _cachedToken = data.token || data.access_token;
  return _cachedToken;
}

// Force a fresh token (call if 401 received)
function clearToken() { _cachedToken = null; }

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchGames(token) {
  const res = await fetch(`${API_BASE}/get/games`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) { clearToken(); throw new Error('API token expired — please refresh WORLDCUP_API_TOKEN'); }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  // API may wrap in { games: [...] } or return array directly
  return Array.isArray(data) ? data : (data.games || data.data || []);
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

const syncState = {
  lastSyncAt:      null,
  lastResult:      null,   // { updated, skipped, errors }
  inProgress:      false,
};

async function syncScores() {
  if (syncState.inProgress) return { skipped: true, reason: 'sync already running' };
  syncState.inProgress = true;

  try {
    const token = await getToken();
    const games = await fetchGames(token);

    const db        = getDb();
    const getMatch  = db.prepare('SELECT * FROM matches WHERE match_number = ?');
    const setResult = db.prepare(
      "UPDATE matches SET home_score = ?, away_score = ?, status = 'finished' WHERE id = ?"
    );
    const getPreds  = db.prepare('SELECT * FROM predictions WHERE match_id = ?');
    const setPts    = db.prepare('UPDATE predictions SET points = ? WHERE id = ?');

    let updated = 0, skipped = 0;
    const errors = [];

    for (const game of games) {
      const isFinished = game.finished === 'TRUE' || game.finished === true || game.finished === 1;
      if (!isFinished) continue;

      const matchNum = parseInt(game.id, 10);
      const hs       = parseInt(game.home_score, 10);
      const as_      = parseInt(game.away_score, 10);
      if (isNaN(hs) || isNaN(as_)) { errors.push(`Match ${matchNum}: invalid scores`); continue; }

      const our = getMatch.get(matchNum);
      if (!our) { errors.push(`Match ${matchNum}: not in our DB`); continue; }

      // Already up to date?
      if (our.status === 'finished' && our.home_score === hs && our.away_score === as_) {
        skipped++;
        continue;
      }

      // Update result + recalculate points in one transaction
      db.transaction(() => {
        setResult.run(hs, as_, our.id);
        for (const p of getPreds.all(our.id)) {
          setPts.run(calculatePoints(p.pred_home, p.pred_away, hs, as_), p.id);
        }
      })();

      updated++;
    }

    const result = { updated, skipped, errors, total_finished: games.filter(g => g.finished === 'TRUE' || g.finished === true).length };
    syncState.lastSyncAt = new Date().toISOString();
    syncState.lastResult = result;
    return result;

  } finally {
    syncState.inProgress = false;
  }
}

// ─── Auto-sync ────────────────────────────────────────────────────────────────

let _autoInterval = null;

function startAutoSync(intervalMinutes) {
  if (_autoInterval) clearInterval(_autoInterval);
  if (!intervalMinutes || intervalMinutes <= 0) return;

  console.log(`⚽ Live scores auto-sync enabled every ${intervalMinutes} min`);
  _autoInterval = setInterval(async () => {
    try {
      const result = await syncScores();
      if (result.updated > 0) {
        console.log(`🔄 Auto-sync: ${result.updated} match(es) updated`);
      }
    } catch (e) {
      console.error('Auto-sync error:', e.message);
    }
  }, intervalMinutes * 60 * 1000);
}

function stopAutoSync() {
  if (_autoInterval) { clearInterval(_autoInterval); _autoInterval = null; }
}

function isConfigured() {
  return !!(process.env.WORLDCUP_API_TOKEN || (process.env.WORLDCUP_API_EMAIL && process.env.WORLDCUP_API_PASSWORD));
}

module.exports = { syncScores, startAutoSync, stopAutoSync, syncState, isConfigured };
