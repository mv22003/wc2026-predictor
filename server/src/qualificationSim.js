/**
 * Monte Carlo qualification probability simulator.
 *
 * Simulates remaining round-3 group stage matches (Poisson λ=1.3 per team)
 * and tracks how often each team qualifies via 1st place, 2nd place, or
 * best-3rd-place (top-8 across all 12 groups).
 *
 * H2H tiebreakers are applied using the actual results fed in as `completedMatches`.
 *
 * Usage:
 *   const { runSim } = require('./qualificationSim');
 *   const results = await runSim({ completedMatches, r3Fixtures, groupTeams, iterations: 500_000 });
 *   // results: [{ name, group, pQualify, pVia1st, pVia2nd, pVia3rd }]
 */

'use strict';

function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1.0;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function calcH2H(teamNames, matches) {
  const names = new Set(teamNames);
  const stats = {};
  for (const n of teamNames) stats[n] = { pts: 0, gd: 0, gf: 0 };
  for (const m of matches) {
    if (!names.has(m.home) || !names.has(m.away)) continue;
    stats[m.home].gf += m.hs; stats[m.home].gd += m.hs - m.as_;
    stats[m.away].gf += m.as_; stats[m.away].gd += m.as_ - m.hs;
    if (m.hs > m.as_)      stats[m.home].pts += 3;
    else if (m.hs < m.as_) stats[m.away].pts += 3;
    else                   { stats[m.home].pts++; stats[m.away].pts++; }
  }
  return stats;
}

function resolveTied(tiedTeams, allMatches) {
  if (tiedTeams.length === 1) return tiedTeams;
  const h2h = calcH2H(tiedTeams.map(t => t.name), allMatches);
  const sorted = [...tiedTeams].sort((a, b) =>
    (h2h[b.name].pts - h2h[a.name].pts) ||
    (h2h[b.name].gd  - h2h[a.name].gd)  ||
    (h2h[b.name].gf  - h2h[a.name].gf)
  );
  const result = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    const hi = h2h[sorted[i].name];
    while (j < sorted.length) {
      const hj = h2h[sorted[j].name];
      if (hj.pts === hi.pts && hj.gd === hi.gd && hj.gf === hi.gf) j++;
      else break;
    }
    const sub = sorted.slice(i, j);
    if (sub.length === 1) {
      result.push(sub[0]);
    } else {
      result.push(...sub.sort((a, b) =>
        (b.gd - a.gd) || (b.gf - a.gf) || a.name.localeCompare(b.name)
      ));
    }
    i = j;
  }
  return result;
}

function calcStandings(teamNames, matches) {
  const table = {};
  for (const n of teamNames) table[n] = { name: n, pts: 0, gf: 0, ga: 0, gd: 0 };
  for (const m of matches) {
    const h = table[m.home], a = table[m.away];
    h.gf += m.hs; h.ga += m.as_; h.gd += m.hs - m.as_;
    a.gf += m.as_; a.ga += m.hs; a.gd += m.as_ - m.hs;
    if (m.hs > m.as_)      h.pts += 3;
    else if (m.hs < m.as_) a.pts += 3;
    else                   { h.pts++; a.pts++; }
  }
  const teams = Object.values(table).sort((a, b) => b.pts - a.pts);
  const result = [];
  let i = 0;
  while (i < teams.length) {
    let j = i + 1;
    while (j < teams.length && teams[j].pts === teams[i].pts) j++;
    result.push(...resolveTied(teams.slice(i, j), matches));
    i = j;
  }
  return result;
}

/**
 * @param {object} opts
 * @param {Array}  opts.completedMatches  - { g, home, hs, as_, away } already played
 * @param {Array}  opts.r3Fixtures        - { g, home, away } to simulate
 * @param {object} opts.groupTeams        - { A: [names...], B: [...], ... }
 * @param {number} [opts.iterations=500000]
 * @param {number} [opts.lambda=1.3]      - Poisson goals per team per match
 * @returns {Array} sorted by pQualify desc
 */
function runSim({ completedMatches, r3Fixtures, groupTeams, iterations = 500_000, lambda = 1.3 }) {
  const completedByGroup = {};
  for (const g of Object.keys(groupTeams)) completedByGroup[g] = [];
  for (const m of completedMatches) completedByGroup[m.g].push(m);

  const via1st = {}, via2nd = {}, via3rd = {};
  for (const teams of Object.values(groupTeams))
    for (const t of teams) { via1st[t] = 0; via2nd[t] = 0; via3rd[t] = 0; }

  for (let iter = 0; iter < iterations; iter++) {
    const simByGroup = {};
    for (const g of Object.keys(groupTeams)) simByGroup[g] = [...completedByGroup[g]];
    for (const f of r3Fixtures) {
      simByGroup[f.g].push({ g: f.g, home: f.home, hs: poisson(lambda), as_: poisson(lambda), away: f.away });
    }

    const thirds = [];
    for (const [g, teams] of Object.entries(groupTeams)) {
      const standings = calcStandings(teams, simByGroup[g]);
      via1st[standings[0].name]++;
      via2nd[standings[1].name]++;
      thirds.push({ ...standings[2], group: g });
    }

    thirds.sort((a, b) =>
      (b.pts - a.pts) || (b.gd - a.gd) || (b.gf - a.gf) || a.name.localeCompare(b.name)
    );
    for (let k = 0; k < 8; k++) via3rd[thirds[k].name]++;
  }

  const N = iterations;
  const result = [];
  for (const [g, teams] of Object.entries(groupTeams)) {
    for (const t of teams) {
      result.push({
        name: t, group: g,
        pVia1st:  via1st[t]  / N,
        pVia2nd:  via2nd[t]  / N,
        pVia3rd:  via3rd[t]  / N,
        pQualify: (via1st[t] + via2nd[t] + via3rd[t]) / N,
      });
    }
  }
  return result.sort((a, b) => b.pQualify - a.pQualify);
}

// ── Snapshot data for current tournament state (as of June 24, 2026) ──────────
const COMPLETED_MATCHES = [
  // Group A
  { g:'A', home:'Mexico',        hs:2, as_:0, away:'South Africa' },
  { g:'A', home:'South Korea',   hs:2, as_:1, away:'Czechia' },
  { g:'A', home:'Mexico',        hs:1, as_:0, away:'South Korea' },
  { g:'A', home:'Czechia',       hs:1, as_:1, away:'South Africa' },
  // Group B (all 6 — complete)
  { g:'B', home:'Canada',        hs:1, as_:1, away:'Bosnia' },
  { g:'B', home:'Qatar',         hs:1, as_:1, away:'Switzerland' },
  { g:'B', home:'Switzerland',   hs:4, as_:1, away:'Bosnia' },
  { g:'B', home:'Canada',        hs:6, as_:0, away:'Qatar' },
  { g:'B', home:'Bosnia',        hs:3, as_:1, away:'Qatar' },
  { g:'B', home:'Switzerland',   hs:2, as_:1, away:'Canada' },
  // Group C
  { g:'C', home:'Haiti',         hs:0, as_:1, away:'Scotland' },
  { g:'C', home:'Brazil',        hs:1, as_:1, away:'Morocco' },
  { g:'C', home:'Brazil',        hs:3, as_:0, away:'Haiti' },
  { g:'C', home:'Scotland',      hs:0, as_:1, away:'Morocco' },
  // Group D
  { g:'D', home:'United States', hs:4, as_:1, away:'Paraguay' },
  { g:'D', home:'Australia',     hs:2, as_:0, away:'Turkey' },
  { g:'D', home:'United States', hs:2, as_:0, away:'Australia' },
  { g:'D', home:'Turkey',        hs:0, as_:1, away:'Paraguay' },
  // Group E
  { g:'E', home:'Ivory Coast',   hs:1, as_:0, away:'Ecuador' },
  { g:'E', home:'Germany',       hs:7, as_:1, away:'Curacao' },
  { g:'E', home:'Germany',       hs:2, as_:1, away:'Ivory Coast' },
  { g:'E', home:'Ecuador',       hs:0, as_:0, away:'Curacao' },
  // Group F
  { g:'F', home:'Netherlands',   hs:2, as_:2, away:'Japan' },
  { g:'F', home:'Sweden',        hs:5, as_:1, away:'Tunisia' },
  { g:'F', home:'Netherlands',   hs:5, as_:1, away:'Sweden' },
  { g:'F', home:'Tunisia',       hs:0, as_:4, away:'Japan' },
  // Group G
  { g:'G', home:'Iran',          hs:2, as_:2, away:'New Zealand' },
  { g:'G', home:'Belgium',       hs:1, as_:1, away:'Egypt' },
  { g:'G', home:'Belgium',       hs:0, as_:0, away:'Iran' },
  { g:'G', home:'New Zealand',   hs:1, as_:3, away:'Egypt' },
  // Group H
  { g:'H', home:'Spain',         hs:0, as_:0, away:'Cape Verde' },
  { g:'H', home:'Saudi Arabia',  hs:1, as_:1, away:'Uruguay' },
  { g:'H', home:'Spain',         hs:4, as_:0, away:'Saudi Arabia' },
  { g:'H', home:'Uruguay',       hs:2, as_:2, away:'Cape Verde' },
  // Group I
  { g:'I', home:'France',        hs:3, as_:1, away:'Senegal' },
  { g:'I', home:'Iraq',          hs:1, as_:4, away:'Norway' },
  { g:'I', home:'France',        hs:3, as_:0, away:'Iraq' },
  { g:'I', home:'Norway',        hs:3, as_:2, away:'Senegal' },
  // Group J
  { g:'J', home:'Argentina',     hs:3, as_:0, away:'Algeria' },
  { g:'J', home:'Austria',       hs:3, as_:1, away:'Jordan' },
  { g:'J', home:'Argentina',     hs:2, as_:0, away:'Austria' },
  { g:'J', home:'Jordan',        hs:1, as_:2, away:'Algeria' },
  // Group K
  { g:'K', home:'Portugal',      hs:1, as_:1, away:'DR Congo' },
  { g:'K', home:'Uzbekistan',    hs:1, as_:3, away:'Colombia' },
  { g:'K', home:'Portugal',      hs:5, as_:0, away:'Uzbekistan' },
  { g:'K', home:'Colombia',      hs:1, as_:0, away:'DR Congo' },
  // Group L
  { g:'L', home:'England',       hs:4, as_:2, away:'Croatia' },
  { g:'L', home:'Ghana',         hs:1, as_:0, away:'Panama' },
  { g:'L', home:'Panama',        hs:0, as_:1, away:'Croatia' },
  { g:'L', home:'England',       hs:0, as_:0, away:'Ghana' },
];

const R3_FIXTURES = [
  { g:'A', home:'South Africa',  away:'South Korea' },
  { g:'A', home:'Czechia',       away:'Mexico' },
  { g:'C', home:'Scotland',      away:'Brazil' },
  { g:'C', home:'Morocco',       away:'Haiti' },
  { g:'D', home:'Paraguay',      away:'Australia' },
  { g:'D', home:'Turkey',        away:'United States' },
  { g:'E', home:'Curacao',       away:'Ivory Coast' },
  { g:'E', home:'Ecuador',       away:'Germany' },
  { g:'F', home:'Japan',         away:'Sweden' },
  { g:'F', home:'Tunisia',       away:'Netherlands' },
  { g:'G', home:'Egypt',         away:'Iran' },
  { g:'G', home:'New Zealand',   away:'Belgium' },
  { g:'H', home:'Cape Verde',    away:'Saudi Arabia' },
  { g:'H', home:'Uruguay',       away:'Spain' },
  { g:'I', home:'Senegal',       away:'Iraq' },
  { g:'I', home:'Norway',        away:'France' },
  { g:'J', home:'Algeria',       away:'Austria' },
  { g:'J', home:'Jordan',        away:'Argentina' },
  { g:'K', home:'Colombia',      away:'Portugal' },
  { g:'K', home:'DR Congo',      away:'Uzbekistan' },
  { g:'L', home:'Panama',        away:'England' },
  { g:'L', home:'Croatia',       away:'Ghana' },
];

const GROUP_TEAMS = {
  A: ['Mexico','South Korea','Czechia','South Africa'],
  B: ['Switzerland','Canada','Bosnia','Qatar'],
  C: ['Brazil','Morocco','Scotland','Haiti'],
  D: ['United States','Paraguay','Australia','Turkey'],
  E: ['Germany','Ivory Coast','Ecuador','Curacao'],
  F: ['Netherlands','Japan','Sweden','Tunisia'],
  G: ['Egypt','Belgium','Iran','New Zealand'],
  H: ['Spain','Uruguay','Cape Verde','Saudi Arabia'],
  I: ['France','Norway','Senegal','Iraq'],
  J: ['Argentina','Algeria','Austria','Jordan'],
  K: ['Colombia','Portugal','DR Congo','Uzbekistan'],
  L: ['England','Ghana','Croatia','Panama'],
};

module.exports = { runSim, COMPLETED_MATCHES, R3_FIXTURES, GROUP_TEAMS };

// Run directly if called as main
if (require.main === module) {
  const results = runSim({ completedMatches: COMPLETED_MATCHES, r3Fixtures: R3_FIXTURES, groupTeams: GROUP_TEAMS });
  const pct = v => v > 0.0005 ? (v * 100).toFixed(1) + '%' : '-';
  const pad = (s, n) => String(s).padEnd(n);
  console.log('\nOverall R32 Qualification Probabilities — 500,000 simulations');
  console.log('H2H tiebreakers applied using actual rounds 1 & 2 results\n');
  console.log(pad('Rank',5) + pad('Grp',5) + pad('Team',18) + pad('via 1st',9) + pad('via 2nd',9) + pad('via best-3rd',14) + 'TOTAL');
  console.log('-'.repeat(60));
  results.forEach((t, i) =>
    console.log(pad(i+1,5)+pad(t.group,5)+pad(t.name,18)+pad(pct(t.pVia1st),9)+pad(pct(t.pVia2nd),9)+pad(pct(t.pVia3rd),14)+pct(t.pQualify))
  );
}
