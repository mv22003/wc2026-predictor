'use strict';

const express = require('express');
const router  = express.Router();
const { getDb } = require('../db');
const { runSim, COMPLETED_MATCHES, R3_FIXTURES, GROUP_TEAMS } = require('../qualificationSim');

// In-memory cache — re-run at most once per minute
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 60_000;

router.get('/qualification', async (req, res) => {
  try {
    if (_cache && Date.now() - _cacheAt < CACHE_TTL) {
      return res.json({ results: _cache, cachedAt: new Date(_cacheAt).toISOString() });
    }

    // Pull any finished R3 matches from the DB to supplement hardcoded data
    const db = getDb();
    const { rows } = await db.query(`
      SELECT ht.group_name AS grp, ht.name AS home, m.home_score AS hs, m.away_score AS as_,  at.name AS away
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE m.phase = 'group' AND m.status = 'finished'
        AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
    `);

    // Build a set of (home|away) pairs already in hardcoded COMPLETED_MATCHES
    const hardcodedSet = new Set(COMPLETED_MATCHES.map(m => `${m.home}|${m.away}`));

    // Merge: start with hardcoded, append any DB rows not already present
    const mergedCompleted = [...COMPLETED_MATCHES];
    const r3Keys = new Set(R3_FIXTURES.map(f => `${f.home}|${f.away}`));

    for (const row of rows) {
      const key = `${row.home}|${row.away}`;
      if (!hardcodedSet.has(key) && r3Keys.has(key)) {
        mergedCompleted.push({ g: row.grp, home: row.home, hs: Number(row.hs), as_: Number(row.as_), away: row.away });
      }
    }

    // Remove fixtures that are now completed
    const completedPairs = new Set(mergedCompleted.map(m => `${m.home}|${m.away}`));
    const remainingFixtures = R3_FIXTURES.filter(f => !completedPairs.has(`${f.home}|${f.away}`));

    const results = runSim({
      completedMatches: mergedCompleted,
      r3Fixtures:       remainingFixtures,
      groupTeams:       GROUP_TEAMS,
      iterations:       100_000,
    });

    _cache   = results;
    _cacheAt = Date.now();
    res.json({ results, cachedAt: new Date(_cacheAt).toISOString() });
  } catch (err) {
    console.error('Sim error:', err);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

module.exports = router;
