#!/usr/bin/env node
/**
 * Compares our local schedule JSON against the worldcup26.ir API
 * to surface any match_number ↔ game.id mismatches.
 *
 * Usage:
 *   node scripts/check-match-numbering.js
 *
 * Reads credentials from .env in the project root (WORLDCUP_API_TOKEN,
 * or WORLDCUP_API_EMAIL + WORLDCUP_API_PASSWORD).
 */

const path = require('path');
const fs   = require('fs');

require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({
  path: path.join(__dirname, '..', '.env'),
});

const API_BASE  = process.env.WORLDCUP_API_URL || 'https://worldcup26.ir';
const SCHEDULE  = path.join(__dirname, '..', 'data', 'world-cup-2026-schedule.json');
const MAX_GAMES = 72;

// ── name normalisation ────────────────────────────────────────────────────────
// Canonical name map — everything resolves to a single agreed form.
const NAME_MAP = {
  // API English names → canonical
  'south korea':                         'korea republic',
  'czech republic':                      'czechia',
  'bosnia and herzegovina':              'bosnia',
  'turkey':                              'türkiye',
  'ivory coast':                         'cote d ivoire',
  'cape verde':                          'cabo verde',
  'democratic republic of the congo':    'congo dr',
  // JSON FIFA names → canonical (handles curly apostrophe + cedilla variants)
  "côte d'ivoire":                       'cote d ivoire',  // straight apostrophe variant
  'curaçao':                             'curacao',
};

function normName(n) {
  // Strip curly/fancy apostrophes and diacritics that differ between sources
  const cleaned = (n ?? '')
    .toLowerCase()
    .trim()
    .replace(/[‘’‚‛]/g, "'") // curly single quotes → straight
    .replace(/ç/g, 'c')                           // cedilla → plain c (for Curaçao)
    .replace(/['']/g, '');                         // remove apostrophes for Côte comparison
  // Strip apostrophes from the lookup key too
  const key = cleaned.replace(/'/g, '');
  return NAME_MAP[key] ?? NAME_MAP[cleaned] ?? cleaned;
}

function normTeams(a, b) {
  return `${normName(a)} vs ${normName(b)}`;
}

// ── auth ──────────────────────────────────────────────────────────────────────

async function getToken() {
  if (process.env.WORLDCUP_API_TOKEN) return process.env.WORLDCUP_API_TOKEN;
  const { WORLDCUP_API_EMAIL: email, WORLDCUP_API_PASSWORD: password } = process.env;
  if (!email || !password) {
    console.error('❌  No API credentials.\n    Set WORLDCUP_API_TOKEN (or WORLDCUP_API_EMAIL + WORLDCUP_API_PASSWORD) in .env');
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

// ── fetch ─────────────────────────────────────────────────────────────────────

async function fetchGames(token) {
  const res = await fetch(`${API_BASE}/get/games`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) { console.error(`❌  API error: ${res.status}`); process.exit(1); }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.games || data.data || []);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function pad(str, len) {
  const s = String(str ?? '');
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching schedule JSON…');
  const schedule   = JSON.parse(fs.readFileSync(SCHEDULE, 'utf8'));
  const localByNum = {};
  for (const m of schedule.matches) localByNum[m.match_number] = m;

  console.log('Fetching API games…\n');
  const token = await getToken();
  const games = await fetchGames(token);

  const groupGames = games
    .filter(g => parseInt(g.id, 10) >= 1 && parseInt(g.id, 10) <= MAX_GAMES)
    .sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

  let orderMismatches = 0;
  let nameOnly        = 0;

  const COL = 38;
  const SEP = '─'.repeat(4 + 2 + COL + 2 + COL + 2 + 12);

  console.log(
    `${'#'.padEnd(4)} ${pad('API (game.id order)', COL)}  ${pad('Our JSON (match_number)', COL)}  Status`
  );
  console.log(SEP);

  for (const game of groupGames) {
    const num   = parseInt(game.id, 10);
    const local = localByNum[num];

    const apiLabel   = `${game.home_team_name_en} vs ${game.away_team_name_en}`;
    const localLabel = local ? `${local.team_a} vs ${local.team_b}` : '(not found)';
    const apiTime    = game.local_date ? game.local_date.slice(-5) : '??:??';
    const localTime  = local ? local.time_et : '??:??';

    const apiNorm   = normTeams(game.home_team_name_en, game.away_team_name_en);
    const localNorm = local ? normTeams(local.team_a, local.team_b) : '';

    const exactMatch = apiNorm === localNorm;
    // Same game after name normalisation but different label → name-only diff
    const nameOnlyDiff = !exactMatch && apiNorm === localNorm;

    let status;
    if (exactMatch) {
      status = '✅ ok';
    } else if (apiNorm === localNorm) {
      // Can't reach here with current logic but kept for clarity
      status = '🔤 name only';
      nameOnly++;
    } else {
      // Check if it's purely a name-spelling difference (teams match after mapping)
      const apiPair   = [normName(game.home_team_name_en), normName(game.away_team_name_en)].sort().join('|');
      const localPair = local
        ? [normName(local.team_a), normName(local.team_b)].sort().join('|')
        : '';
      if (apiPair === localPair) {
        status = '🔤 name only';
        nameOnly++;
      } else {
        status = '⚠️  ORDER MISMATCH';
        orderMismatches++;
      }
    }

    console.log(
      `${String(num).padEnd(4)} ` +
      `${pad(`${apiLabel} (${apiTime})`, COL)}  ` +
      `${pad(`${localLabel} (${localTime})`, COL)}  ` +
      status
    );
  }

  console.log('\n' + SEP);
  console.log(`\nTotal group games from API  : ${groupGames.length}`);
  console.log(`Name-spelling differences   : ${nameOnly}  (same game, different country name — not a sync bug)`);
  console.log(`Order mismatches            : ${orderMismatches}  (different game at this slot — these break score sync)`);

  if (orderMismatches > 0) {
    console.log('\n💡 Fix: re-sort data/world-cup-2026-schedule.json by date+time_et,');
    console.log('   re-number match_number sequentially, then reseed the database.');
  } else {
    console.log('\n🎉 No ordering mismatches — only name-spelling differences remain.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
