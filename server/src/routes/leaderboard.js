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

router.get('/history', async (req, res) => {
  try {
    const db = getDb();

    const { rows } = await db.query(`
      WITH finished AS (
        SELECT id, match_number, phase,
               ROW_NUMBER() OVER (ORDER BY match_date, id) AS seq
        FROM matches WHERE status = 'finished' AND phase = 'group'
      ),
      all_users AS (
        SELECT id, name FROM users WHERE submitted_at IS NOT NULL
      ),
      crossed AS (
        SELECT u.id AS user_id, u.name, f.seq, f.match_number, f.phase,
               COALESCE(p.points, 0)                                    AS pts,
               CASE WHEN p.points = 5 THEN 1 ELSE 0 END                 AS p5,
               CASE WHEN p.points = 3 THEN 1 ELSE 0 END                 AS p3,
               CASE WHEN p.points = 1 THEN 1 ELSE 0 END                 AS p1,
               CASE WHEN p.points = 0 AND p.id IS NOT NULL THEN 1 ELSE 0 END AS p0
        FROM all_users u
        CROSS JOIN finished f
        LEFT JOIN predictions p ON p.user_id = u.id AND p.match_id = f.id
      ),
      cumul AS (
        SELECT user_id, name, seq, match_number, phase,
               SUM(pts) OVER w AS cum_pts,
               SUM(p5)  OVER w AS cum_5,
               SUM(p3)  OVER w AS cum_3,
               SUM(p1)  OVER w AS cum_1,
               SUM(p0)  OVER w AS cum_0
        FROM crossed
        WINDOW w AS (PARTITION BY user_id ORDER BY seq ROWS UNBOUNDED PRECEDING)
      ),
      ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY seq
            ORDER BY cum_pts DESC, cum_5 DESC, cum_3 DESC, cum_1 DESC, cum_0 ASC, name ASC
          ) AS pos
        FROM cumul
      )
      SELECT user_id, name, seq, match_number::int AS match_number, pos::int AS pos, cum_pts::int AS cum_pts, phase
      FROM ranked
      ORDER BY seq, pos
    `);

    if (rows.length === 0) return res.json({ matches: [], users: [] });

    const { rows: matchDetails } = await db.query(`
      SELECT m.match_number, ht.code AS home_code, at.code AS away_code
      FROM matches m
      JOIN teams ht ON ht.id = m.home_team_id
      JOIN teams at ON at.id = m.away_team_id
      WHERE m.status = 'finished'
    `);
    const detailsMap = Object.fromEntries(matchDetails.map(r => [r.match_number, r]));

    const seqs = [...new Set(rows.map(r => Number(r.seq)))].sort((a, b) => a - b);
    const matches = seqs.map(seq => {
      const r = rows.find(x => Number(x.seq) === seq);
      const d = detailsMap[r.match_number] || {};
      return { seq, match_number: r.match_number, phase: r.phase, home_code: d.home_code, away_code: d.away_code };
    });

    const userNames = [];
    rows.forEach(r => { if (!userNames.includes(r.name)) userNames.push(r.name); });

    const users = userNames.map(name => {
      const ranks = [];
      const points = [];
      matches.forEach(m => {
        const r = rows.find(x => x.name === name && Number(x.seq) === m.seq);
        ranks.push(r ? r.pos : null);
        points.push(r ? r.cum_pts : null);
      });
      return { name, ranks, points };
    });

    users.sort((a, b) => {
      const af = a.ranks[a.ranks.length - 1] ?? Infinity;
      const bf = b.ranks[b.ranks.length - 1] ?? Infinity;
      return af - bf;
    });

    res.json({ matches, users });
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
        COALESCE(SUM(CASE WHEN m.phase = 'group' THEN p.points ELSE 0 END), 0)          AS total_points,
        SUM(CASE WHEN m.phase = 'group' AND p.points = 5 THEN 1 ELSE 0 END)            AS pts_5,
        SUM(CASE WHEN m.phase = 'group' AND p.points = 3 THEN 1 ELSE 0 END)            AS pts_3,
        SUM(CASE WHEN m.phase = 'group' AND p.points = 1 THEN 1 ELSE 0 END)            AS pts_1,
        SUM(CASE WHEN m.phase = 'group' AND m.status = 'finished' AND p.points = 0 THEN 1 ELSE 0 END) AS pts_0,
        SUM(CASE WHEN m.phase = 'group' AND m.status = 'finished' THEN 1 ELSE 0 END)   AS matches_played
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

    // Fetch all currently live matches first
    const liveMatchesRes = await db.query(`
      SELECT m.id, m.status, t1.name AS home_team, t1.code AS home_code,
             t2.name AS away_team, t2.code AS away_code
      FROM matches m
      JOIN teams t1 ON t1.id = m.home_team_id
      JOIN teams t2 ON t2.id = m.away_team_id
      WHERE m.status = 'live'
      ORDER BY m.match_date ASC, m.id ASC
    `);

    let matchesToShow = liveMatchesRes.rows;

    // If no live matches, fall back to the last finished match
    if (matchesToShow.length === 0) {
      const lastFinishedRes = await db.query(`
        SELECT m.id, m.status, t1.name AS home_team, t1.code AS home_code,
               t2.name AS away_team, t2.code AS away_code
        FROM matches m
        JOIN teams t1 ON t1.id = m.home_team_id
        JOIN teams t2 ON t2.id = m.away_team_id
        WHERE m.status = 'finished'
        ORDER BY m.match_date DESC, m.id DESC
        LIMIT 1
      `);
      matchesToShow = lastFinishedRes.rows;
    }

    if (matchesToShow.length === 0) {
      return res.json(ranked.map(r => ({ ...r, last_result: null, last_match_home: null, last_match_home_code: null, last_match_away: null, last_match_away_code: null })));
    }

    const lastMatch = matchesToShow[0];
    const lastMatch2 = matchesToShow[1] ?? null;

    const { rows: lastResultRows } = await db.query(`
      SELECT user_id, points FROM predictions WHERE match_id = $1
    `, [lastMatch.id]);

    const lastResultByUserId = Object.fromEntries(lastResultRows.map(r => [r.user_id, r.points]));

    let lastResult2ByUserId = {};
    if (lastMatch2) {
      const { rows: lastResult2Rows } = await db.query(`
        SELECT user_id, points FROM predictions WHERE match_id = $1
      `, [lastMatch2.id]);
      lastResult2ByUserId = Object.fromEntries(lastResult2Rows.map(r => [r.user_id, r.points]));
    }

    // Find the next upcoming match and each user's prediction for it
    const nextMatchRes = await db.query(`
      SELECT m.id, t1.name AS home_team, t1.code AS home_code,
             t2.name AS away_team, t2.code AS away_code
      FROM matches m
      JOIN teams t1 ON t1.id = m.home_team_id
      JOIN teams t2 ON t2.id = m.away_team_id
      WHERE m.status = 'upcoming'
      ORDER BY m.match_date ASC, m.id ASC
      LIMIT 1
    `);

    let nextMatch = null;
    let nextPredByUserId = {};

    if (nextMatchRes.rows.length > 0) {
      nextMatch = nextMatchRes.rows[0];
      const { rows: nextPredRows } = await db.query(`
        SELECT user_id, pred_home, pred_away FROM predictions WHERE match_id = $1
      `, [nextMatch.id]);
      nextPredByUserId = Object.fromEntries(nextPredRows.map(r => [r.user_id, { h: r.pred_home, a: r.pred_away }]));
    }

    res.json(ranked.map(r => ({
      ...r,
      last_result: lastResultByUserId[r.id] ?? null,
      last_match_home: lastMatch.home_team,
      last_match_home_code: lastMatch.home_code,
      last_match_away: lastMatch.away_team,
      last_match_away_code: lastMatch.away_code,
      last_match_is_live: lastMatch.status === 'live',
      last_result2: lastMatch2 ? (lastResult2ByUserId[r.id] ?? null) : undefined,
      last_match2_home: lastMatch2?.home_team ?? null,
      last_match2_home_code: lastMatch2?.home_code ?? null,
      last_match2_away: lastMatch2?.away_team ?? null,
      last_match2_away_code: lastMatch2?.away_code ?? null,
      next_match_home: nextMatch?.home_team ?? null,
      next_match_home_code: nextMatch?.home_code ?? null,
      next_match_away: nextMatch?.away_team ?? null,
      next_match_away_code: nextMatch?.away_code ?? null,
      next_pred_home: nextPredByUserId[r.id]?.h ?? null,
      next_pred_away: nextPredByUserId[r.id]?.a ?? null,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
