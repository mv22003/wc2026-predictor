/**
 * One-shot script to dump the raw worldcup26.ir API response.
 * Run from the server/ directory:
 *   node debug-api.js
 *
 * Requires WORLDCUP_API_TOKEN (or EMAIL+PASSWORD) in environment or ../.env
 */

require('dotenv').config({ path: '../.env' });

const API_BASE = process.env.WORLDCUP_API_URL || 'https://worldcup26.ir';

async function getToken() {
  if (process.env.WORLDCUP_API_TOKEN) return process.env.WORLDCUP_API_TOKEN;

  const email    = process.env.WORLDCUP_API_EMAIL;
  const password = process.env.WORLDCUP_API_PASSWORD;
  if (!email || !password) throw new Error('No credentials — set WORLDCUP_API_TOKEN or EMAIL+PASSWORD in .env');

  const res  = await fetch(`${API_BASE}/auth/authenticate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.token || data.access_token;
}

async function main() {
  const token = await getToken();
  console.log('✅ Authenticated\n');

  const res = await fetch(`${API_BASE}/get/games`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);

  const raw  = await res.json();
  const games = Array.isArray(raw) ? raw : (raw.games || raw.data || raw);

  console.log(`📦 Total games returned: ${games.length}\n`);

  // Print first 3 games in full so we can see all available fields
  const sample = games.slice(0, 3);
  console.log('─── Sample games (first 3) ───────────────────────────────');
  console.log(JSON.stringify(sample, null, 2));

  // Also print all unique top-level keys across all games
  const allKeys = [...new Set(games.flatMap(g => Object.keys(g)))].sort();
  console.log('\n─── All field names across all games ─────────────────────');
  console.log(allKeys.join(', '));
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
