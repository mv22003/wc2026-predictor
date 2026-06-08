const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { getPrizePotSummary } = require('../prizePot');

router.get('/pot', async (req, res) => {
  try {
    const db = getDb();
    const summary = await getPrizePotSummary(db);
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const db = getDb();

    const { rows } = await db.query(`
      SELECT
        u.id,
        u.name,
        u.paid,
        u.submitted_at,
        COALESCE(SUM(p.points), 0)                                                      AS total_points,
        SUM(CASE WHEN p.points = 5 THEN 1 ELSE 0 END)                                  AS pts_5,
        SUM(CASE WHEN p.points = 3 THEN 1 ELSE 0 END)                                  AS pts_3,
        SUM(CASE WHEN p.points = 1 THEN 1 ELSE 0 END)                                  AS pts_1,
        SUM(CASE WHEN m.status = 'finished' AND p.points = 0 THEN 1 ELSE 0 END)        AS pts_0,
        SUM(CASE WHEN m.status = 'finished' THEN 1 ELSE 0 END)                         AS matches_played
      FROM users u
      LEFT JOIN predictions p ON u.id = p.user_id
      LEFT JOIN matches m     ON p.match_id = m.id
      WHERE u.submitted_at IS NOT NULL
      GROUP BY u.id
      ORDER BY total_points DESC, pts_5 DESC, u.name ASC
    `);

    const ranked = rows.map((row, i) => ({ ...row, rank: i + 1 }));
    res.json(ranked);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
