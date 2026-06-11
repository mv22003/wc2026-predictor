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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maxScorerMinute(raw) {
  if (!raw || raw === 'null') return null;
  // Collect all minute strings like "9'" or "45+2'" from the raw scorer value
  const mins = [...String(raw).matchAll(/(\d+)(?:\+\d+)?'/g)].map(m => parseInt(m[1], 10));
  return mins.length ? Math.max(...mins) : null;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

const syncState = {
  lastSyncAt:      null,
  lastResult:      null,   // { updated, skipped, errors }
  inProgress:      false,
  nextSyncAt:      null,
};

async function syncScores() {
  if (syncState.inProgress) return { skipped: true, reason: 'sync already running' };
  syncState.inProgress = true;

  try {
    const token = await getToken();
    const games = await fetchGames(token);

    const db = getDb();

    let updated = 0, skipped = 0;
    const errors = [];

    for (const game of games) {
      const isFinished = game.finished === 'TRUE' || game.finished === true || game.finished === 1;
      // worldcup26.ir uses time_elapsed: "notstarted" for upcoming, a minute string for live
      const rawTimeElapsed = game.time_elapsed ?? game.time ?? game.match_time ?? game.timer ?? game.minute ?? game.elapsed ?? null;
      const isLive = !isFinished && (
        game.live === true || game.live === 1 || game.live === 'TRUE' ||
        game.status === 'live' || game.status === 'in_progress' ||
        game.status === '1H'   || game.status === '2H' || game.status === 'HT' ||
        game.status === 'ET'   || game.status === 'PEN' ||
        game.started === true  || game.started === 'TRUE' || game.started === 1 ||
        (rawTimeElapsed != null && rawTimeElapsed !== '' && rawTimeElapsed !== 'notstarted' && rawTimeElapsed !== 'not started')
      );

      if (!isFinished && !isLive) continue;

      const matchNum = parseInt(game.id, 10);
      const hs       = parseInt(game.home_score, 10);
      const as_      = parseInt(game.away_score, 10);
      if (isNaN(hs) || isNaN(as_)) { errors.push(`Match ${matchNum}: invalid scores`); continue; }

      // Parse elapsed minute — handle "45+2" style strings too
      const parsedMinute = rawTimeElapsed != null ? (parseInt(String(rawTimeElapsed), 10) || null) : null;
      // Fallback: derive minute from max scorer minute when the API doesn't provide a time field
      const liveMinute = parsedMinute ?? maxScorerMinute(game.home_scorers) ?? maxScorerMinute(game.away_scorers);

      // Capture scorer strings — stored as-is; frontend parses defensively
      const homeScorers = (game.home_scorers && game.home_scorers !== 'null') ? game.home_scorers : null;
      const awayScorers = (game.away_scorers && game.away_scorers !== 'null') ? game.away_scorers : null;

      const { rows: matchRows } = await db.query('SELECT * FROM matches WHERE match_number = $1', [matchNum]);
      const our = matchRows[0];
      if (!our) { errors.push(`Match ${matchNum}: not in our DB`); continue; }

      if (isFinished) {
        // Already up to date?
        if (our.status === 'finished' && our.home_score === hs && our.away_score === as_) {
          skipped++;
          continue;
        }

        // Update result + recalculate points in one transaction
        const { rows: preds } = await db.query('SELECT * FROM predictions WHERE match_id = $1', [our.id]);
        const client = await db.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            "UPDATE matches SET home_score = $1, away_score = $2, status = 'finished', live_minute = NULL, home_scorers = $4, away_scorers = $5 WHERE id = $3",
            [hs, as_, our.id, homeScorers, awayScorers]
          );
          for (const p of preds) {
            await client.query('UPDATE predictions SET points = $1 WHERE id = $2', [
              calculatePoints(p.pred_home, p.pred_away, hs, as_), p.id,
            ]);
          }
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
        updated++;
      } else {
        // Live game — update score + minute + recalc points against current score
        if (our.status === 'live' && our.home_score === hs && our.away_score === as_ && our.live_minute === liveMinute) {
          skipped++;
          continue;
        }
        const { rows: livePreds } = await db.query('SELECT * FROM predictions WHERE match_id = $1', [our.id]);
        const liveClient = await db.connect();
        try {
          await liveClient.query('BEGIN');
          await liveClient.query(
            "UPDATE matches SET home_score = $1, away_score = $2, status = 'live', live_minute = $3, home_scorers = $5, away_scorers = $6 WHERE id = $4",
            [hs, as_, liveMinute, our.id, homeScorers, awayScorers]
          );
          for (const p of livePreds) {
            await liveClient.query('UPDATE predictions SET points = $1 WHERE id = $2', [
              calculatePoints(p.pred_home, p.pred_away, hs, as_), p.id,
            ]);
          }
          await liveClient.query('COMMIT');
        } catch (err) {
          await liveClient.query('ROLLBACK');
          throw err;
        } finally {
          liveClient.release();
        }
        updated++;
      }
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

let _autoInterval = null;  // the repeating tick
let _autoTimeout  = null;  // one-shot alignment to the next clock boundary

function startAutoSync(intervalMinutes) {
  stopAutoSync();
  if (!intervalMinutes || intervalMinutes <= 0) return;

  const intervalMs = intervalMinutes * 60 * 1000;

  async function runSync() {
    // Schedule next boundary before running so the timestamp is always accurate
    syncState.nextSyncAt = new Date(Math.ceil(Date.now() / intervalMs) * intervalMs).toISOString();
    try {
      const result = await syncScores();
      if (result.updated > 0) console.log(`🔄 Auto-sync: ${result.updated} match(es) updated`);
    } catch (e) {
      console.error('Auto-sync error:', e.message);
    }
  }

  // Calculate ms to the next intervalMinutes boundary on the wall clock
  const msUntilNext = intervalMs - (Date.now() % intervalMs);
  syncState.nextSyncAt = new Date(Date.now() + msUntilNext).toISOString();

  console.log(`⚽ Auto-sync enabled every ${intervalMinutes} min, next at ${syncState.nextSyncAt}`);

  // Align to boundary, then tick on every interval
  _autoTimeout = setTimeout(() => {
    _autoTimeout = null;
    runSync();
    _autoInterval = setInterval(runSync, intervalMs);
  }, msUntilNext);
}

function stopAutoSync() {
  if (_autoTimeout)  { clearTimeout(_autoTimeout);   _autoTimeout  = null; }
  if (_autoInterval) { clearInterval(_autoInterval); _autoInterval = null; }
  syncState.nextSyncAt = null;
}

function isConfigured() {
  return !!(process.env.WORLDCUP_API_TOKEN || (process.env.WORLDCUP_API_EMAIL && process.env.WORLDCUP_API_PASSWORD));
}

function isAutoSyncRunning() {
  return _autoInterval !== null || _autoTimeout !== null;
}

module.exports = { syncScores, startAutoSync, stopAutoSync, syncState, isConfigured, isAutoSyncRunning };
