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

const schedule = require('./world-cup-2026-schedule.json');
const { initDb, getDb } = require('./server/src/db');

initDb();
const db = getDb();

// ─── Flag emojis ──────────────────────────────────────────────────────────────
const FLAGS = {
  'Mexico':                  '🇲🇽',
  'South Africa':            '🇿🇦',
  'Korea Republic':          '🇰🇷',
  'Czechia':                 '🇨🇿',
  'Canada':                  '🇨🇦',
  'Bosnia and Herzegovina':  '🇧🇦',
  'Qatar':                   '🇶🇦',
  'Switzerland':             '🇨🇭',
  'Haiti':                   '🇭🇹',
  'Scotland':                '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Brazil':                  '🇧🇷',
  'Morocco':                 '🇲🇦',
  'United States':           '🇺🇸',
  'Paraguay':                '🇵🇾',
  'Australia':               '🇦🇺',
  'Türkiye':                 '🇹🇷',
  "Côte d’Ivoire":           '🇨🇮',
  'Ecuador':                 '🇪🇨',
  'Germany':                 '🇩🇪',
  'Curaçao':                 '🇨🇼',
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
  'Cabo Verde':              '🇨🇻',
  'France':                  '🇫🇷',
  'Senegal':                 '🇸🇳',
  'Iraq':                    '🇮🇶',
  'Norway':                  '🇳🇴',
  'Argentina':               '🇦🇷',
  'Algeria':                 '🇩🇿',
  'Austria':                 '🇦🇹',
  'Jordan':                  '🇯🇴',
  'Portugal':                '🇵🇹',
  'Congo DR':                '🇨🇩',
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
  'Korea Republic':          'KOR',
  'Czechia':                 'CZE',
  'Canada':                  'CAN',
  'Bosnia and Herzegovina':  'BIH',
  'Qatar':                   'QAT',
  'Switzerland':             'SUI',
  'Haiti':                   'HAI',
  'Scotland':                'SCO',
  'Brazil':                  'BRA',
  'Morocco':                 'MAR',
  'United States':           'USA',
  'Paraguay':                'PAR',
  'Australia':               'AUS',
  'Türkiye':                 'TUR',
  "Côte d’Ivoire":           'CIV',
  'Ecuador':                 'ECU',
  'Germany':                 'GER',
  'Curaçao':                 'CUW',
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
  'Cabo Verde':              'CPV',
  'France':                  'FRA',
  'Senegal':                 'SEN',
  'Iraq':                    'IRQ',
  'Norway':                  'NOR',
  'Argentina':               'ARG',
  'Algeria':                 'ALG',
  'Austria':                 'AUT',
  'Jordan':                  'JOR',
  'Portugal':                'POR',
  'Congo DR':                'COD',
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

// ─── Derive teams + groups from group-stage matches ───────────────────────────
const groupMatches = schedule.matches.filter(m => m.stage === 'Group Stage');

const teamGroupMap = {};
for (const m of groupMatches) {
  teamGroupMap[m.team_a] = m.group;
  teamGroupMap[m.team_b] = m.group;
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
function run() {
  const existingTeams = db.prepare('SELECT COUNT(*) as n FROM teams').get().n;

  if (existingTeams > 0) {
    if (!process.argv.includes('--force')) {
      console.log(`⚠️  Database already has ${existingTeams} teams. Use --force to wipe and reseed.`);
      process.exit(0);
    }
    db.exec('DELETE FROM predictions; DELETE FROM users; DELETE FROM matches; DELETE FROM teams;');
    console.log('🗑️  Wiped existing data (--force).');
  }

  // Insert teams
  const insertTeam = db.prepare(
    'INSERT INTO teams (name, code, group_name, flag_emoji) VALUES (?, ?, ?, ?)'
  );
  db.transaction(() => {
    for (const t of teams) insertTeam.run(t.name, t.code, t.group_name, t.flag_emoji);
  })();
  console.log(`✅ Inserted ${teams.length} teams across 12 groups`);

  // Build name → id lookup
  const teamId = {};
  for (const row of db.prepare('SELECT id, name FROM teams').all()) {
    teamId[row.name] = row.id;
  }

  // Insert group stage matches
  const insertMatch = db.prepare(`
    INSERT INTO matches (home_team_id, away_team_id, match_date, venue, phase, group_name, match_number)
    VALUES (?, ?, ?, ?, 'group', ?, ?)
  `);

  let inserted = 0;
  const warnings = [];

  db.transaction(() => {
    for (const m of groupMatches) {
      const homeId = teamId[m.team_a];
      const awayId = teamId[m.team_b];
      if (!homeId || !awayId) {
        warnings.push(`Unknown team in match ${m.match_number}: "${m.team_a}" vs "${m.team_b}"`);
        continue;
      }
      insertMatch.run(
        homeId, awayId,
        isoDate(m.date, m.time_et),
        `${m.venue}, ${m.city}`,
        m.group,
        m.match_number
      );
      inserted++;
    }
  })();

  if (warnings.length) warnings.forEach(w => console.warn('⚠️ ', w));

  const knockoutCount = schedule.matches.length - groupMatches.length;
  console.log(`✅ Inserted ${inserted} group stage matches`);
  console.log(`ℹ️  ${knockoutCount} knockout bracket slots skipped — add them via the admin panel as teams advance.`);
  console.log('');
  console.log('🎉 Seed complete!');
}

run();
