const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// Get user state + predictions by name
router.get('/user/:name', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE name = ?').get(req.params.name.trim());

  if (!user) return res.json({ exists: false });

  const predictions = db.prepare(`
    SELECT p.*,
      m.phase, m.group_name, m.match_date, m.status,
      m.home_score, m.away_score,
      ht.name as home_team, ht.code as home_code, ht.flag_emoji as home_flag,
      at.name as away_team, at.code as away_code, at.flag_emoji as away_flag
    FROM predictions p
    JOIN matches m  ON p.match_id     = m.id
    JOIN teams   ht ON m.home_team_id = ht.id
    JOIN teams   at ON m.away_team_id = at.id
    WHERE p.user_id = ?
    ORDER BY m.match_date, m.id
  `).all(user.id);

  res.json({ exists: true, user, predictions, locked: !!user.submitted_at });
});

// Submit predictions (one-shot, locked after submit)
router.post('/', (req, res) => {
  const db = getDb();
  const { name, predictions } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!Array.isArray(predictions) || predictions.length === 0)
    return res.status(400).json({ error: 'No predictions provided' });

  const existing = db.prepare('SELECT * FROM users WHERE name = ?').get(name.trim());
  if (existing?.submitted_at)
    return res.status(409).json({ error: 'This name is already taken. Please choose a different name.' });

  // Require a prediction for every group match
  const totalGroupMatches = db.prepare("SELECT COUNT(*) as n FROM matches WHERE phase = 'group'").get().n;
  if (predictions.length < totalGroupMatches)
    return res.status(400).json({
      error: `You must predict all ${totalGroupMatches} group matches before submitting (got ${predictions.length}).`,
    });

  const submit = db.transaction(() => {
    let userId = existing?.id;

    if (!userId) {
      const r = db.prepare('INSERT INTO users (name) VALUES (?)').run(name.trim());
      userId = r.lastInsertRowid;
    }

    const insertPred = db.prepare(`
      INSERT OR REPLACE INTO predictions (user_id, match_id, pred_home, pred_away, points)
      VALUES (?, ?, ?, ?, 0)
    `);

    for (const pred of predictions) {
      if (pred.match_id == null || pred.pred_home == null || pred.pred_away == null) continue;
      const ph = parseInt(pred.pred_home, 10);
      const pa = parseInt(pred.pred_away, 10);
      if (isNaN(ph) || isNaN(pa) || ph < 0 || pa < 0) continue;
      insertPred.run(userId, pred.match_id, ph, pa);
    }

    db.prepare("UPDATE users SET submitted_at = datetime('now') WHERE id = ?").run(userId);
    return userId;
  });

  try {
    const userId = submit();
    res.json({ success: true, userId });
  } catch (err) {
    console.error('Prediction submit error:', err);
    res.status(500).json({ error: 'Failed to save predictions.' });
  }
});

module.exports = router;
