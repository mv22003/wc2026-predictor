const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

const MATCH_SELECT = `
  SELECT m.*,
    ht.name        as home_team,  ht.code as home_code,  ht.flag_emoji as home_flag,
    ht.conduct_score as home_conduct, ht.fifa_ranking as home_ranking,
    at.name        as away_team,  at.code as away_code,  at.flag_emoji as away_flag,
    at.conduct_score as away_conduct, at.fifa_ranking as away_ranking
  FROM matches m
  JOIN teams ht ON m.home_team_id = ht.id
  JOIN teams at ON m.away_team_id = at.id
`;

router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { phase, group, status } = req.query;
    const where = ['1=1'];
    const params = [];
    let idx = 1;

    if (phase)  { where.push(`m.phase = $${idx++}`);       params.push(phase); }
    if (group)  { where.push(`m.group_name = $${idx++}`);  params.push(group.toUpperCase()); }
    if (status) { where.push(`m.status = $${idx++}`);      params.push(status); }

    const { rows } = await db.query(
      `${MATCH_SELECT} WHERE ${where.join(' AND ')} ORDER BY m.match_date, m.id`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/groups', async (req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT DISTINCT group_name FROM matches WHERE phase = 'group' AND group_name IS NOT NULL ORDER BY group_name`
    );
    res.json(rows.map(r => r.group_name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query(`${MATCH_SELECT} WHERE m.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Match not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
