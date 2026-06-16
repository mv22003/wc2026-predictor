#!/usr/bin/env node
/**
 * Patches the 7 DB match_number rows that fix-match-numbering.js couldn't
 * update due to special-character normalisation failures (Türkiye, Cabo Verde,
 * Congo DR, Korea Republic). Uses team FIFA codes instead of names.
 *
 * Usage:
 *   node scripts/fix-match-numbering-patch.js           # dry run
 *   node scripts/fix-match-numbering-patch.js --apply
 */

const path = require('path');
require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({
  path: path.join(__dirname, '..', '.env'),
});
const { Pool } = require(path.join(__dirname, '..', 'server', 'node_modules', 'pg'));

const DRY_RUN = !process.argv.includes('--apply');

// Each entry: [newMatchNumber, homeCode, awayCode, label]
const PATCHES = [
  [21, 'POR', 'COD', 'Portugal vs Congo DR'],
  [25, 'MEX', 'KOR', 'Mexico vs South Korea'],
  [32, 'TUR', 'PAR', 'Türkiye vs Paraguay'],
  [40, 'URU', 'CPV', 'Uruguay vs Cabo Verde'],
  [47, 'COL', 'COD', 'Colombia vs Congo DR'],
  [51, 'RSA', 'KOR', 'South Africa vs South Korea'],
  [58, 'TUR', 'USA', 'Türkiye vs United States'],
];

async function main() {
  if (DRY_RUN) console.log('DRY RUN — pass --apply to write changes\n');

  console.log('Patches to apply:\n');
  for (const [num, h, a, label] of PATCHES) {
    console.log(`  → match_number ${num}  ${label}  (${h} vs ${a})`);
  }

  if (DRY_RUN) {
    console.log('\nRun with --apply to write these to the DB.');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    const client = await pool.connect();
    let ok = 0;
    const errors = [];

    try {
      await client.query('BEGIN');

      for (const [num, homeCode, awayCode, label] of PATCHES) {
        const { rows: hr } = await client.query(
          'SELECT id FROM teams WHERE UPPER(code) = $1', [homeCode]
        );
        const { rows: ar } = await client.query(
          'SELECT id FROM teams WHERE UPPER(code) = $1', [awayCode]
        );

        if (!hr[0] || !ar[0]) {
          errors.push(`Team code not found: ${homeCode} or ${awayCode} (${label})`);
          continue;
        }

        const { rowCount } = await client.query(
          "UPDATE matches SET match_number = $1 WHERE home_team_id = $2 AND away_team_id = $3 AND phase = 'group'",
          [num, hr[0].id, ar[0].id]
        );

        if (rowCount === 0) {
          errors.push(`No DB row matched: ${label}`);
        } else {
          console.log(`  ✅ ${label} → match_number ${num}`);
          ok++;
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    if (errors.length) {
      console.log('\nErrors:');
      errors.forEach(e => console.log(`  ❌ ${e}`));
    }

    console.log(`\n${ok}/${PATCHES.length} patches applied.`);
    if (ok === PATCHES.length) {
      console.log('🔄 Next step: trigger a sync to repopulate scores onto correct rows.');
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
