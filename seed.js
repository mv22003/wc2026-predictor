/**
 * WC 2026 Seed Script
 * Run once: node seed.js
 * Re-seed (clears everything): node seed.js --force
 *
 * Reads world-cup-2026-schedule.json automatically.
 * Knockout matches (R32 onward) are NOT seeded — add them via the admin
 * panel as teams advance through the group stage.
 */

const path = require('path');
const fs   = require('fs');

// Locate project root (the folder containing package.json) regardless of how
// node was invoked — handles both absolute __dirname and relative paths.
function findRoot(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve('.');
}
const PROJECT_ROOT = findRoot(path.resolve(__dirname || '.'));
process.chdir(PROJECT_ROOT);

try {
  require('./server/node_modules/dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });
} catch { /* .env optional */ }

const { Pool } = require('./server/node_modules/pg');
const schedule = require('./data/world-cup-2026-schedule.json');

// ─── Flag emojis ──────────────────────────────────────────────────────────────
const FLAGS = {
  'Mexico':                  '🇲🇽',
  'South Africa':            '🇿🇦',
  'South Korea':             '🇰🇷',
  'Czechia':                 '🇨🇿',
  'Canada':                  '🇨🇦',
  'Bosnia':                  '🇧🇦',
  'Qatar':                   '🇶🇦',
  'Switzerland':             '🇨🇭',
  'Haiti':                   '🇭🇹',
  'Scotland':                '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Brazil':                  '🇧🇷',
  'Morocco':                 '🇲🇦',
  'United States':           '🇺🇸',
  'Paraguay':                '🇵🇾',
  'Australia':               '🇦🇺',
  'Turkey':                  '🇹🇷',
  'Ivory Coast':             '🇨🇮',
  'Ecuador':                 '🇪🇨',
  'Germany':                 '🇩🇪',
  'Curacao':                 '🇨🇼',
  'Netherlands':             '🇳🇱',
  'Japan':                   '🇯🇵',
  'Sweden':                  '🇸🇪',
  'Tunisia':                 '🇹🇳',
  'Iran':                    '🇮🇷',
  'New Zealand':             '🇳🇿',
  'Belgium':                 '🇧🇪',
  'Egypt':                   '🇪🇬',
  'Saudi Arabia':            '🇸🇦',
  'Uruguay':                 '🇺🇾',
  'Spain':                   '🇪🇸',
  'Cape Verde':              '🇨🇻',
  'France':                  '🇫🇷',
  'Senegal':                 '🇸🇳',
  'Iraq':                    '🇮🇶',
  'Norway':                  '🇳🇴',
  'Argentina':               '🇦🇷',
  'Algeria':                 '🇩🇿',
  'Austria':                 '🇦🇹',
  'Jordan':                  '🇯🇴',
  'Portugal':                '🇵🇹',
  'DR Congo':                '🇨🇩',
  'Uzbekistan':              '🇺🇿',
  'Colombia':                '🇨🇴',
  'Ghana':                   '🇬🇭',
  'Panama':                  '🇵🇦',
  'England':                 '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Croatia':                 '🇭🇷',
};

// ─── FIFA 3-letter codes ──────────────────────────────────────────────────────
const CODES = {
  'Mexico':                  'MEX',
  'South Africa':            'RSA',
  'South Korea':             'KOR',
  'Czechia':                 'CZE',
  'Canada':                  'CAN',
  'Bosnia':                  'BIH',
  'Qatar':                   'QAT',
  'Switzerland':             'SUI',
  'Haiti':                   'HAI',
  'Scotland':                'SCO',
  'Brazil':                  'BRA',
  'Morocco':                 'MAR',
  'United States':           'USA',
  'Paraguay':                'PAR',
  'Australia':               'AUS',
  'Turkey':                  'TUR',
  'Ivory Coast':             'CIV',
  'Ecuador':                 'ECU',
  'Germany':                 'GER',
  'Curacao':                 'CUW',
  'Netherlands':             'NED',
  'Japan':                   'JPN',
  'Sweden':                  'SWE',
  'Tunisia':                 'TUN',
  'Iran':                    'IRN',
  'New Zealand':             'NZL',
  'Belgium':                 'BEL',
  'Egypt':                   'EGY',
  'Saudi Arabia':            'KSA',
  'Uruguay':                 'URU',
  'Spain':                   'ESP',
  'Cape Verde':              'CPV',
  'France':                  'FRA',
  'Senegal':                 'SEN',
  'Iraq':                    'IRQ',
  'Norway':                  'NOR',
  'Argentina':               'ARG',
  'Algeria':                 'ALG',
  'Austria':                 'AUT',
  'Jordan':                  'JOR',
  'Portugal':                'POR',
  'DR Congo':                'COD',
  'Uzbekistan':              'UZB',
  'Colombia':                'COL',
  'Ghana':                   'GHA',
  'Panama':                  'PAN',
  'England':                 'ENG',
  'Croatia':                 'CRO',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Store match times with EDT offset (UTC-4) so browsers show correct local time
function isoDate(date, time_et) {
  return `${date}T${time_et}:00-04:00`;
}

// ─── Normalise non-English names from the schedule JSON ──────────────────────
const NAME_MAP = {
  'Korea Republic': 'South Korea',
  'Türkiye':        'Turkey',
  'Côte d’Ivoire': 'Ivory Coast',
  'Curaçao':        'Curacao',
  'Cabo Verde':     'Cape Verde',
  'Congo DR':       'DR Congo',
};
function normName(n) { return NAME_MAP[n] || n; }

// ─── Derive teams + groups from group-stage matches ───────────────────────────
const groupMatches = schedule.matches.filter(m => m.stage === 'Group Stage');

const teamGroupMap = {};
for (const m of groupMatches) {
  teamGroupMap[normName(m.team_a)] = m.group;
  teamGroupMap[normName(m.team_b)] = m.group;
}

const teams = Object.entries(teamGroupMap)
  .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))
  .map(([name, group_name]) => ({
    name,
    code:       CODES[name]  || name.slice(0, 3).toUpperCase(),
    group_name,
    flag_emoji: FLAGS[name]  || '🏳️',
  }));

// ─── Run ──────────────────────────────────────────────────────────────────────
(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Ensure tables exist before querying them
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, code TEXT NOT NULL,
        group_name TEXT, flag_emoji TEXT NOT NULL DEFAULT '🏳️'
      );
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY, home_team_id INTEGER NOT NULL REFERENCES teams(id),
        away_team_id INTEGER NOT NULL REFERENCES teams(id), match_date TEXT,
        venue TEXT, phase TEXT NOT NULL DEFAULT 'group', group_name TEXT,
        home_score INTEGER, away_score INTEGER, status TEXT NOT NULL DEFAULT 'upcoming',
        match_number INTEGER
      );
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT NOW()::TEXT, submitted_at TEXT
      );
      CREATE TABLE IF NOT EXISTS predictions (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
        match_id INTEGER NOT NULL REFERENCES matches(id),
        pred_home INTEGER NOT NULL, pred_away INTEGER NOT NULL,
        points INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id, match_id)
      );
    `);

    const { rows: countRows } = await pool.query('SELECT COUNT(*) AS n FROM teams');
    const existingTeams = parseInt(countRows[0].n, 10);

    if (existingTeams > 0) {
      if (!process.argv.includes('--force')) {
        console.log(`⚠️  Database already has ${existingTeams} teams. Use --force to wipe and reseed.`);
        process.exit(0);
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM predictions');
        await client.query('DELETE FROM users');
        await client.query('DELETE FROM matches');
        await client.query('DELETE FROM teams');
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      console.log('🗑️  Wiped existing data (--force).');
    }

    // Insert teams
    const teamClient = await pool.connect();
    try {
      await teamClient.query('BEGIN');
      for (const t of teams) {
        await teamClient.query(
          'INSERT INTO teams (name, code, group_name, flag_emoji) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO NOTHING',
          [t.name, t.code, t.group_name, t.flag_emoji]
        );
      }
      await teamClient.query('COMMIT');
    } catch (err) {
      await teamClient.query('ROLLBACK');
      throw err;
    } finally {
      teamClient.release();
    }
    console.log(`✅ Inserted ${teams.length} teams across 12 groups`);

    // Build name → id lookup
    const teamId = {};
    const { rows: teamRows } = await pool.query('SELECT id, name FROM teams');
    for (const row of teamRows) {
      teamId[row.name] = row.id;
    }

    // Insert group stage matches
    let inserted = 0;
    const warnings = [];

    const matchClient = await pool.connect();
    try {
      await matchClient.query('BEGIN');
      for (const m of groupMatches) {
        const homeId = teamId[m.team_a];
        const awayId = teamId[m.team_b];
        if (!homeId || !awayId) {
          warnings.push(`Unknown team in match ${m.match_number}: "${m.team_a}" vs "${m.team_b}"`);
          continue;
        }
        await matchClient.query(
          `INSERT INTO matches (home_team_id, away_team_id, match_date, venue, phase, group_name, match_number)
           VALUES ($1, $2, $3, $4, 'group', $5, $6)`,
          [homeId, awayId, isoDate(m.date, m.time_et), `${m.venue}, ${m.city}`, m.group, m.match_number]
        );
        inserted++;
      }
      await matchClient.query('COMMIT');
    } catch (err) {
      await matchClient.query('ROLLBACK');
      throw err;
    } finally {
      matchClient.release();
    }

    if (warnings.length) warnings.forEach(w => console.warn('⚠️ ', w));

    const knockoutCount = schedule.matches.length - groupMatches.length;
    console.log(`✅ Inserted ${inserted} group stage matches`);
    console.log(`ℹ️  ${knockoutCount} knockout bracket slots skipped — add them via the admin panel as teams advance.`);
    console.log('');
    console.log('🎉 Seed complete!');
  } finally {
    await pool.end();
  }
})();
