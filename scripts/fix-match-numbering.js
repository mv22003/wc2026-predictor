#!/usr/bin/env node
/**
 * Fix match numbering so our match_number values align with the external API's game.id.
 *
 * Usage:
 *   node scripts/fix-match-numbering.js           # dry run — shows what would change
 *   node scripts/fix-match-numbering.js --apply   # writes JSON + updates DB
 *
 * After running with --apply, trigger a sync to repopulate scores onto the
 * now-correctly-numbered rows.
 */

const path = require('path');
const fs   = require('fs');

require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({
  path: path.join(__dirname, '..', '.env'),
});

const { Pool } = require(path.join(__dirname, '..', 'server', 'node_modules', 'pg'));

const API_BASE     = process.env.WORLDCUP_API_URL || 'https://worldcup26.ir';
const SCHEDULE_PATH = path.join(__dirname, '..', 'data', 'world-cup-2026-schedule.json');
const DRY_RUN      = !process.argv.includes('--apply');
const MAX_GAMES    = 72;

// ── API → DB team name normalisation ─────────────────────────────────────────
// API names that differ from what seed.js stored in the DB
const API_TO_DB = {
  'south korea':                         'south korea',
  'czech republic':                      'czechia',
  'bosnia and herzegovina':              'bosnia',
  'turkey':                              'turkey',
  'ivory coast':                         'ivory coast',
  'cape verde':                          'cape verde',
  'democratic republic of the congo':    'dr congo',
};

function normApiName(n) {
  const lower = (n ?? '').toLowerCase().trim();
  return API_TO_DB[lower] ?? lower;
}

// JSON schedule names → DB names (mirrors seed.js NAME_MAP)
const JSON_TO_DB = {
  'korea republic': 'south korea',
  'türkiye':        'turkey',
  "côte d'ivoire":  'ivory coast',
  'curaçao':        'curacao',
  'cabo verde':     'cape verde',
  'congo dr':       'dr congo',
};

function normJsonName(n) {
  const lower = (n ?? '').toLowerCase().trim();
  return JSON_TO_DB[lower] ?? lower;
}

// Canonical team-pair key (order-independent)
function pairKey(a, b) {
  return [a, b].sort().join(' | ');
}

// ── Auth / fetch ──────────────────────────────────────────────────────────────

async function getToken() {
  if (process.env.WORLDCUP_API_TOKEN) return process.env.WORLDCUP_API_TOKEN;
  const { WORLDCUP_API_EMAIL: email, WORLDCUP_API_PASSWORD: password } = process.env;
  if (!email || !password) {
    console.error('❌  No API credentials. Set WORLDCUP_API_TOKEN in .env');
    process.exit(1);
  }
  const res = await fetch(`${API_BASE}/auth/authenticate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) { console.error(`❌  Auth failed: ${res.status}`); process.exit(1); }
  const data = await res.json();
  return data.token || data.access_token;
}

async function fetchGames(token) {
  const res = await fetch(`${API_BASE}/get/games`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) { console.error(`❌  API error: ${res.status}`); process.exit(1); }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.games || data.data || []);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('DRY RUN — pass --apply to write changes\n');

  // 1. Fetch API
  console.log('Fetching API games…');
  const token = await getToken();
  const games = await fetchGames(token);

  // Build: normalised pair → API game.id
  const apiPairToId = new Map();
  for (const g of games) {
    const id = parseInt(g.id, 10);
    if (id < 1 || id > MAX_GAMES) continue;
    const key = pairKey(normApiName(g.home_team_name_en), normApiName(g.away_team_name_en));
    apiPairToId.set(key, id);
  }
  console.log(`  ${apiPairToId.size} group-stage games found in API\n`);

  // 2. Load JSON
  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
  const groupMatches = schedule.matches.filter(m => m.stage === 'Group Stage');

  // 3. Compute changes
  const changes = []; // { match, oldNum, newNum, dbKey }

  for (const m of groupMatches) {
    const key    = pairKey(normJsonName(m.team_a), normJsonName(m.team_b));
    const newNum = apiPairToId.get(key);

    if (newNum === undefined) {
      console.warn(`  ⚠️  No API game found for: ${m.team_a} vs ${m.team_b} (JSON #${m.match_number})`);
      continue;
    }

    if (m.match_number !== newNum) {
      changes.push({ match: m, oldNum: m.match_number, newNum, key });
    }
  }

  if (changes.length === 0) {
    console.log('✅ All group stage match numbers already correct — nothing to do.');
    return;
  }

  console.log(`Found ${changes.length} match numbers to fix:\n`);
  for (const { match, oldNum, newNum } of changes) {
    console.log(`  #${String(oldNum).padEnd(3)} → #${String(newNum).padEnd(3)}  ${match.team_a} vs ${match.team_b}`);
  }

  if (DRY_RUN) {
    console.log('\nRun with --apply to write these changes.');
    return;
  }

  // 4. Apply: fix JSON
  console.log('\nApplying changes…');

  for (const { match, newNum } of changes) {
    match.match_number = newNum;
  }
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 2) + '\n', 'utf8');
  console.log(`✅ JSON updated (${SCHEDULE_PATH})`);

  // 5. Apply: fix DB
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Build DB name → team id lookup
    const { rows: teamRows } = await pool.query('SELECT id, LOWER(name) AS name FROM teams');
    const teamIdByName = new Map(teamRows.map(r => [r.name, r.id]));

    let dbUpdated = 0;
    const dbErrors = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const { match, oldNum, newNum } of changes) {
        const homeId = teamIdByName.get(normJsonName(match.team_a));
        const awayId = teamIdByName.get(normJsonName(match.team_b));

        if (!homeId || !awayId) {
          dbErrors.push(`Team not found in DB: ${match.team_a} vs ${match.team_b}`);
          continue;
        }

        const { rowCount } = await client.query(
          'UPDATE matches SET match_number = $1 WHERE home_team_id = $2 AND away_team_id = $3 AND phase = $4',
          [newNum, homeId, awayId, 'group']
        );

        if (rowCount === 0) {
          dbErrors.push(`No DB row found: ${match.team_a} vs ${match.team_b} (tried #${oldNum} → #${newNum})`);
        } else {
          dbUpdated++;
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    if (dbErrors.length) {
      console.log(`\n⚠️  DB errors (${dbErrors.length}):`);
      dbErrors.forEach(e => console.log(`   ${e}`));
    }

    console.log(`✅ DB updated: ${dbUpdated} match rows renumbered`);
    console.log('\n🔄 Next step: trigger a sync to repopulate scores onto the correct rows.');
    console.log('   Admin panel → Sync, or: POST /api/admin/sync with your admin key.');
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
