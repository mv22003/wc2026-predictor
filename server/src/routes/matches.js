const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

const MATCH_SELECT = `
  SELECT m.*,
    ht.name        as home_team,  ht.code as home_code,  ht.flag_emoji as home_flag,
    at.name        as away_team,  at.code as away_code,  at.flag_emoji as away_flag
  FROM matches m
  JOIN teams ht ON m.home_team_id = ht.id
  JOIN teams at ON m.away_team_id = at.id
`;

router.get('/', (req, res) => {
  const db = getDb();
  const { phase, group, status } = req.query;
  const where = ['1=1'];
  const params = [];

  if (phase)  { where.push('m.phase = ?');       params.push(phase); }
  if (group)  { where.push('m.group_name = ?');   params.push(group.toUpperCase()); }
  if (status) { where.push('m.status = ?');       params.push(status); }

  const rows = db.prepare(
    `${MATCH_SELECT} WHERE ${where.join(' AND ')} ORDER BY m.match_date, m.id`
  ).all(params);

  res.json(rows);
});

router.get('/groups', (req, res) => {
  const db = getDb();
  const groups = db.prepare(
    `SELECT DISTINCT group_name FROM matches WHERE phase = 'group' AND group_name IS NOT NULL ORDER BY group_name`
  ).all().map(r => r.group_name);
  res.json(groups);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const match = db.prepare(`${MATCH_SELECT} WHERE m.id = ?`).get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  res.json(match);
});

module.exports = router;
