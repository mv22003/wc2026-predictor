const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

router.get('/', (req, res) => {
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      u.id,
      u.name,
      u.submitted_at,
      COALESCE(SUM(p.points), 0)                                        AS total_points,
      COUNT(p.id)                                                        AS predictions_made,
      SUM(CASE WHEN p.points >= 3 THEN 1 ELSE 0 END)                   AS exact_scores,
      SUM(CASE WHEN p.points = 1  THEN 1 ELSE 0 END)                   AS correct_results,
      SUM(CASE WHEN m.status = 'finished' THEN 1 ELSE 0 END)           AS matches_played
    FROM users u
    LEFT JOIN predictions p ON u.id = p.user_id
    LEFT JOIN matches m     ON p.match_id = m.id
    WHERE u.submitted_at IS NOT NULL
    GROUP BY u.id
    ORDER BY total_points DESC, exact_scores DESC, u.name ASC
  `).all();

  const ranked = rows.map((row, i) => ({ ...row, rank: i + 1 }));
  res.json(ranked);
});

module.exports = router;
