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
      ORDER BY total_points DESC, pts_5 DESC, pts_3 DESC, pts_1 DESC, pts_0 ASC, u.name ASC
    `);

    const isTied = (a, b) =>
      Number(a.total_points) === Number(b.total_points) &&
      Number(a.pts_5)        === Number(b.pts_5)        &&
      Number(a.pts_3)        === Number(b.pts_3)        &&
      Number(a.pts_1)        === Number(b.pts_1)        &&
      Number(a.pts_0)        === Number(b.pts_0);

    const assignRanks = (rowSet) => {
      let rank = 1;
      return rowSet.map((row, i) => {
        if (i > 0 && !isTied(rowSet[i - 1], row)) rank = i + 1;
        return { ...row, rank };
      });
    };

    const ranked = assignRanks(rows);

    // Find each user's points from the last finished match for the "Last Result" column
    const lastMatchRes = await db.query(`
      SELECT m.id, t1.name AS home_team, t1.code AS home_code,
             t2.name AS away_team, t2.code AS away_code
      FROM matches m
      JOIN teams t1 ON t1.id = m.home_team_id
      JOIN teams t2 ON t2.id = m.away_team_id
      WHERE m.status = 'finished'
      ORDER BY m.match_date DESC, m.id DESC
      LIMIT 1
    `);

    if (lastMatchRes.rows.length === 0) {
      return res.json(ranked.map(r => ({ ...r, last_result: null, last_match_home: null, last_match_home_code: null, last_match_away: null, last_match_away_code: null })));
    }

    const lastMatch = lastMatchRes.rows[0];

    const { rows: lastResultRows } = await db.query(`
      SELECT user_id, points FROM predictions WHERE match_id = $1
    `, [lastMatch.id]);

    const lastResultByUserId = Object.fromEntries(lastResultRows.map(r => [r.user_id, r.points]));

    res.json(ranked.map(r => ({
      ...r,
      last_result: lastResultByUserId[r.id] ?? null,
      last_match_home: lastMatch.home_team,
      last_match_home_code: lastMatch.home_code,
      last_match_away: lastMatch.away_team,
      last_match_away_code: lastMatch.away_code,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
