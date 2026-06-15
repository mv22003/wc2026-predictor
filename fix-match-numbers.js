/**
 * One-off migration: swap match_number 15 and 16 in the DB to match the
 * external API (worldcup26.ir) chronological numbering.
 *
 * Run with: node fix-match-numbers.js
 */

const path = require('path');
try {
  require('./server/node_modules/dotenv').config({ path: path.join(__dirname, '.env') });
} catch { /* .env optional */ }

const { Pool } = require('./server/node_modules/pg');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    // Check current state
    const { rows: before } = await client.query(`
      SELECT m.match_number, ht.name AS home_team, at.name AS away_team, m.status, m.home_score, m.away_score
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE m.match_number IN (15, 16)
      ORDER BY m.match_number
    `);
    console.log('Before fix:');
    before.forEach(r => console.log(`  M${r.match_number}: ${r.home_team} vs ${r.away_team} (${r.status ?? 'upcoming'}, score: ${r.home_score ?? '?'}-${r.away_score ?? '?'})`));

    await client.query('BEGIN');
    // Use 999 as temp value to avoid unique constraint collision
    await client.query('UPDATE matches SET match_number = 999 WHERE match_number = 15');
    await client.query('UPDATE matches SET match_number = 15  WHERE match_number = 16');
    await client.query('UPDATE matches SET match_number = 16  WHERE match_number = 999');
    await client.query('COMMIT');

    const { rows: after } = await client.query(`
      SELECT m.match_number, ht.name AS home_team, at.name AS away_team, m.status, m.home_score, m.away_score
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE m.match_number IN (15, 16)
      ORDER BY m.match_number
    `);
    console.log('After fix:');
    after.forEach(r => console.log(`  M${r.match_number}: ${r.home_team} vs ${r.away_team} (${r.status ?? 'upcoming'}, score: ${r.home_score ?? '?'}-${r.away_score ?? '?'})`));

    console.log('\nDone! Now re-run the live sync to apply correct scores.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
