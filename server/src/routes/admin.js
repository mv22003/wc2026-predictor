const express = require('express');
const path = require('path');
const router = express.Router();
const { getDb } = require('../db');
const { calculatePoints } = require('../scoring');
const liveScores = require('../services/liveScores');
const { R32_SLOTS, calcStandings, resolveTeam, resolveBest3rdSlots } = require('../bracketUtils');
const { getPrizePotSummary } = require('../prizePot');

const schedule = require(path.join(__dirname, '../../../data/world-cup-2026-schedule.json'));
const scheduleDateByNum = {};
for (const m of schedule.matches) {
  scheduleDateByNum[m.match_number] = `${m.date}T${m.time_et}:00-04:00`;
}

// After any group result changes, sync pending R32 team assignments from live standings
async function recalcR32Teams(db) {
  const { rows: groupMatches } = await db.query(`
    SELECT m.*, ht.name AS home_team, ht.code AS home_code,
                at.name AS away_team,  at.code AS away_code
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.phase = 'group'
  `);

  const groups = [...new Set(groupMatches.map(m => m.group_name).filter(Boolean))].sort();
  const byGroup = {};
  for (const g of groups) {
    byGroup[g] = calcStandings(groupMatches.filter(m => m.group_name === g));
  }

  const best3rdMap = resolveBest3rdSlots(byGroup) || {};

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const [numStr, slots] of Object.entries(R32_SLOTS)) {
      const num = Number(numStr);
      const homeTeam = resolveTeam(slots.home, byGroup, {});
      const awayTeam = slots.away.type === 'best3rd'
        ? (best3rdMap[num]?.away ?? resolveTeam(slots.away, byGroup, {}))
        : resolveTeam(slots.away, byGroup, {});

      if (!homeTeam || !awayTeam) continue;
      const { rows: hr } = await client.query(
        'SELECT id FROM teams WHERE UPPER(code) = UPPER($1) OR LOWER(name) = LOWER($2)',
        [homeTeam.code, homeTeam.code]
      );
      const { rows: ar } = await client.query(
        'SELECT id FROM teams WHERE UPPER(code) = UPPER($1) OR LOWER(name) = LOWER($2)',
        [awayTeam.code, awayTeam.code]
      );
      const homeId = hr[0]?.id;
      const awayId = ar[0]?.id;
      if (homeId && awayId) {
        await client.query(
          "UPDATE matches SET home_team_id = $1, away_team_id = $2 WHERE match_number = $3 AND (status IS NULL OR status != 'finished')",
          [homeId, awayId, num]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'] || req.body?.adminKey || req.query?.key;
  const ADMIN_KEY = process.env.ADMIN_KEY || 'wc2026admin';
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Invalid admin key' });
  next();
}

// ── Live scores sync ──────────────────────────────────────────────────────────
router.get('/sync/status', adminAuth, (req, res) => {
  res.json({
    configured:      liveScores.isConfigured(),
    inProgress:      liveScores.syncState.inProgress,
    lastSyncAt:      liveScores.syncState.lastSyncAt,
    lastResult:      liveScores.syncState.lastResult,
    nextSyncAt:      liveScores.syncState.nextSyncAt,
    autoInterval:    parseInt(process.env.WORLDCUP_SYNC_INTERVAL || '0', 10),
    autoSyncRunning: liveScores.isAutoSyncRunning(),
  });
});

router.post('/sync', adminAuth, async (req, res) => {
  if (!liveScores.isConfigured()) {
    return res.status(400).json({
      error: 'Live scores API not configured. Add WORLDCUP_API_TOKEN to your .env file.',
    });
  }
  try {
    const result = await liveScores.syncScores();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/start', adminAuth, (req, res) => {
  const interval = parseInt(req.body?.intervalMinutes, 10) || 5;
  liveScores.startAutoSync(interval);
  res.json({ success: true, intervalMinutes: interval });
});

router.post('/sync/stop', adminAuth, (req, res) => {
  liveScores.stopAutoSync();
  res.json({ success: true });
});

// Returns the raw API response so we can inspect field names during a live game
router.get('/sync/raw', adminAuth, async (req, res) => {
  try {
    const token = await liveScores.getToken();
    const games = await liveScores.fetchGames(token);
    res.json({ total: games.length, games });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const [r1, r2, r3, r4, pot] = await Promise.all([
      db.query("SELECT COUNT(*) AS n FROM users WHERE submitted_at IS NOT NULL"),
      db.query("SELECT COUNT(*) AS n FROM matches"),
      db.query("SELECT COUNT(*) AS n FROM matches WHERE status = 'finished'"),
      db.query("SELECT COUNT(*) AS n FROM predictions"),
      getPrizePotSummary(db),
    ]);
    res.json({
      total_users:   parseInt(r1.rows[0].n, 10),
      total_matches: parseInt(r2.rows[0].n, 10),
      finished:      parseInt(r3.rows[0].n, 10),
      total_preds:   parseInt(r4.rows[0].n, 10),
      prize_pot:     pot,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/prize-pot', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    res.json(await getPrizePotSummary(db));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/prize-pot', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const { total } = req.body ?? {};

    if (total !== null && total !== undefined) {
      const parsed = Number(total);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return res.status(400).json({ error: 'total must be a non-negative number or null' });
      }
      await db.query(`
        INSERT INTO app_settings (key, value_text)
        VALUES ('prize_pot_override', $1)
        ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text
      `, [parsed.toFixed(2)]);
    } else {
      await db.query(`DELETE FROM app_settings WHERE key = 'prize_pot_override'`);
    }

    res.json({ success: true, prize_pot: await getPrizePotSummary(db) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Teams ─────────────────────────────────────────────────────────────────────
router.get('/teams', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query('SELECT * FROM teams ORDER BY group_name, name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/teams/:id', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const teamId = parseInt(req.params.id, 10);
    const { conduct_score, fifa_ranking } = req.body ?? {};

    const fields = [];
    const values = [];
    let idx = 1;

    if (conduct_score !== undefined) {
      const cs = parseInt(conduct_score, 10);
      if (isNaN(cs)) return res.status(400).json({ error: 'conduct_score must be an integer' });
      fields.push(`conduct_score = $${idx++}`);
      values.push(cs);
    }
    if (fifa_ranking !== undefined) {
      if (fifa_ranking === null) {
        fields.push(`fifa_ranking = $${idx++}`);
        values.push(null);
      } else {
        const fr = parseInt(fifa_ranking, 10);
        if (isNaN(fr) || fr < 1) return res.status(400).json({ error: 'fifa_ranking must be a positive integer or null' });
        fields.push(`fifa_ranking = $${idx++}`);
        values.push(fr);
      }
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(teamId);
    const { rowCount } = await db.query(
      `UPDATE teams SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Team not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/teams/bulk', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const { teams } = req.body;
    if (!Array.isArray(teams)) return res.status(400).json({ error: 'teams must be array' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const t of teams) {
        await client.query(
          'INSERT INTO teams (name, code, group_name, flag_emoji) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [t.name, t.code?.toUpperCase(), t.group_name?.toUpperCase(), t.flag_emoji || '🏳️']
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json({ success: true, count: teams.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Matches ───────────────────────────────────────────────────────────────────
router.get('/matches', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query(`
      SELECT m.*,
        ht.name as home_team, ht.code as home_code, ht.flag_emoji as home_flag,
        ht.conduct_score as home_conduct, ht.fifa_ranking as home_ranking,
        at.name as away_team, at.code as away_code, at.flag_emoji as away_flag,
        at.conduct_score as away_conduct, at.fifa_ranking as away_ranking,
        COUNT(p.id) as prediction_count
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      LEFT JOIN predictions p ON m.id = p.match_id
      GROUP BY m.id, ht.name, ht.code, ht.flag_emoji, ht.conduct_score, ht.fifa_ranking,
                        at.name, at.code, at.flag_emoji, at.conduct_score, at.fifa_ranking
      ORDER BY m.match_date, m.id
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/matches/bulk', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const { matches } = req.body;
    if (!Array.isArray(matches)) return res.status(400).json({ error: 'matches must be array' });

    const results = [];
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const m of matches) {
        let homeId = m.home_team_id;
        let awayId = m.away_team_id;
        if (!homeId && m.home_code) {
          const { rows } = await client.query(
            'SELECT id FROM teams WHERE UPPER(code) = UPPER($1) OR LOWER(name) = LOWER($2)',
            [m.home_code, m.home_code]
          );
          homeId = rows[0]?.id;
        }
        if (!awayId && m.away_code) {
          const { rows } = await client.query(
            'SELECT id FROM teams WHERE UPPER(code) = UPPER($1) OR LOWER(name) = LOWER($2)',
            [m.away_code, m.away_code]
          );
          awayId = rows[0]?.id;
        }
        if (!homeId || !awayId) {
          results.push({ error: `Team not found: ${m.home_code} vs ${m.away_code}` });
          continue;
        }
        const matchDate = m.match_date ?? scheduleDateByNum[m.match_number] ?? null;
        const { rows: inserted } = await client.query(`
          INSERT INTO matches (home_team_id, away_team_id, match_date, venue, phase, group_name, match_number)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
          RETURNING id
        `, [homeId, awayId, matchDate, m.venue, m.phase || 'group', m.group_name?.toUpperCase(), m.match_number]);
        results.push({ id: inserted[0]?.id ?? null });
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Parses "67", "45+2", "HT" → integer minute (or null). Consistent with sync service.
function parseLiveMinute(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim().toUpperCase();
  if (s === 'HT') return 45;
  return parseInt(s, 10) || null;
}

// ── Match results ─────────────────────────────────────────────────────────────
router.post('/matches/:id/result', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const { home_score, away_score, outcome, pen_home, pen_away } = req.body;
    const matchId = parseInt(req.params.id, 10);

    if (home_score == null || away_score == null)
      return res.status(400).json({ error: 'home_score and away_score required' });

    const hs = parseInt(home_score, 10);
    const as_ = parseInt(away_score, 10);

    const { rows: savedRows } = await db.query('SELECT phase FROM matches WHERE id = $1', [matchId]);
    const saved = savedRows[0];

    if (saved?.phase !== 'group' && hs === as_) {
      if (outcome !== 'pen')
        return res.status(400).json({ error: 'KO draws must be resolved by penalties (outcome="pen")' });
      const ph = parseInt(pen_home, 10);
      const pa = parseInt(pen_away, 10);
      if (isNaN(ph) || isNaN(pa) || ph === pa)
        return res.status(400).json({ error: 'KO draws require non-equal pen_home and pen_away scores' });
    }

    const { rows: preds } = await db.query('SELECT * FROM predictions WHERE match_id = $1', [matchId]);

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "UPDATE matches SET home_score = $1, away_score = $2, status = 'finished', live_minute = NULL, manual_lock = TRUE, outcome = $3, pen_home = $4, pen_away = $5 WHERE id = $6",
        [hs, as_, outcome ?? null, pen_home ?? null, pen_away ?? null, matchId]
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

    if (saved?.phase === 'group') await recalcR32Teams(db);

    res.json({ success: true, match_id: matchId, predictions_updated: preds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Correct a result already entered
router.put('/matches/:id/result', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const { home_score, away_score, status, home_scorers, away_scorers, outcome, pen_home, pen_away } = req.body;
    const matchId = parseInt(req.params.id, 10);

    const hs = parseInt(home_score, 10);
    const as_ = parseInt(away_score, 10);

    const { rows: savedRows } = await db.query('SELECT phase FROM matches WHERE id = $1', [matchId]);
    const savedPut = savedRows[0];

    if (savedPut?.phase !== 'group' && hs === as_) {
      if (outcome !== 'pen')
        return res.status(400).json({ error: 'KO draws must be resolved by penalties (outcome="pen")' });
      const ph = parseInt(pen_home, 10);
      const pa = parseInt(pen_away, 10);
      if (isNaN(ph) || isNaN(pa) || ph === pa)
        return res.status(400).json({ error: 'KO draws require non-equal pen_home and pen_away scores' });
    }

    const { rows: preds } = await db.query('SELECT * FROM predictions WHERE match_id = $1', [matchId]);

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE matches SET home_score = $1, away_score = $2, status = $3, home_scorers = COALESCE($4, home_scorers), away_scorers = COALESCE($5, away_scorers), live_minute = NULL, manual_lock = TRUE, outcome = $6, pen_home = $7, pen_away = $8 WHERE id = $9',
        [hs, as_, status || 'finished', home_scorers ?? null, away_scorers ?? null, outcome ?? null, pen_home ?? null, pen_away ?? null, matchId]
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

    if (savedPut?.phase === 'group') await recalcR32Teams(db);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Set scorer strings only (no score/points recalc)
router.patch('/matches/:id/scorers', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const matchId = parseInt(req.params.id, 10);
    const { home_scorers, away_scorers } = req.body;
    await db.query(
      'UPDATE matches SET home_scorers = $1, away_scorers = $2 WHERE id = $3',
      [home_scorers ?? null, away_scorers ?? null, matchId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete all matches for a KO phase (and all subsequent phases — cascade)
const KO_PHASE_ORDER = ['r32', 'r16', 'qf', 'sf', '3rd', 'final'];

router.delete('/matches/phase/:phase', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const phase = req.params.phase.toLowerCase();
    const force = req.query.force === 'true';

    const phaseIdx = KO_PHASE_ORDER.indexOf(phase);
    if (phaseIdx === -1) return res.status(400).json({ error: 'Invalid KO phase' });

    const phasesToDelete = KO_PHASE_ORDER.slice(phaseIdx);

    const { rows: allMatches } = await db.query(
      `SELECT id, status, phase FROM matches WHERE phase = ANY($1::text[])`,
      [phasesToDelete]
    );

    if (!force) {
      const finished = allMatches.filter(m => m.status === 'finished');
      if (finished.length > 0) {
        return res.status(409).json({
          error: `${finished.length} match(es) already have results. Pass force=true to delete anyway.`,
          finished_count: finished.length,
        });
      }
    }

    const matchIds = allMatches.map(m => m.id);
    if (matchIds.length === 0) return res.json({ success: true, deleted: 0, phases_deleted: [] });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM predictions WHERE match_id = ANY($1::int[])', [matchIds]);
      await client.query('DELETE FROM matches WHERE id = ANY($1::int[])', [matchIds]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ success: true, deleted: matchIds.length, phases_deleted: phasesToDelete });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Reset a result — clears score, sets status back to upcoming, zeroes all points
router.delete('/matches/:id/result', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const matchId = parseInt(req.params.id, 10);

    await db.query(
      "UPDATE matches SET home_score = NULL, away_score = NULL, home_scorers = NULL, away_scorers = NULL, live_minute = NULL, manual_lock = FALSE, status = 'upcoming', outcome = NULL, pen_home = NULL, pen_away = NULL WHERE id = $1",
      [matchId]
    );
    await db.query('UPDATE predictions SET points = 0 WHERE match_id = $1', [matchId]);

    res.json({ success: true, match_id: matchId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Make a match live or update its live score/minute (without finishing it)
router.patch('/matches/:id/live', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const matchId = parseInt(req.params.id, 10);
    const { home_score, away_score, live_minute } = req.body;

    const hs  = home_score  != null ? parseInt(home_score,  10) : 0;
    const as_ = away_score  != null ? parseInt(away_score,  10) : 0;
    const minute = parseLiveMinute(live_minute);

    const { rows: preds } = await db.query('SELECT * FROM predictions WHERE match_id = $1', [matchId]);

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "UPDATE matches SET home_score = $1, away_score = $2, status = 'live', live_minute = $3, manual_lock = TRUE WHERE id = $4",
        [hs, as_, minute, matchId]
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

    res.json({ success: true, match_id: matchId, predictions_updated: preds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Toggle manual_lock — when locked the API sync will not touch this match
router.patch('/matches/:id/lock', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const matchId = parseInt(req.params.id, 10);
    const { locked } = req.body;
    if (typeof locked !== 'boolean') return res.status(400).json({ error: 'locked must be boolean' });
    await db.query('UPDATE matches SET manual_lock = $1 WHERE id = $2', [locked, matchId]);
    res.json({ success: true, locked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Recalculate all prediction points using current scoring rules
router.post('/recalculate', adminAuth, async (req, res) => {
  try {
    const db = getDb();

    const { rows: finishedMatches } = await db.query(
      "SELECT * FROM matches WHERE status = 'finished'"
    );

    let predictionsUpdated = 0;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const match of finishedMatches) {
        const { rows: preds } = await client.query(
          'SELECT * FROM predictions WHERE match_id = $1', [match.id]
        );
        for (const p of preds) {
          await client.query('UPDATE predictions SET points = $1 WHERE id = $2', [
            calculatePoints(p.pred_home, p.pred_away, match.home_score, match.away_score),
            p.id,
          ]);
          predictionsUpdated++;
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({
      success:             true,
      matches_processed:   finishedMatches.length,
      predictions_updated: predictionsUpdated,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query(`
      SELECT u.*, COUNT(p.id) AS predictions, COALESCE(SUM(p.points), 0) AS total_points
      FROM users u
      LEFT JOIN predictions p ON u.id = p.user_id
      GROUP BY u.id
      ORDER BY total_points DESC, u.name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows } = await db.query(`
      INSERT INTO users (name, submitted_at)
      VALUES ($1, NOW()::TEXT)
      RETURNING *
    `, [name]);

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A user with that name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:userId', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const userId = parseInt(req.params.userId, 10);
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows, rowCount } = await db.query(`
      UPDATE users
      SET name = $1
      WHERE id = $2
      RETURNING *
    `, [name, userId]);

    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A user with that name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:userId/predictions', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const userId = parseInt(req.params.userId, 10);
    const { rows } = await db.query(`
      SELECT p.id, p.pred_home, p.pred_away, p.points,
        m.id AS match_id, m.phase, m.group_name, m.match_date, m.status,
        m.home_score, m.away_score,
        ht.name AS home_team, ht.code AS home_code, ht.flag_emoji AS home_flag,
        at.name AS away_team, at.code AS away_code, at.flag_emoji AS away_flag
      FROM predictions p
      JOIN matches m ON p.match_id = m.id
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE p.user_id = $1
      ORDER BY m.match_date, m.id
    `, [userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/predictions/:predId', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const predId = parseInt(req.params.predId, 10);
    const { pred_home, pred_away } = req.body;
    if (pred_home == null || pred_away == null)
      return res.status(400).json({ error: 'pred_home and pred_away required' });

    const ph = parseInt(pred_home, 10);
    const pa = parseInt(pred_away, 10);

    const { rows: predRows } = await db.query('SELECT * FROM predictions WHERE id = $1', [predId]);
    if (!predRows[0]) return res.status(404).json({ error: 'Prediction not found' });

    const { rows: matchRows } = await db.query('SELECT * FROM matches WHERE id = $1', [predRows[0].match_id]);
    const match = matchRows[0];

    const pts = match?.status === 'finished'
      ? calculatePoints(ph, pa, match.home_score, match.away_score)
      : predRows[0].points;

    await db.query('UPDATE predictions SET pred_home = $1, pred_away = $2, points = $3 WHERE id = $4',
      [ph, pa, pts, predId]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/predictions/:predId', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const predId = parseInt(req.params.predId, 10);
    const { rowCount } = await db.query('DELETE FROM predictions WHERE id = $1', [predId]);
    if (rowCount === 0) return res.status(404).json({ error: 'Prediction not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:userId/paid', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const userId = parseInt(req.params.userId, 10);
    const { paid, paid_amount, payment_type } = req.body;
    if (typeof paid !== 'boolean') return res.status(400).json({ error: 'paid must be boolean' });
    await db.query(
      'UPDATE users SET paid = $1, paid_amount = $2, payment_type = $3 WHERE id = $4',
      [paid, paid_amount ?? null, payment_type ?? null, userId]
    );
    res.json({ success: true, paid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:userId', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const userId = parseInt(req.params.userId, 10);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM predictions WHERE user_id = $1', [userId]);
      const { rowCount } = await client.query('DELETE FROM users WHERE id = $1', [userId]);
      if (rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Danger zone ───────────────────────────────────────────────────────────────
router.delete('/reset', adminAuth, async (req, res) => {
  if (req.body?.confirm !== 'RESET_ALL_DATA')
    return res.status(400).json({ error: 'Send body: { confirm: "RESET_ALL_DATA" }' });
  try {
    const db = getDb();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM predictions');
      await client.query('DELETE FROM users');
      await client.query("UPDATE matches SET home_score = NULL, away_score = NULL, status = 'upcoming'");
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/fix-ivory-coast', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const oldName = 'Côte d’Ivoire';
    const { rowCount } = await db.query('UPDATE teams SET name = $1 WHERE name = $2', ['Ivory Coast', oldName]);
    res.json({ success: true, updated: rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
