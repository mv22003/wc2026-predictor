const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// Get user state + predictions by name
router.get('/user/:name', async (req, res) => {
  try {
    const db = getDb();
    const { rows: userRows } = await db.query(
      'SELECT * FROM users WHERE LOWER(name) = LOWER($1)',
      [req.params.name.trim()]
    );
    const user = userRows[0];

    if (!user) return res.json({ exists: false });

    const { rows: predictions } = await db.query(`
      SELECT p.*,
        m.phase, m.group_name, m.match_date, m.status,
        m.home_score, m.away_score,
        ht.name as home_team, ht.code as home_code, ht.flag_emoji as home_flag,
        at.name as away_team, at.code as away_code, at.flag_emoji as away_flag
      FROM predictions p
      JOIN matches m  ON p.match_id     = m.id
      JOIN teams   ht ON m.home_team_id = ht.id
      JOIN teams   at ON m.away_team_id = at.id
      WHERE p.user_id = $1
      ORDER BY m.match_date, m.id
    `, [user.id]);

    res.json({ exists: true, user, predictions, locked: !!user.submitted_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Submit predictions (one-shot, locked after submit)
router.post('/', async (req, res) => {
  const db = getDb();
  const { name, predictions } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!Array.isArray(predictions) || predictions.length === 0)
    return res.status(400).json({ error: 'No predictions provided' });

  // Block submissions if more than 24 group matches have started or finished
  const { rows: playedRows } = await db.query(
    "SELECT COUNT(*) AS n FROM matches WHERE phase = 'group' AND status IN ('live', 'finished')"
  );
  if (parseInt(playedRows[0].n, 10) >= 24)
    return res.status(403).json({ error: 'Predictions are closed — more than 24 group matches have been played.' });

  // Require a prediction for every upcoming group match (live/finished are locked)
  const { rows: countRows } = await db.query(
    "SELECT COUNT(*) AS n FROM matches WHERE phase = 'group' AND (status IS NULL OR status = 'upcoming')"
  );
  const totalPredictable = parseInt(countRows[0].n, 10);
  if (totalPredictable > 0 && predictions.length < totalPredictable)
    return res.status(400).json({
      error: `You must predict all ${totalPredictable} available group matches before submitting (got ${predictions.length}).`,
    });

  const { rows: existingRows } = await db.query(
    'SELECT * FROM users WHERE LOWER(name) = LOWER($1)',
    [name.trim()]
  );
  const existing = existingRows[0];
  if (existing?.submitted_at)
    return res.status(409).json({ error: 'This name is already taken. Please choose a different name.' });


  const client = await db.connect();
  try {
    await client.query('BEGIN');

    let userId = existing?.id;
    if (!userId) {
      const { rows: inserted } = await client.query(
        'INSERT INTO users (name) VALUES ($1) RETURNING id',
        [name.trim()]
      );
      userId = inserted[0].id;
    }

    // Fetch all match statuses in one query to avoid N+1
    const matchIds = predictions.map(p => p.match_id).filter(id => id != null);
    const { rows: matchStatusRows } = await client.query(
      `SELECT id, status FROM matches WHERE id = ANY($1)`, [matchIds]
    );
    const matchStatusMap = {};
    for (const r of matchStatusRows) matchStatusMap[r.id] = r.status;

    for (const pred of predictions) {
      if (pred.match_id == null || pred.pred_home == null || pred.pred_away == null) continue;
      const ph = parseInt(pred.pred_home, 10);
      const pa = parseInt(pred.pred_away, 10);
      if (isNaN(ph) || isNaN(pa) || ph < 0 || pa < 0) continue;
      // Skip predictions for matches that have already started or finished
      const status = matchStatusMap[pred.match_id];
      if (!status || status === 'live' || status === 'finished') continue;
      await client.query(`
        INSERT INTO predictions (user_id, match_id, pred_home, pred_away, points)
        VALUES ($1, $2, $3, $4, 0)
        ON CONFLICT (user_id, match_id) DO UPDATE SET pred_home = EXCLUDED.pred_home, pred_away = EXCLUDED.pred_away, points = 0
      `, [userId, pred.match_id, ph, pa]);
    }

    await client.query('UPDATE users SET submitted_at = NOW()::TEXT WHERE id = $1', [userId]);
    await client.query('COMMIT');

    res.json({ success: true, userId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Prediction submit error:', err);
    res.status(500).json({ error: 'Failed to save predictions.' });
  } finally {
    client.release();
  }
});

module.exports = router;
