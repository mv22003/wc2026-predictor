#!/usr/bin/env node
/**
 * Pull all data from a remote PostgreSQL (Supabase) database into your local DB.
 *
 * Usage:
 *   node scripts/pull-from-supabase.js --source "postgresql://..."
 *
 * Or set SOURCE_DATABASE_URL in your environment and just run:
 *   node scripts/pull-from-supabase.js
 *
 * Add --yes to skip the confirmation prompt.
 *
 * Tables copied (in FK order): teams → users → matches → predictions → app_settings
 * All local data in those tables is replaced.
 */

const fs       = require('fs');
const path     = require('path');
const { Pool } = require('../server/node_modules/pg');
const readline = require('readline');

// Load .env from project root manually (no dotenv dependency needed)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

// ── Args ───────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const srcIdx  = args.indexOf('--source');
const srcUrl  = srcIdx !== -1 ? args[srcIdx + 1] : process.env.SOURCE_DATABASE_URL;
const skipYes = args.includes('--yes');

if (!srcUrl) {
  console.error('❌  No source URL provided.');
  console.error('    Pass --source "postgresql://..." or set SOURCE_DATABASE_URL env var.');
  process.exit(1);
}

const localUrl = process.env.DATABASE_URL;
if (!localUrl) {
  console.error('❌  DATABASE_URL is not set in .env — cannot connect to local DB.');
  process.exit(1);
}

if (srcUrl === localUrl) {
  console.error('❌  Source and local DATABASE_URL are the same — aborting to prevent data loss.');
  process.exit(1);
}

// ── Connections ───────────────────────────────────────────────────────────────
// Parse the source URL manually so pg doesn't mangle usernames like
// "postgres.project-ref" (the dot confuses pg's built-in URL parser).
function parsePoolConfig(url, ssl) {
  const u = new URL(url);
  return {
    host:     u.hostname,
    port:     parseInt(u.port || '5432', 10),
    database: u.pathname.replace(/^\//, ''),
    user:     decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl,
  };
}

const src   = new Pool(parsePoolConfig(srcUrl,   { rejectUnauthorized: false }));
const local = new Pool(parsePoolConfig(localUrl, false));

// ── Tables to copy (in insertion order) ───────────────────────────────────────
const TABLES = [
  {
    name:     'teams',
    columns:  ['id', 'name', 'code', 'group_name', 'flag_emoji'],
    sequence: 'teams_id_seq',
  },
  {
    name:     'users',
    columns:  ['id', 'name', 'created_at', 'submitted_at', 'paid', 'paid_amount', 'payment_type'],
    sequence: 'users_id_seq',
  },
  {
    name:     'matches',
    columns:  [
      'id', 'home_team_id', 'away_team_id', 'match_date', 'venue', 'phase',
      'group_name', 'home_score', 'away_score', 'status', 'match_number',
      'live_minute', 'home_scorers', 'away_scorers', 'manual_lock',
    ],
    sequence: 'matches_id_seq',
  },
  {
    name:     'predictions',
    columns:  ['id', 'user_id', 'match_id', 'pred_home', 'pred_away', 'points'],
    sequence: 'predictions_id_seq',
  },
  {
    name:    'app_settings',
    columns: ['key', 'value_text'],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function countRows(pool, table) {
  const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM ${table}`);
  return parseInt(rows[0].n, 10);
}

function buildInsert(table, columns, rows) {
  if (rows.length === 0) return null;
  const colList = columns.join(', ');
  const values  = rows.map(
    (row, ri) => `(${columns.map((_, ci) => `$${ri * columns.length + ci + 1}`).join(', ')})`
  ).join(',\n  ');
  const params  = rows.flatMap(row => columns.map(c => row[c] ?? null));
  return { text: `INSERT INTO ${table} (${colList}) VALUES\n  ${values}`, values: params };
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    // Preview row counts on source
    console.log('\n📡  Connecting to source (Supabase)…');
    const counts = {};
    for (const t of TABLES) {
      counts[t.name] = await countRows(src, t.name);
    }

    console.log('\n📊  Source row counts:');
    for (const t of TABLES) {
      console.log(`    ${t.name.padEnd(16)} ${counts[t.name]} rows`);
    }

    console.log('\n⚠️   This will REPLACE all local data in the tables above.');
    console.log(`    Local DB: ${localUrl.replace(/:([^:@]+)@/, ':***@')}`);

    if (!skipYes) {
      const ans = await ask('\n    Type "yes" to continue: ');
      if (ans !== 'yes') { console.log('Aborted.'); process.exit(0); }
    }

    const client = await local.connect();
    try {
      await client.query('BEGIN');

      // Truncate in reverse FK order
      console.log('\n🗑️   Clearing local tables…');
      await client.query('TRUNCATE predictions, matches, users, teams, app_settings RESTART IDENTITY CASCADE');

      // Copy each table
      for (const t of TABLES) {
        const { rows } = await src.query(
          `SELECT ${t.columns.join(', ')} FROM ${t.name} ORDER BY 1`
        );

        if (rows.length === 0) {
          console.log(`    ${t.name.padEnd(16)} — (empty, skipped)`);
          continue;
        }

        // Insert in chunks of 500 to avoid huge param lists
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const q     = buildInsert(t.name, t.columns, chunk);
          await client.query(q.text, q.values);
        }

        // Reset sequence so new inserts get a safe next id
        if (t.sequence) {
          await client.query(
            `SELECT setval('${t.sequence}', COALESCE((SELECT MAX(id) FROM ${t.name}), 1))`
          );
        }

        console.log(`    ✅ ${t.name.padEnd(16)} ${rows.length} rows copied`);
      }

      await client.query('COMMIT');
      console.log('\n🎉  Done! Your local database now mirrors Supabase.\n');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('\n❌  Error:', err.message);
    process.exit(1);
  } finally {
    await src.end();
    await local.end();
  }
})();
