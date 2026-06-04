const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { calculatePoints } = require('../scoring');

function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'] || req.body?.adminKey || req.query?.key;
  const ADMIN_KEY = process.env.ADMIN_KEY || 'wc2026admin';
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Invalid admin key' });
  next();
}

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', adminAuth, (req, res) => {
  const db = getDb();
  res.json({
    total_users:    db.prepare("SELECT COUNT(*) as n FROM users WHERE submitted_at IS NOT NULL").get().n,
    total_matches:  db.prepare("SELECT COUNT(*) as n FROM matches").get().n,
    finished:       db.prepare("SELECT COUNT(*) as n FROM matches WHERE status = 'finished'").get().n,
    total_preds:    db.prepare("SELECT COUNT(*) as n FROM predictions").get().n,
  });
});

// ── Teams ─────────────────────────────────────────────────────────────────────
router.get('/teams', adminAuth, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM teams ORDER BY group_name, name').all());
});

router.post('/teams/bulk', adminAuth, (req, res) => {
  const db = getDb();
  const { teams } = req.body;
  if (!Array.isArray(teams)) return res.status(400).json({ error: 'teams must be array' });

  const insert = db.prepare(
    'INSERT OR IGNORE INTO teams (name, code, group_name, flag_emoji) VALUES (?, ?, ?, ?)'
  );
  const tx = db.transaction(() => {
    for (const t of teams) insert.run(t.name, t.code?.toUpperCase(), t.group_name?.toUpperCase(), t.flag_emoji || '🏳️');
  });
  tx();
  res.json({ success: true, count: teams.length });
});

// ── Matches ───────────────────────────────────────────────────────────────────
router.get('/matches', adminAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT m.*,
      ht.name as home_team, ht.code as home_code, ht.flag_emoji as home_flag,
      at.name as away_team, at.code as away_code, at.flag_emoji as away_flag,
      COUNT(p.id) as prediction_count
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    LEFT JOIN predictions p ON m.id = p.match_id
    GROUP BY m.id
    ORDER BY m.match_date, m.id
  `).all();
  res.json(rows);
});

router.post('/matches/bulk', adminAuth, (req, res) => {
  const db = getDb();
  const { matches } = req.body;
  if (!Array.isArray(matches)) return res.status(400).json({ error: 'matches must be array' });

  const insertMatch = db.prepare(`
    INSERT OR IGNORE INTO matches
      (home_team_id, away_team_id, match_date, venue, phase, group_name, match_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const getTeam = db.prepare(
    'SELECT id FROM teams WHERE UPPER(code) = UPPER(?) OR name = ? COLLATE NOCASE'
  );

  const results = [];
  const tx = db.transaction(() => {
    for (const m of matches) {
      let homeId = m.home_team_id;
      let awayId = m.away_team_id;
      if (!homeId && m.home_code) homeId = getTeam.get(m.home_code, m.home_code)?.id;
      if (!awayId && m.away_code) awayId = getTeam.get(m.away_code, m.away_code)?.id;
      if (!homeId || !awayId) {
        results.push({ error: `Team not found: ${m.home_code} vs ${m.away_code}` });
        continue;
      }
      const r = insertMatch.run(homeId, awayId, m.match_date, m.venue, m.phase || 'group', m.group_name?.toUpperCase(), m.match_number);
      results.push({ id: r.lastInsertRowid });
    }
  });
  tx();
  res.json(results);
});

// ── Match results ─────────────────────────────────────────────────────────────
router.post('/matches/:id/result', adminAuth, (req, res) => {
  const db = getDb();
  const { home_score, away_score } = req.body;
  const matchId = parseInt(req.params.id, 10);

  if (home_score == null || away_score == null)
    return res.status(400).json({ error: 'home_score and away_score required' });

  const hs = parseInt(home_score, 10);
  const as_ = parseInt(away_score, 10);

  db.prepare(
    "UPDATE matches SET home_score = ?, away_score = ?, status = 'finished' WHERE id = ?"
  ).run(hs, as_, matchId);

  const preds = db.prepare('SELECT * FROM predictions WHERE match_id = ?').all(matchId);
  const updatePts = db.prepare('UPDATE predictions SET points = ? WHERE id = ?');
  const tx = db.transaction(() => {
    for (const p of preds) updatePts.run(calculatePoints(p.pred_home, p.pred_away, hs, as_), p.id);
  });
  tx();

  res.json({ success: true, match_id: matchId, predictions_updated: preds.length });
});

// Correct a result already entered
router.put('/matches/:id/result', adminAuth, (req, res) => {
  const db = getDb();
  const { home_score, away_score, status } = req.body;
  const matchId = parseInt(req.params.id, 10);

  const hs = parseInt(home_score, 10);
  const as_ = parseInt(away_score, 10);

  db.prepare(
    'UPDATE matches SET home_score = ?, away_score = ?, status = ? WHERE id = ?'
  ).run(hs, as_, status || 'finished', matchId);

  const preds = db.prepare('SELECT * FROM predictions WHERE match_id = ?').all(matchId);
  const updatePts = db.prepare('UPDATE predictions SET points = ? WHERE id = ?');
  const tx = db.transaction(() => {
    for (const p of preds) updatePts.run(calculatePoints(p.pred_home, p.pred_away, hs, as_), p.id);
  });
  tx();

  res.json({ success: true });
});

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users', adminAuth, (req, res) => {
  const db = getDb();
  res.json(db.prepare(`
    SELECT u.*, COUNT(p.id) as predictions, COALESCE(SUM(p.points), 0) as total_points
    FROM users u
    LEFT JOIN predictions p ON u.id = p.user_id
    GROUP BY u.id
    ORDER BY total_points DESC, u.name
  `).all());
});

// ── Danger zone ───────────────────────────────────────────────────────────────
router.delete('/reset', adminAuth, (req, res) => {
  if (req.body?.confirm !== 'RESET_ALL_DATA')
    return res.status(400).json({ error: 'Send body: { confirm: "RESET_ALL_DATA" }' });
  const db = getDb();
  db.exec(`
    DELETE FROM predictions;
    DELETE FROM users;
    UPDATE matches SET home_score = NULL, away_score = NULL, status = 'upcoming';
  `);
  res.json({ success: true });
});

module.exports = router;
