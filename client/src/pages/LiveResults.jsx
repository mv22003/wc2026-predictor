import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import Flag from '../components/Flag';
import PredictionsModal from '../components/PredictionsModal';
import { R32_SLOTS, LATE_SLOTS, BEST3RD_TABLE, BEST3RD_SLOTS, calcStandings, resolveTeam, resolveBest3rdSlots } from '../bracketUtils';
import { VENUE_BY_MATCH } from '../venueData';
import schedule from '../../../data/world-cup-2026-schedule.json';

// ─── KO placeholder schedule ───────────────────────────────────────────────────
const STAGE_TO_GROUP = {
  'Round of 32':   'R32',
  'Round of 16':   'R16',
  'Quarter-finals':'QF',
  'Semi-finals':   'SF',
  'Third Place':   '3RD',
  'Final':         'FINAL',
};

const KO_SCHEDULE = Object.fromEntries(
  schedule.matches
    .filter(m => m.match_number >= 73)
    .map(m => [m.match_number, {
      date:    m.date,
      time_et: m.time_et,   // Eastern Time — convert to UTC via -04:00 (EDT, all summer matches)
      stage:   STAGE_TO_GROUP[m.stage] ?? m.stage,
    }])
);

function slotToLabel(slot) {
  if (!slot) return 'TBD';
  if (slot.type === 'group')   return slot.pos === 1 ? `1st Group ${slot.group}` : `2nd Group ${slot.group}`;
  if (slot.type === 'best3rd') return `3rd ${slot.groups.join('/')}`;
  if (slot.type === 'winner')  return `W-M${slot.match}`;
  if (slot.type === 'loser')   return `L-M${slot.match}`;
  return 'TBD';
}

function findRanking(teamName, matches) {
  for (const m of matches) {
    if (m.home_team === teamName && m.home_ranking != null) return m.home_ranking;
    if (m.away_team === teamName && m.away_ranking != null) return m.away_ranking;
  }
  return null;
}

function resolveSlotTeam(slot, byGroup, groupMatchesByGroup, dbByNum) {
  if (!slot) return { name: 'TBD', code: null, ranking: null };

  if (slot.type === 'group') {
    const gm = groupMatchesByGroup[slot.group] || [];
    const standings = byGroup[slot.group] || [];
    const team = standings[slot.pos - 1];
    if (team) {
      // Mirror bracket "Secured" logic: pos 1 needs status 'first', pos 2 needs pos 1 locked + status 'qualified'
      const status0 = getRowStatus(standings, 0, false, gm, null, false);
      const firstLocked = status0 === 'first';
      if (slot.pos === 1 && firstLocked) return { name: team.name, code: team.code, ranking: findRanking(team.name, gm) };
      if (slot.pos === 2 && firstLocked) {
        const status1 = getRowStatus(standings, 1, false, gm, null, false);
        if (status1 === 'qualified') return { name: team.name, code: team.code, ranking: findRanking(team.name, gm) };
      }
    }
    return { name: slotToLabel(slot), code: null, ranking: null };
  }

  if (slot.type === 'best3rd') return { name: slotToLabel(slot), code: null, ranking: null };

  if (slot.type === 'winner' || slot.type === 'loser') {
    const m = dbByNum[slot.match];
    if (m?.status === 'finished') {
      const homeWon = m.outcome === 'pen'
        ? (m.pen_home ?? 0) > (m.pen_away ?? 0)
        : m.home_score > m.away_score;
      const winner = homeWon
        ? { name: m.home_team, code: m.home_code, ranking: m.home_ranking }
        : { name: m.away_team, code: m.away_code, ranking: m.away_ranking };
      const loser  = homeWon
        ? { name: m.away_team, code: m.away_code, ranking: m.away_ranking }
        : { name: m.home_team, code: m.home_code, ranking: m.home_ranking };
      return slot.type === 'winner' ? winner : loser;
    }
    return { name: slotToLabel(slot), code: null, ranking: null };
  }

  return { name: 'TBD', code: null, ranking: null };
}

function buildKOPlaceholders(dbMatches) {
  const dbNums   = new Set(dbMatches.map(m => m.match_number));
  const dbByNum  = Object.fromEntries(dbMatches.map(m => [m.match_number, m]));
  const groupMatches = dbMatches.filter(m => m.phase === 'group');
  const groups   = [...new Set(groupMatches.map(m => m.group_name).filter(Boolean))];
  const groupMatchesByGroup = Object.fromEntries(
    groups.map(g => [g, groupMatches.filter(m => m.group_name === g)])
  );
  const byGroup  = Object.fromEntries(
    groups.map(g => [g, calcStandings(groupMatchesByGroup[g], true)])
  );

  const placeholders = [];
  const ALL_SLOTS = { ...R32_SLOTS, ...LATE_SLOTS };
  for (const [numStr, sched] of Object.entries(KO_SCHEDULE)) {
    const num = Number(numStr);
    if (dbNums.has(num)) continue;
    const slots = ALL_SLOTS[num];
    const home = slots ? resolveSlotTeam(slots.home, byGroup, groupMatchesByGroup, dbByNum) : { name: 'TBD', code: null };
    const away = slots ? resolveSlotTeam(slots.away, byGroup, groupMatchesByGroup, dbByNum) : { name: 'TBD', code: null };
    placeholders.push({
      id:            `ko-placeholder-${num}`,
      match_number:  num,
      group_name:    sched.stage,
      phase:         'knockout',
      status:        'upcoming',
      // Store with EDT offset (-04:00) so JS parses as correct UTC; browser displays in local (BST for UK)
      match_date:    `${sched.date}T${sched.time_et}:00-04:00`,
      home_team:     home.name,
      away_team:     away.name,
      home_code:     home.code,
      away_code:     away.code,
      home_ranking:  home.ranking,
      away_ranking:  away.ranking,
      isPlaceholder: true,
    });
  }
  return placeholders;
}

// ─── Shared helpers ────────────────────────────────────────────────────────────
const PHASE_LABEL = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-finals', sf: 'Semi-finals', '3rd': 'Third Place', final: 'Final',
};


function getAll3rdsRanked(allMatches, groups) {
  const thirds = [];
  for (const g of groups) {
    const gm = allMatches.filter(m => m.group_name === g && m.phase === 'group');
    const standings = calcStandings(gm, true);
    if (standings.length >= 3 && standings[2].played > 0) thirds.push({ ...standings[2], group: g });
  }
  thirds.sort((a, b) =>
    b.pts - a.pts ||
    b.gd  - a.gd  ||
    b.gf  - a.gf  ||
    (b.conduct_score ?? 0) - (a.conduct_score ?? 0) ||
    (a.fifa_ranking ?? Infinity) - (b.fifa_ranking ?? Infinity) ||
    a.name.localeCompare(b.name)
  );
  return thirds;
}

function getBest3rds(allMatches, groups) {
  return new Set(getAll3rdsRanked(allMatches, groups).slice(0, 8).map(t => t.name));
}

// Compare two best-3rd teams: returns positive if `a` ranks above `b`.
function thirdsCompare(a, b) {
  return (a.pts - b.pts) ||
    (a.gd  - b.gd)  ||
    (a.gf  - b.gf)  ||
    ((a.conduct_score ?? 0) - (b.conduct_score ?? 0)) ||
    ((b.fifa_ranking ?? Infinity) - (a.fifa_ranking ?? Infinity));
}

// Returns true if any possible result of remaining matches in `gm` could produce
// a 3rd-place finisher ranked above `candidate`. Tries representative score
// margins (big win / small win / draw / small loss / big loss) to cover GD/GF
// tiebreaker scenarios, not just win/draw/loss outcomes.
function canProduceBetterThird(gm, candidate) {
  const finished = gm.filter(m => m.status === 'finished');
  const remaining = gm.filter(m => m.status !== 'finished');
  const OUTCOMES = [[3, 0], [1, 0], [0, 0], [0, 1], [0, 3]];

  function tryAll(idx, sim) {
    if (idx === remaining.length) {
      const standings = calcStandings([...finished, ...sim], false);
      return standings.length >= 3 && thirdsCompare(standings[2], candidate) > 0;
    }
    const m = remaining[idx];
    return OUTCOMES.some(([hs, as_]) =>
      tryAll(idx + 1, [...sim, { ...m, home_score: hs, away_score: as_, status: 'finished' }])
    );
  }
  return tryAll(0, []);
}

// A team is confirmed in the top-8 best-3rds when, even in the absolute worst case
// (every incomplete group produces the strongest possible 3rd-place team), they
// still cannot be pushed out of the top 8.
// Only teams from fully-complete groups (all 6 matches played) are eligible —
// incomplete groups are handled pessimistically via canProduceBetterThird.
function getMath3rdsConfirmed(allMatches, groups) {
  const complete   = [];
  const incomplete = [];

  for (const g of groups) {
    const gm = allMatches.filter(m => m.group_name === g && m.phase === 'group');
    if (gm.filter(m => m.status === 'finished').length >= 6)
      complete.push({ g, gm });
    else
      incomplete.push({ g, gm });
  }

  const candidates = complete
    .map(({ g, gm }) => {
      const s = calcStandings(gm, false);
      return s.length >= 3 ? { ...s[2], group: g } : null;
    })
    .filter(Boolean);

  const confirmed = new Set();
  for (const candidate of candidates) {
    let possiblyAbove = 0;

    for (const other of candidates) {
      if (other.group === candidate.group) continue;
      if (thirdsCompare(other, candidate) > 0) possiblyAbove++;
    }
    for (const { gm } of incomplete) {
      if (canProduceBetterThird(gm, candidate)) possiblyAbove++;
    }

    if (possiblyAbove <= 7) confirmed.add(candidate.name);
  }
  return confirmed;
}

function TeamName({ name, code }) {
  return (
    <>
      <span className="sm:hidden">{code}</span>
      <span className="hidden sm:inline">{name}</span>
    </>
  );
}

// ─── Groups tab ────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'qualified')
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-[9px] font-black text-emerald-400 leading-none whitespace-nowrap">
        ✓ Q
      </span>
    );
  if (status === 'eliminated')
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-900/30 border border-red-800/50 text-[9px] font-black text-red-500/80 leading-none whitespace-nowrap">
        OUT
      </span>
    );
  return null;
}

function h2hResult(groupMatches, teamName, opponentName) {
  const m = groupMatches.find(m =>
    m.status === 'finished' &&
    ((m.home_team === teamName && m.away_team === opponentName) ||
     (m.home_team === opponentName && m.away_team === teamName))
  );
  if (!m) return null;
  const teamScore = m.home_team === teamName ? m.home_score : m.away_score;
  const oppScore  = m.home_team === teamName ? m.away_score : m.home_score;
  return teamScore > oppScore ? 'won' : teamScore < oppScore ? 'lost' : 'draw';
}

function getRowStatus(standings, i, qualifying3rd, groupMatches, confirmed3rds, hasAnyLive) {
  const row = standings[i];
  const third = standings[2];

  // groupDone must use finished matches only — calcStandings counts live games in
  // played, so standings.every(s => s.played === 3) would be true mid-live-round
  const groupDone = groupMatches.every(m => m.status === 'finished');
  const hasLiveInGroup = groupMatches.some(m => m.status === 'live');

  // Confirmed-status checks must ignore live scores to avoid false positives.
  // A live 2-0 lead is not yet banked, so we only count finished-game pts/played.
  function finishedStats(name) {
    let pts = 0, played = 0;
    for (const m of groupMatches) {
      if (m.status !== 'finished') continue;
      if (m.home_team === name) {
        played++;
        if (m.home_score > m.away_score) pts += 3;
        else if (m.home_score === m.away_score) pts += 1;
      } else if (m.away_team === name) {
        played++;
        if (m.away_score > m.home_score) pts += 3;
        else if (m.away_score === m.home_score) pts += 1;
      }
    }
    return { pts, played, maxPts: pts + 3 * Math.max(0, 3 - played) };
  }

  const rowStats   = finishedStats(row.name);
  const thirdStats = finishedStats(third?.name ?? '');

  if (i < 2) {
    // Confirmed top-2 if at most 1 other team can possibly finish above this team.
    // (Being overtaken by exactly 1 team still leaves you in 2nd place.)
    let couldFinishAbove = 0;
    for (const [j, c] of standings.entries()) {
      if (j === i) continue;
      const cStats = finishedStats(c.name);
      if (cStats.maxPts > rowStats.pts) {
        couldFinishAbove++;
      } else if (cStats.maxPts === rowStats.pts) {
        // Can tie — only a threat if H2H not already settled in our favour
        if (h2hResult(groupMatches, row.name, c.name) !== 'won') couldFinishAbove++;
      }
    }

    // Group is finished — calcStandings already resolved all tiebreakers correctly.
    // Position in the sorted array is definitive; no need to re-check couldFinishAbove.
    if (groupDone) return i === 0 ? 'first' : 'qualified';
    if (couldFinishAbove === 0) return 'first';
    // i=0 with exactly 1 team able to overtake: still confirmed qualified but fighting for 1st
    if (i === 0 && couldFinishAbove === 1 && hasLiveInGroup) return 'live-first';
    if (couldFinishAbove === 1) return 'qualified';
    if (hasLiveInGroup) return i === 0 ? 'live-first' : 'live-qualified';
    return 'top2';
  }

  if (groupDone) {
    if (i === 2 && confirmed3rds?.has(row.name)) return 'qualified';
    if (i === 2) return 'none';
    return 'eliminated';
  }

  // Mid-group position 3: only show live-qualified when mathematically confirmed in
  // the global top-8 (getMath3rdsConfirmed already accounts for whether 4th is locked
  // out in this group AND whether the global ranking guarantees a top-8 finish).
  if (i === 2) return 'none';

  // Position 4: can't finish 3rd if max pts (from finished games) < 3rd's finished pts
  if (rowStats.maxPts < thirdStats.pts) return 'eliminated';

  // Tie in points possible, but H2H already settled in 3rd's favour
  if (rowStats.maxPts === thirdStats.pts && h2hResult(groupMatches, row.name, third.name) === 'lost')
    return 'eliminated';

  if (hasLiveInGroup) return 'eliminated';

  return 'none';
}

function StandingsTable({ groupName, matches, qualifying3rd, confirmed3rds, hasAnyLive }) {
  const [open, setOpen] = useState(false);
  const groupMatches = matches.filter(m => m.group_name === groupName && m.phase === 'group');
  const standings    = calcStandings(groupMatches, true);
  const played       = groupMatches.filter(m => m.status === 'finished').length;
  const hasLive      = groupMatches.some(m => m.status === 'live');
  const groupDone    = played === 6;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border bg-brand-navy/60">
        <div className="flex items-center gap-2">
          <h3 className="font-black text-base">Group {groupName}</h3>
          {hasLive && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/50 text-[10px] font-black text-red-400 leading-none">
              <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse shrink-0" />
              LIVE
            </span>
          )}
        </div>
        {groupDone
          ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-white/10 border border-brand-border text-[9px] font-black text-gray-400 leading-none">FINAL</span>
          : <span className="text-xs text-gray-400">{played}/6 played</span>
        }
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-brand-border/50">
            <th className="px-3 py-2 text-left w-6">#</th>
            <th className="px-3 py-2 text-left">Team</th>
            <th className="px-2 py-2 text-center w-7">P</th>
            <th className="px-2 py-2 text-center w-7">W</th>
            <th className="px-2 py-2 text-center w-7">D</th>
            <th className="px-2 py-2 text-center w-7">L</th>
            <th className="px-2 py-2 text-center w-10 hidden sm:table-cell">GF</th>
            <th className="px-2 py-2 text-center w-10 hidden sm:table-cell">GA</th>
            <th className="px-2 py-2 text-center w-10">GD</th>
            <th className="px-2 py-2 text-center w-10">TCS</th>
            <th className="px-3 py-2 text-center w-10 font-bold text-brand-gold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => {
            const status = getRowStatus(standings, i, qualifying3rd, groupMatches, confirmed3rds, hasAnyLive);
            const isElim      = status === 'eliminated';
            const isLiveFirst = status === 'live-first';
            const isLiveQual  = status === 'live-qualified';
            const isLiveElim  = status === 'live-eliminated';
            return (
            <tr key={row.name}
              style={{
                borderLeft: status === 'first'
                  ? '3px solid rgba(234,179,8,0.85)'
                  : status === 'qualified'
                  ? '3px solid rgba(16,185,129,0.7)'
                  : isElim
                  ? '3px solid rgba(239,68,68,0.6)'
                  : isLiveFirst
                  ? '3px dashed rgba(234,179,8,0.75)'
                  : isLiveQual
                  ? '3px dashed rgba(16,185,129,0.65)'
                  : isLiveElim
                  ? '3px dashed rgba(239,68,68,0.6)'
                  : '3px solid transparent',
              }}
              className={`border-b border-brand-border/30 last:border-0 transition-colors
                ${status === 'first' ? 'bg-yellow-900/15 hover:bg-yellow-900/25'
                  : status === 'qualified' ? 'bg-emerald-900/15 hover:bg-emerald-900/25'
                  : isElim ? 'bg-red-900/10 hover:bg-red-900/15'
                  : isLiveFirst ? 'bg-yellow-900/10 hover:bg-yellow-900/15'
                  : isLiveQual ? 'bg-emerald-900/10 hover:bg-emerald-900/15'
                  : isLiveElim ? 'bg-red-900/10 hover:bg-red-900/15'
                  : i < 2 ? 'bg-emerald-900/10 hover:bg-emerald-900/20'
                  : 'hover:bg-white/5'}`}
            >
              <td className="px-3 py-2.5">
                <span className={`text-xs font-bold
                  ${status === 'first' ? 'text-brand-gold'
                    : status === 'qualified' ? 'text-emerald-400'
                    : isElim ? 'text-red-500/70'
                    : isLiveFirst ? 'text-yellow-500/70'
                    : isLiveQual ? 'text-emerald-400/60'
                    : isLiveElim ? 'text-red-500/60'
                    : 'text-gray-400'}`}>
                  {i + 1}
                </span>
              </td>
              <td className="px-3 py-2.5 max-w-0 w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <Flag code={row.code} name={row.name} className="w-5 h-5 shrink-0" />
                  <span className="font-semibold truncate text-sm">
                    <TeamName name={row.name} code={row.code} />
                  </span>
                </div>
              </td>
              <td className="px-2 py-2.5 text-center text-gray-400">{row.played}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.won}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.drawn}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.lost}</td>
              <td className="px-2 py-2.5 text-center text-gray-400 hidden sm:table-cell">{row.gf}</td>
              <td className="px-2 py-2.5 text-center text-gray-400 hidden sm:table-cell">{row.ga}</td>
              <td className="px-2 py-2.5 text-center text-gray-400">
                {row.gd > 0 ? `+${row.gd}` : row.gd}
              </td>
              <td className="px-2 py-2.5 text-center text-gray-400">{row.conduct_score ?? 0}</td>
              <td className="px-3 py-2.5 text-center font-black text-brand-gold">{row.pts}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-brand-border/50 flex items-center justify-end px-3 py-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
        >
          Matches {open ? '▲' : '▼'}
        </button>
      </div>
      {open && (
        <div className="border-t border-brand-border">
          {groupMatches
            .sort((a, b) => new Date(a.match_date) - new Date(b.match_date))
            .map(m => (
              <div key={m.id} className="flex items-center gap-2 px-4 py-2 border-b border-brand-border/30 last:border-0 hover:bg-white/3">
                <span className="text-xs text-gray-400 w-14 sm:w-28 shrink-0">
                  {m.match_date ? new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                </span>
                <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                  <span className={`text-xs font-semibold truncate text-right ${m.status === 'finished' || m.status === 'live' ? 'text-white' : 'text-gray-400'}`}>
                    <TeamName name={m.home_team} code={m.home_code} />
                  </span>
                  <Flag code={m.home_code} name={m.home_team} className="w-5 h-5 shrink-0" />
                </div>
                <div className="w-16 shrink-0 flex items-center justify-center">
                  {m.status === 'finished' ? (
                    <span className="font-black text-brand-gold text-base tabular-nums">{m.home_score}–{m.away_score}</span>
                  ) : m.status === 'live' ? (
                    <span className="font-black text-white text-base tabular-nums">{m.home_score}–{m.away_score}</span>
                  ) : (
                    <span className="text-xs text-gray-400">
                      {m.match_date ? new Date(m.match_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                    </span>
                  )}
                </div>
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <Flag code={m.away_code} name={m.away_team} className="w-5 h-5 shrink-0" />
                  <span className={`text-xs font-semibold truncate ${m.status === 'finished' || m.status === 'live' ? 'text-white' : 'text-gray-400'}`}>
                    <TeamName name={m.away_team} code={m.away_code} />
                  </span>
                </div>
                <div className="w-14 sm:w-28 shrink-0 flex items-center justify-end">
                  {m.status === 'finished' && <span className="tag pts-exact text-xs">FT</span>}
                  {m.status === 'live' && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/50 text-[10px] font-black text-red-400 leading-none">
                      <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse shrink-0" />
                      LIVE
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function Best3rdsTable({ allMatches, groups }) {
  const thirds = getAll3rdsRanked(allMatches, groups);
  const confirmed3rds = getMath3rdsConfirmed(allMatches, groups);
  if (thirds.length === 0) return null;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border bg-brand-navy/60">
        <h3 className="font-black text-base">Best Third Places</h3>
        <span className="text-xs text-gray-400">{thirds.length} of {groups.length} groups</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-brand-border/50">
            <th className="px-3 py-2 text-left w-6">#</th>
            <th className="px-3 py-2 text-center w-8 hidden sm:table-cell">Group</th>
            <th className="px-3 py-2 text-left">Team</th>
            <th className="px-2 py-2 text-center w-7">P</th>
            <th className="px-2 py-2 text-center w-7">W</th>
            <th className="px-2 py-2 text-center w-7">D</th>
            <th className="px-2 py-2 text-center w-7">L</th>
            <th className="px-2 py-2 text-center w-10 hidden sm:table-cell">GF</th>
            <th className="px-2 py-2 text-center w-10 hidden sm:table-cell">GA</th>
            <th className="px-2 py-2 text-center w-10">GD</th>
            <th className="px-2 py-2 text-center w-10">TCS</th>
            <th className="px-3 py-2 text-center w-10 font-bold text-brand-gold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {thirds.map((row, i) => {
            const isConfirmed = confirmed3rds.has(row.name);
            return (
            <tr key={row.name}
              style={{
                borderLeft: isConfirmed
                  ? '3px solid rgba(16,185,129,0.7)'
                  : '3px solid transparent',
              }}
              className={`border-b border-brand-border/30 last:border-0 transition-colors
                ${isConfirmed ? 'bg-emerald-900/15 hover:bg-emerald-900/25'
                  : i < 8 ? 'bg-amber-900/10 hover:bg-amber-900/20'
                  : 'hover:bg-white/5'}`}
            >
              <td className="px-3 py-2.5">
                <span className={`text-xs font-bold ${isConfirmed ? 'text-emerald-400' : i < 8 ? 'text-amber-400' : 'text-gray-400'}`}>{i + 1}</span>
              </td>
              <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                <span className="text-xs font-bold text-gray-400">{row.group}</span>
              </td>
              <td className="px-3 py-2.5 max-w-0 w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <Flag code={row.code} name={row.name} className="w-5 h-5 shrink-0" />
                  <span className="font-semibold truncate text-sm"><TeamName name={row.name} code={row.code} /></span>
                </div>
              </td>
              <td className="px-2 py-2.5 text-center text-gray-400">{row.played}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.won}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.drawn}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.lost}</td>
              <td className="px-2 py-2.5 text-center text-gray-400 hidden sm:table-cell">{row.gf}</td>
              <td className="px-2 py-2.5 text-center text-gray-400 hidden sm:table-cell">{row.ga}</td>
              <td className="px-2 py-2.5 text-center text-gray-400">
                {row.gd > 0 ? `+${row.gd}` : row.gd}
              </td>
              <td className="px-2 py-2.5 text-center text-gray-400">{row.conduct_score ?? 0}</td>
              <td className="px-3 py-2.5 text-center font-black text-brand-gold">{row.pts}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Maps BEST3RD_SLOTS index → match number and home slot description
const SLOT_CONTEXT = BEST3RD_SLOTS.map(([matchNum]) => {
  const slot = R32_SLOTS[matchNum];
  const home = slot?.home;
  const homeLabel = home?.type === 'group' ? `1${home.group}` : '?';
  const awayDef = slot?.away;
  const poolLabel = awayDef?.groups ? awayDef.groups.join('/') : '?';
  return { matchNum, homeLabel, poolLabel };
});

function AnnexeCPanel({ allMatches, groups }) {
  const thirds = getAll3rdsRanked(allMatches, groups);
  if (thirds.length < 8) return null;

  const top8 = thirds.slice(0, 8);
  const key = top8.map(t => t.group).sort().join('');
  const assignment = BEST3RD_TABLE[key];
  if (!assignment) return null;

  const byGroup = Object.fromEntries(top8.map(t => [t.group, t]));

  // Build group → 1st place team for all groups
  const groupFirstPlace = Object.fromEntries(
    groups.map(g => {
      const gm = allMatches.filter(m => m.group_name === g && m.phase === 'group');
      const standings = calcStandings(gm, true);
      return [g, standings[0] ?? null];
    })
  );

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-brand-border bg-brand-navy/60">
        <h3 className="font-black text-base">Annexe C Assignment</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Active combination: <span className="font-mono text-amber-400 font-bold">{key}</span>
          {' '}— the 8 best 3rd-place groups determine which R32 slot each team fills.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-brand-border/50">
            <th className="px-2 py-2 text-center">Match</th>
            <th className="px-3 py-2 text-left">3rd Place Team</th>
            <th className="px-3 py-2 text-left hidden sm:table-cell">Opponent</th>
            <th className="px-3 py-2 text-left hidden sm:table-cell">Pool</th>
          </tr>
        </thead>
        <tbody>
          {SLOT_CONTEXT.map(({ matchNum, homeLabel, poolLabel }, i) => {
            const groupLetter = assignment[i];
            const team = byGroup[groupLetter];
            return (
              <tr key={matchNum} className="border-b border-brand-border/30 last:border-0 hover:bg-white/5 transition-colors">
                <td className="px-2 py-2.5 text-center">
                  <span className="text-xs font-mono font-bold text-gray-300">M{matchNum}</span>
                </td>
                <td className="px-3 py-2.5">
                  {team ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Flag code={team.code} name={team.name} className="w-5 h-5 shrink-0" />
                      <span className="font-semibold truncate"><TeamName name={team.name} code={team.code} /></span>
                      <span className="text-xs text-gray-500 font-bold">(3{groupLetter})</span>
                      {(() => {
                        const homeGroup = homeLabel.replace('1', '');
                        const opponent = groupFirstPlace[homeGroup];
                        return <span className="sm:hidden flex items-center gap-1 text-xs text-gray-400">
                          <span className="text-gray-600">vs</span>
                          {opponent
                            ? <><Flag code={opponent.code} name={opponent.name} className="w-5 h-5" /><span className="font-semibold"><TeamName name={opponent.name} code={opponent.code} /></span><span className="text-gray-500">({homeLabel})</span></>
                            : <span>{homeLabel}</span>}
                        </span>;
                      })()}
                    </div>
                  ) : (
                    <span className="text-gray-500 text-xs">Group {groupLetter} — TBD</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-gray-400 text-xs hidden sm:table-cell">
                  {(() => {
                    const homeGroup = homeLabel.replace('1', '');
                    const opponent = groupFirstPlace[homeGroup];
                    return opponent
                      ? <div className="flex items-center gap-1.5">
                          <Flag code={opponent.code} name={opponent.name} className="w-4 h-4 shrink-0" />
                          <TeamName name={opponent.name} code={opponent.code} />
                          <span className="text-gray-600">({homeLabel})</span>
                        </div>
                      : <span>{homeLabel}</span>;
                  })()}
                </td>
                <td className="px-3 py-2.5 text-gray-500 text-xs hidden sm:table-cell">From {poolLabel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const COLUMN_LEGEND = [
  ['P', 'Matches Played'], ['W', 'Wins'], ['D', 'Draws'], ['L', 'Loss'],
  ['GF', 'Goals For'], ['GA', 'Goals Against'], ['GD', 'Goal Difference'], ['PTS', 'Points'],
];

const DASH_GRADIENT = (r, g, b, a) =>
  `repeating-linear-gradient(to bottom, rgba(${r},${g},${b},${a}) 0px, rgba(${r},${g},${b},${a}) 4px, transparent 4px, transparent 7px)`;

function GroupsTab({ matches, groups }) {
  const qualifying3rd = getBest3rds(matches, groups);
  const confirmed3rds = getMath3rdsConfirmed(matches, groups);
  const hasAnyLive    = matches.some(m => m.status === 'live' && m.phase === 'group');

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-6">
        {groups.map(g => (
          <StandingsTable key={g} groupName={g} matches={matches} qualifying3rd={qualifying3rd} confirmed3rds={confirmed3rds} hasAnyLive={hasAnyLive} />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-6 items-start">
        <Best3rdsTable allMatches={matches} groups={groups} />
        <AnnexeCPanel allMatches={matches} groups={groups} />
      </div>
      <div className="space-y-1">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {COLUMN_LEGEND.map(([abbr, label]) => (
            <span key={abbr} className="text-xs text-gray-500">
              <span className="text-gray-300 font-semibold">{abbr}</span> = {label}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          <span className="text-gray-300 font-semibold">TCS</span> = Team Conduct Score — calculated based on yellow (-1) and red (-3) cards received
        </p>
      </div>
    </div>
  );
}

// ─── Calendar tab ──────────────────────────────────────────────────────────────
const DATE_FMT = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
function localDateKey(matchDate) {
  return new Date(matchDate).toLocaleDateString('en-GB', DATE_FMT);
}
function localDateISO(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function LiveMinute({ minute }) {
  return (
    <span className="inline-flex items-center justify-center gap-1 w-12 py-0.5 rounded-full bg-red-500/20 border border-red-500/60 text-xs font-semibold text-red-400 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
      LIVE
    </span>
  );
}

function parseScorers(raw) {
  if (!raw || raw === 'null') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(s => ({
      name: s.name ?? s.player ?? s.scorer ?? String(s),
      minute: s.minute ?? s.min ?? s.time ?? null,
    }));
    if (typeof parsed === 'string') raw = parsed;
  } catch {}
  return raw.replace(/[{}"""'']/g, '').split(',').map(s => s.trim()).filter(Boolean).map(part => {
    const m = part.match(/^(.*?)\s+(\d+(?:\+\d+)?)['']?["""]?$/);
    return m ? { name: m[1].trim(), minute: m[2] } : { name: part, minute: null };
  });
}

function parseMinute(m) {
  if (m == null) return 999;
  const str = String(m);
  const parts = str.split('+');
  return parseInt(parts[0], 10) + (parts[1] ? parseInt(parts[1], 10) / 100 : 0);
}

function formatMinute(min) {
  const s = String(min);
  const m = s.match(/^(\d+(?:\+\d+)?)\s*(\(p\))?$/i);
  return m ? ` ${m[1]}'${m[2] ? ' (p)' : ''}` : ` ${s}'`;
}

function ScorerLine({ homeScorers, awayScorers, homeScore, awayScore }) {
  const home = parseScorers(homeScorers).sort((a, b) => parseMinute(a.minute) - parseMinute(b.minute));
  const away = parseScorers(awayScorers).sort((a, b) => parseMinute(a.minute) - parseMinute(b.minute));
  if (home.length !== homeScore || away.length !== awayScore) return null;
  if (home.length === 0 && away.length === 0) return null;

  const rows = Math.max(home.length, away.length);

  return (
    <div className="mt-3 px-1 space-y-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center text-xs text-gray-400 gap-1">
          <span className="flex-1 min-w-0 flex items-center justify-end whitespace-nowrap">
            {home[i] ? `${home[i].name}${home[i].minute != null ? formatMinute(home[i].minute) : ''}` : ''}
          </span>
          <span className="w-16 sm:w-20 shrink-0 flex items-center justify-between">
            {home[i]
              ? <img src="/wc-logos/trionda.webp" alt="goal" className="w-[1em] h-[1em] shrink-0" />
              : <span className="w-[1em] shrink-0" />}
            {away[i]
              ? <img src="/wc-logos/trionda.webp" alt="goal" className="w-[1em] h-[1em] shrink-0" />
              : <span className="w-[1em] shrink-0" />}
          </span>
          <span className="flex-1 min-w-0 flex items-center whitespace-nowrap">
            {away[i] ? `${away[i].name}${away[i].minute != null ? formatMinute(away[i].minute) : ''}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function MatchRow({ match }) {
  const finished  = match.status === 'finished';
  const live      = match.status === 'live';
  const today     = new Date().toDateString();
  const matchDate = match.match_date ? new Date(match.match_date) : null;
  const isToday   = matchDate?.toDateString() === today;
  const timeStr   = matchDate
    ? matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '–';

  const venue = VENUE_BY_MATCH[match.match_number];
  const [showPreds, setShowPreds] = useState(false);

  return (
    <div className={`pt-5 pb-4 px-4 border-b border-brand-border/50 last:border-0
      hover:bg-white/5 transition-colors
      ${live ? 'bg-emerald-900/20 border-l-4 border-l-emerald-400' : ''}`}>
      <div className="flex items-stretch gap-3">
        {/* no mobile spacer needed — FT lives inside the score column, keeping both sides balanced */}
        {/* group · match# pill — desktop only */}
        <div className="hidden sm:flex sm:w-20 shrink-0 items-center justify-center">
          <span className="tag bg-brand-border text-gray-400 text-xs text-center whitespace-nowrap w-full">
            {match.group_name} · M{match.match_number}
          </span>
        </div>

        {/* center: teams + score + venue pill */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Ranking pills row — only rendered when at least one side has a ranking */}
          {(match.home_ranking != null || match.away_ranking != null) && (
            <div className="flex gap-2 sm:gap-3 mb-1.5">
              <div className="flex-1 flex justify-end">
                {match.home_ranking != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-brand-border/60 text-[10px] text-gray-400 whitespace-nowrap">
                    <img src="/wc-logos/FIFA_Logo_White_Generic.webp" alt="FIFA" className="h-2.5 w-auto opacity-70" />
                    #{match.home_ranking}
                  </span>
                )}
              </div>
              <div className="w-16 sm:w-20 shrink-0" />
              <div className="flex-1">
                {match.away_ranking != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-brand-border/60 text-[10px] text-gray-400 whitespace-nowrap">
                    <img src="/wc-logos/FIFA_Logo_White_Generic.webp" alt="FIFA" className="h-2.5 w-auto opacity-70" />
                    #{match.away_ranking}
                  </span>
                )}
              </div>
            </div>
          )}
          {/* Teams + score row — clean items-center so flags always align with the score */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
              <span className={`text-sm font-semibold min-w-0 truncate text-right ${finished || live ? 'text-white' : 'text-gray-300'}`}>
                {match.home_code ? <TeamName name={match.home_team} code={match.home_code} /> : match.home_team}
              </span>
              {match.home_code && <Flag code={match.home_code} name={match.home_team} className="w-6 sm:w-7 h-6 sm:h-7 shrink-0" />}
            </div>
            <div className="w-16 sm:w-20 shrink-0 flex flex-col items-center justify-center relative">
              {finished && <span className="sm:hidden absolute -top-6 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">FT</span>}
              {live && <span className="sm:hidden absolute -top-6 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[10px] font-semibold text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />LIVE</span>}
              {finished ? (
                <div className="relative">
                  <span className="font-black text-brand-gold text-xl tabular-nums block">
                    {match.home_score}–{match.away_score}
                  </span>
                  {match.outcome === 'pen' && match.pen_home != null && (
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 text-[10px] text-brand-gold tabular-nums whitespace-nowrap font-bold">
                      ({match.pen_home}–{match.pen_away} pens)
                    </span>
                  )}
                  {match.outcome === 'et' && !(match.outcome === 'pen' && match.pen_home != null) && (
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 text-[10px] text-brand-gold font-bold">ET</span>
                  )}
                </div>
              ) : live ? (
                <span className="font-black text-white text-xl tabular-nums">
                  {match.home_score}–{match.away_score}
                </span>
              ) : (
                <span className={`text-sm font-bold tabular-nums ${isToday ? 'text-brand-gold' : 'text-gray-400'}`}>
                  {timeStr}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              {match.away_code && <Flag code={match.away_code} name={match.away_team} className="w-6 sm:w-7 h-6 sm:h-7 shrink-0" />}
              <span className={`text-sm font-semibold min-w-0 truncate ${finished || live ? 'text-white' : 'text-gray-300'}`}>
                {match.away_code ? <TeamName name={match.away_team} code={match.away_code} /> : match.away_team}
              </span>
            </div>
          </div>
          {(finished || live) && (
            <div className={match.outcome === 'pen' && match.pen_home != null ? 'mt-3' : ''}>
              <ScorerLine
                homeScorers={match.home_scorers}
                awayScorers={match.away_scorers}
                homeScore={match.home_score ?? 0}
                awayScore={match.away_score ?? 0}
              />
            </div>
          )}
          {venue && (
            <div className={`${match.outcome === 'pen' && match.pen_home != null ? 'mt-5' : 'mt-3'} flex justify-center`}>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/5 border border-brand-border/60 text-[11px] text-gray-400 whitespace-nowrap">
                {venue}
              </span>
            </div>
          )}
          {/* Predictions button — inside center column so it aligns with the score */}
          {!match.isPlaceholder && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={() => setShowPreds(true)}
                className="text-[11px] text-brand-gold/70 hover:text-brand-gold transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.356-3.789M9 20H4v-2a4 4 0 015.356-3.789M15 11a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                View predictions
              </button>
            </div>
          )}
        </div>

        {/* FT / LIVE / Today / date — desktop only; mobile FT lives inside the score column */}
        <div className="hidden sm:flex sm:w-16 shrink-0 items-center justify-end">
          {finished ? (
            <span className="tag pts-exact text-xs inline-flex justify-center w-12">
              FT
            </span>
          ) : live ? (
            <LiveMinute minute={match.live_minute} />
          ) : (
            <span className="text-xs text-gray-400 hidden sm:block">
              {matchDate?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
      {showPreds && <PredictionsModal match={match} onClose={() => setShowPreds(false)} />}
    </div>
  );
}

function DateGroup({ matches, dateKey }) {
  const todayKey = new Date().toLocaleDateString('en-GB', DATE_FMT);
  const isToday  = dateKey === todayKey;
  const label    = dateKey ? dateKey.replace(/\s\d{4}$/, '') : '';
  return (
    <div className={`card p-0 overflow-hidden ${isToday ? 'border border-brand-gold/50' : ''}`}>
      <div className={`px-4 py-2.5 flex items-center gap-2 border-b border-brand-border ${isToday ? 'bg-brand-gold/20' : 'bg-brand-navy/60'}`}>
        <h3 className={`font-bold text-sm ${isToday ? 'text-brand-gold' : 'text-gray-300'}`}>{label}</h3>
        {isToday && <span className="hidden sm:inline text-brand-gold/50 text-sm">·</span>}
        {isToday && <span className="hidden sm:inline-flex tag bg-brand-gold text-brand-navy text-sm font-bold">Today</span>}
        <span className="ml-auto text-xs text-gray-400">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
      </div>
      {matches.map(m => <MatchRow key={m.id} match={m} />)}
    </div>
  );
}

const KO_PHASES = ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'];
const KO_PHASE_LABEL = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-finals', SF: 'Semi-finals', '3RD': 'Third Place', FINAL: 'Final' };

function FilterBtn({ value, active, onChange, compact, stretch, children }) {
  return (
    <button
      onClick={() => onChange(value)}
      className={`${compact ? 'px-4 py-1 text-xs' : 'px-5 py-1.5 text-sm'} ${stretch ? 'flex-1' : ''} rounded-lg font-bold transition-all ${
        active === value
          ? 'bg-brand-gold text-brand-navy'
          : 'bg-brand-card border border-brand-border text-gray-300 hover:border-brand-gold/50'
      }`}
    >
      {children}
    </button>
  );
}

// Dropdown filter button: shows baseLabel by default; clicking opens a menu with baseLabel + sub-options
function FilterDropdown({ baseValue, baseLabel, options, active, onChange, compact, stretch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const activeOption = options.find(o => o.value === active);
  const isActive = active === baseValue || !!activeOption;

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className={`relative${stretch ? ' flex-1 sm:flex-none flex flex-col' : ''}`} ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`${compact ? 'px-4 py-1 text-xs' : 'px-5 py-1.5 text-sm'} ${stretch ? 'flex-1 w-full sm:flex-none sm:w-auto' : ''} rounded-lg font-bold transition-all whitespace-nowrap ${
          isActive
            ? 'bg-brand-gold text-brand-navy'
            : 'bg-brand-card border border-brand-border text-gray-300 hover:border-brand-gold/50'
        }`}
      >
        {activeOption ? activeOption.label + ' ▾' : baseLabel}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-brand-card border border-brand-border rounded-lg shadow-xl overflow-hidden min-w-[140px]">
          <button
            onClick={() => { onChange(baseValue); setOpen(false); }}
            className={`w-full text-left px-4 py-2 text-sm font-bold transition-colors ${
              active === baseValue ? 'bg-brand-gold text-brand-navy' : 'text-gray-300 hover:bg-white/10'
            }`}
          >
            {'All ' + baseLabel.replace(' ▾', '')}
          </button>
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm font-bold transition-colors ${
                active === o.value ? 'bg-brand-gold text-brand-navy' : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarTab({ matches, filter, pendingScrollToToday, setPendingScrollToToday }) {
  const calFiltered = filter === 'all'         ? matches
    : filter === 'GROUP_STAGE'                 ? matches.filter(m => m.phase === 'group')
    : filter === 'KNOCKOUTS'                   ? matches.filter(m => m.phase !== 'group')
    : matches.filter(m => m.group_name === filter);

  const byDate = {};
  for (const m of calFiltered) {
    const key = m.match_date ? localDateKey(m.match_date) : 'TBD';
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(m);
  }
  for (const key of Object.keys(byDate)) {
    byDate[key].sort((a, b) => new Date(a.match_date) - new Date(b.match_date));
  }

  useEffect(() => {
    if (!pendingScrollToToday) return;
    function scrollToEl(el) {
      if (!el) return;
      const stickyHeight = Array.from(document.querySelectorAll('.sticky'))
        .reduce((sum, s) => sum + s.offsetHeight, 0);
      const top = el.getBoundingClientRect().top + window.scrollY - stickyHeight - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    const liveEl = document.querySelector('[data-has-live="true"]');
    if (liveEl) {
      scrollToEl(liveEl);
    } else {
      const todayISO = localDateISO(new Date());
      const nearestUpcoming = matches
        .filter(m => m.status === 'upcoming' && m.match_date)
        .filter(m => localDateISO(m.match_date) >= todayISO)
        .sort((a, b) => new Date(a.match_date) - new Date(b.match_date))[0];
      const target = nearestUpcoming
        ? localDateKey(nearestUpcoming.match_date)
        : new Date().toLocaleDateString('en-GB', DATE_FMT);
      scrollToEl(document.querySelector(`[data-date="${target}"]`));
    }
    setPendingScrollToToday(false);
  }, [pendingScrollToToday, filter]);

  return (
    <div className="space-y-4">
      {Object.entries(byDate).map(([dateStr, dayMatches]) => (
        <div key={dateStr} data-date={dateStr} data-has-live={dayMatches.some(m => m.status === 'live') ? 'true' : undefined}>
          <DateGroup matches={dayMatches} dateKey={dateStr} />
        </div>
      ))}
    </div>
  );
}

// ─── Bracket tab ───────────────────────────────────────────────────────────────
const CW  = 88;
const CH  = 48;
const GAP = 28;
const COL = CW + GAP;
const SH  = 68;
const H   = 8 * SH;

const L_R32 = 0;
const L_R16 = L_R32 + COL;
const L_QF  = L_R16 + COL;
const L_SF  = L_QF  + COL;
const MG    = 46;
const FINAL = L_SF  + CW + MG;
const R_SF  = FINAL + CW + MG;
const R_QF  = R_SF  + COL;
const R_R16 = R_QF  + COL;
const R_R32 = R_R16 + COL;
const TW    = R_R32 + CW;

const yc = {
  r32: i => (i + 0.5) * SH,
  r16: i => (2 * i + 1) * SH,
  qf:  i => (4 * i + 2) * SH,
  sf:  ()  => H / 2,
};

const LEFT  = { r32: [74, 77, 73, 75, 83, 84, 81, 82], r16: [89, 90, 93, 94], qf: [97, 98], sf: [101] };
const RIGHT = { r32: [76, 78, 79, 80, 86, 88, 85, 87], r16: [91, 92, 95, 96], qf: [99, 100], sf: [102] };

const BRACKET_LABELS = [
  { label: 'R32', x: L_R32 }, { label: 'R16', x: L_R16 },
  { label: 'QF',  x: L_QF  }, { label: 'SF',  x: L_SF  },
  { label: 'FINAL', x: FINAL },
  { label: 'SF',  x: R_SF  }, { label: 'QF',  x: R_QF  },
  { label: 'R16', x: R_R16 }, { label: 'R32', x: R_R32 },
];

function slotLabel(slot) {
  if (!slot) return null;
  if (slot.type === 'group') return { main: `${slot.pos}${slot.group}`, sub: null };
  if (slot.type === 'best3rd') return { main: `3${slot.groups.join('/')}`, sub: null };
  return null;
}

function BCard({ matchNum, dbByNum, projMap, allTeamsPlayed, flip = false, securedMode = false, lockedPositions = {}, allGroupsDone = false }) {
  const dbMatch  = dbByNum[matchNum];
  const finished = dbMatch?.status === 'finished';
  const homeWon  = finished && (dbMatch.outcome === 'pen'
    ? (dbMatch.pen_home ?? 0) > (dbMatch.pen_away ?? 0)
    : dbMatch.home_score > dbMatch.away_score);
  const awayWon  = finished && (dbMatch.outcome === 'pen'
    ? (dbMatch.pen_away ?? 0) > (dbMatch.pen_home ?? 0)
    : dbMatch.away_score > dbMatch.home_score);

  const r32Slots = R32_SLOTS[matchNum];

  function isSlotLocked(slot) {
    if (!slot) return false;
    if (slot.type === 'group') return !!lockedPositions[`${slot.group}_${slot.pos}`];
    if (slot.type === 'best3rd') return allGroupsDone;
    return false;
  }

  function getTeam(side) {
    if (securedMode) {
      if (r32Slots) {
        // R32: secured if admin locked it in DB, or the group stage is done
        if (!dbMatch && !isSlotLocked(r32Slots[side])) return null;
        if (dbMatch) return { code: dbMatch[`${side}_code`], name: dbMatch[`${side}_team`] };
        return projMap?.[matchNum]?.[side] ?? null;
      }
      // R16+: only secured if admin confirmed the match
      if (dbMatch) return { code: dbMatch[`${side}_code`], name: dbMatch[`${side}_team`] };
      return null;
    }
    if (dbMatch) return { code: dbMatch[`${side}_code`], name: dbMatch[`${side}_team`] };
    if (r32Slots && !allTeamsPlayed) return null;
    return projMap?.[matchNum]?.[side] ?? null;
  }

  const home = getTeam('home');
  const away = getTeam('away');

  // Show slot labels when: R32 slot exists and team isn't shown
  const showLabelFor = (side, team) => {
    if (!r32Slots || team) return null;
    if (securedMode) return !isSlotLocked(r32Slots[side]) ? slotLabel(r32Slots[side]) : null;
    return !allTeamsPlayed ? slotLabel(r32Slots[side]) : null;
  };
  const homeSlot = showLabelFor('home', home);
  const awaySlot = showLabelFor('away', away);
  const rh   = CH / 2;

  function Row({ team, score, penScore, won, slot }) {
    const codeText = team ? (team.code || team.name?.slice(0, 3).toUpperCase()) : null;
    return (
      <div className={`flex items-center gap-1 px-1.5 ${won ? 'bg-emerald-500/10' : ''} ${flip ? 'flex-row-reverse' : ''}`}
           style={{ height: rh }}>
        {team ? (
          <>
            <Flag code={team.code} name={team.name} className="w-3.5 h-3.5 shrink-0" />
            <span className={`text-[11px] font-bold w-[26px] shrink-0 truncate leading-none uppercase
              ${flip ? 'text-right' : ''} ${won ? 'text-white' : 'text-gray-300'}`}>
              {codeText}
            </span>
          </>
        ) : slot ? (
          <div className={`flex flex-col justify-center flex-1 ${flip ? 'items-end' : 'items-start'}`}>
            <span className={`text-[11px] font-bold text-gray-400 leading-none`}>{slot.main}</span>
            {slot.sub && <span className={`text-[8px] text-gray-400 leading-none mt-0.5`}>{slot.sub}</span>}
          </div>
        ) : (
          <>
            <span className="w-3.5 h-3.5 rounded-sm bg-brand-border/20 shrink-0" />
            <span className={`text-[10px] text-gray-400 w-[26px] leading-none ${flip ? 'text-right' : ''}`}>TBD</span>
          </>
        )}
        {finished && (
          <span className={`text-[11px] font-black tabular-nums leading-none ${flip ? 'mr-auto' : 'ml-auto'}
            ${won ? 'text-emerald-400' : 'text-gray-400'}`}>
            {score ?? '–'}{penScore != null && (
              <span className="text-[9px] font-bold text-orange-400/80"> ({penScore})</span>
            )}
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className={`overflow-hidden rounded border ${dbMatch
          ? 'border-brand-border bg-brand-navy'
          : 'border-brand-border bg-brand-card'}`}
           style={{ width: CW, height: CH }}>
        <Row team={home} score={dbMatch?.home_score} penScore={dbMatch?.outcome === 'pen' ? dbMatch?.pen_home : null} won={homeWon} slot={homeSlot} />
        <div className="border-t border-brand-border/30" />
        <Row team={away} score={dbMatch?.away_score} penScore={dbMatch?.outcome === 'pen' ? dbMatch?.pen_away : null} won={awayWon} slot={awaySlot} />
      </div>
    </div>
  );
}

function BracketLines() {
  const segs = [];
  const L = (x1, y1, x2, y2) => segs.push([x1, y1, x2, y2]);

  function connectL(xOut, xIn, ysOut, ysIn) {
    const sx = xOut + CW + GAP / 2;
    for (let i = 0; i < ysIn.length; i++) {
      const yT = ysOut[2 * i], yB = ysOut[2 * i + 1], yM = ysIn[i];
      L(xOut + CW, yT, sx, yT); L(xOut + CW, yB, sx, yB);
      L(sx, yT, sx, yB); L(sx, yM, xIn, yM);
    }
  }

  function connectR(xOut, xIn, ysOut, ysIn) {
    const sx = xOut - GAP / 2;
    for (let i = 0; i < ysIn.length; i++) {
      const yT = ysOut[2 * i], yB = ysOut[2 * i + 1], yM = ysIn[i];
      L(xOut, yT, sx, yT); L(xOut, yB, sx, yB);
      L(sx, yT, sx, yB); L(sx, yM, xIn + CW, yM);
    }
  }

  const ysr32 = Array.from({ length: 8 }, (_, i) => yc.r32(i));
  const ysr16 = Array.from({ length: 4 }, (_, i) => yc.r16(i));
  const ysqf  = Array.from({ length: 2 }, (_, i) => yc.qf(i));
  const yssf  = [yc.sf()];

  connectL(L_R32, L_R16, ysr32, ysr16); connectL(L_R16, L_QF, ysr16, ysqf);
  connectL(L_QF,  L_SF,  ysqf,  yssf);
  L(L_SF + CW, yc.sf(), FINAL, yc.sf());
  connectR(R_R32, R_R16, ysr32, ysr16); connectR(R_R16, R_QF, ysr16, ysqf);
  connectR(R_QF,  R_SF,  ysqf,  yssf);
  L(FINAL + CW, yc.sf(), R_SF, yc.sf());

  return (
    <svg width={TW} height={H} className="absolute inset-0 pointer-events-none">
      {segs.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#374151" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

function BracketTab({ allMatches, securedMode }) {
  const groupMatches = allMatches.filter(m => m.phase === 'group');
  const koMatches    = allMatches.filter(m => m.phase !== 'group');

  const groups = [...new Set(groupMatches.map(m => m.group_name).filter(Boolean))].sort();
  const byGroup = {};
  for (const g of groups) byGroup[g] = calcStandings(groupMatches.filter(m => m.group_name === g), true);

  const dbByNum = {};
  for (const m of allMatches) dbByNum[m.match_number] = m;

  // lockedPositions[`${group}_${pos}`] = true when that EXACT position is secured
  // pos=1 locked only when current leader has status 'first' (nobody can overtake)
  // pos=2 locked only when pos=1 is also locked (so 2nd can't rise to 1st) AND 2nd is 'qualified'
  const lockedPositions = {};
  for (const g of groups) {
    const gMatches  = groupMatches.filter(m => m.group_name === g);
    const standings = byGroup[g] || [];
    if (standings.length < 2) continue;
    const status0 = getRowStatus(standings, 0, false, gMatches, null, false);
    const firstLocked = status0 === 'first';
    lockedPositions[`${g}_1`] = firstLocked;
    if (firstLocked) {
      const status1 = getRowStatus(standings, 1, false, gMatches, null, false);
      lockedPositions[`${g}_2`] = status1 === 'qualified';
    } else {
      lockedPositions[`${g}_2`] = false;
    }
  }
  const allGroupsDone = groups.length === 12 &&
    groupMatches.every(m => m.status === 'finished');

  const teamsWithGame = new Set();
  for (const m of groupMatches.filter(m => m.status === 'finished')) {
    teamsWithGame.add(m.home_team);
    teamsWithGame.add(m.away_team);
  }
  const allTeams = new Set(groupMatches.flatMap(m => [m.home_team, m.away_team]));
  const allTeamsPlayed = allTeams.size > 0 && teamsWithGame.size >= allTeams.size;
  const koFinished     = koMatches.filter(m => m.status === 'finished').length;

  const best3rdMap = resolveBest3rdSlots(byGroup) || {};
  const projMap    = {};

  for (const num of Object.keys(R32_SLOTS).map(Number).sort()) {
    if (dbByNum[num]) continue;
    const slots = R32_SLOTS[num];
    projMap[num] = {};
    for (const side of ['home', 'away']) {
      const slot = slots[side];
      projMap[num][side] = slot.type === 'group'
        ? resolveTeam(slot, byGroup, dbByNum)
        : best3rdMap[num]?.[side] ?? null;
    }
  }

  for (const num of Object.keys(LATE_SLOTS).map(Number)) {
    if (dbByNum[num]) continue;
    const slots = LATE_SLOTS[num];
    projMap[num] = {
      home: resolveTeam(slots.home, byGroup, dbByNum),
      away: resolveTeam(slots.away, byGroup, dbByNum),
    };
  }

  const cards = [];
  function addRound(matchNums, xCol, ycFn, flip = false) {
    matchNums.forEach((num, i) => cards.push({ num, x: xCol, y: ycFn(i) - CH / 2, flip }));
  }

  addRound(LEFT.r32,  L_R32, yc.r32, true);
  addRound(LEFT.r16,  L_R16, yc.r16, true);
  addRound(LEFT.qf,   L_QF,  yc.qf,  true);
  addRound(LEFT.sf,   L_SF,  yc.sf,  true);
  cards.push({ num: 104, x: FINAL, y: yc.sf() - CH / 2, flip: false });
  addRound(RIGHT.sf,  R_SF,  yc.sf);
  addRound(RIGHT.qf,  R_QF,  yc.qf);
  addRound(RIGHT.r16, R_R16, yc.r16);
  addRound(RIGHT.r32, R_R32, yc.r32);

  return (
    <div className="space-y-2">
      {!securedMode && !allTeamsPlayed && (
        <div className="card border-brand-gold/20 bg-brand-gold/5 py-3 px-4 flex items-start gap-3">
          <span className="text-brand-gold text-base leading-none mt-0.5">ⓘ</span>
          <div>
            <p className="text-sm font-semibold text-gray-200">Positions update after every team plays once</p>
            <p className="text-xs text-gray-400 mt-0.5">{teamsWithGame.size} of {allTeams.size} teams have played their first match</p>
          </div>
        </div>
      )}
      {koMatches.length > 0 && (
        <p className="text-gray-400 text-xs">
          {koFinished > 0
            ? `${koFinished} of ${koMatches.length} knockout matches played`
            : `${koMatches.length} knockout match${koMatches.length > 1 ? 'es' : ''} confirmed, awaiting results`}
        </p>
      )}
      <div className="overflow-x-auto pb-4">
        <div style={{ width: TW, minWidth: TW }} className="mx-auto">
          <div className="relative mb-2" style={{ height: 18 }}>
            {BRACKET_LABELS.map(({ label, x }, i) => (
              <span key={i}
                className="absolute flex justify-center text-[10px] font-bold text-gray-400 uppercase tracking-wider"
                style={{ left: x, width: CW }}>
                {label}
              </span>
            ))}
          </div>
          <div className="relative" style={{ width: TW, height: H }}>
            <BracketLines />
            {cards.map(({ num, x, y, flip }) => (
              <div key={num} style={{ position: 'absolute', left: x, top: y }}>
                <BCard matchNum={num} dbByNum={dbByNum} projMap={projMap} allTeamsPlayed={allTeamsPlayed} flip={flip}
                  securedMode={securedMode} lockedPositions={lockedPositions} allGroupsDone={allGroupsDone} />
              </div>
            ))}
            <img
              src="/wc-logos/world-cup-trophy.png"
              alt="World Cup Trophy"
              style={{
                position: 'absolute',
                left: FINAL + CW / 2,
                top: yc.sf() + CH / 2 + (H - yc.sf() - CH / 2) / 2,
                transform: 'translate(-50%, -50%)',
                width: 140,
                height: 'auto',
                opacity: 0.95,
              }}
            />
          </div>
          <div className="flex justify-center mt-6">
            <div className="text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">3rd Place</p>
              <BCard matchNum={103} dbByNum={dbByNum} projMap={projMap} allTeamsPlayed={allTeamsPlayed}
                securedMode={securedMode} lockedPositions={lockedPositions} allGroupsDone={allGroupsDone} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'groups',   label: 'Groups' },
  { id: 'bracket',  label: 'Bracket' },
];

export default function LiveResults() {
  const [matches, setMatches] = useState([]);
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('calendar');
  const [filter,  setFilter]  = useState('all');
  const [pendingScrollToToday, setPendingScrollToToday] = useState(false);
  const [securedMode, setSecuredMode] = useState(false);

  function load() {
    Promise.all([api.getMatches(), api.getGroups()])
      .then(([mts, grps]) => {
        setMatches([...mts, ...buildKOPlaceholders(mts)]);
        setGroups(grps);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const hasLive = matches.some(m => m.status === 'live');
  useEffect(() => {
    const t = setInterval(load, hasLive ? 10_000 : 30_000);
    return () => clearInterval(t);
  }, [hasLive]);

  const dbMatches = matches.filter(m => !m.isPlaceholder);
  const played  = dbMatches.filter(m => m.status === 'finished').length;
  const liveNow = dbMatches.filter(m => m.status === 'live').length;
  const total   = dbMatches.length;
  const koPhases = KO_PHASES;
  const groupMatches = matches.filter(m => m.phase === 'group');
  const allGroupsDone = [...new Set(groupMatches.map(m => m.group_name).filter(Boolean))].length === 12
    && groupMatches.every(m => m.status === 'finished');

  // Reset filter when switching tabs
  useEffect(() => { setFilter('all'); }, [tab]);

  const handleFilterChange = (value) => {
    setFilter(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollToToday = () => {
    if (filter !== 'all') handleFilterChange('all');
    setPendingScrollToToday(true);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
  );

  return (
    <div className="space-y-6">
      <div className="sticky top-14 sm:top-16 z-20 bg-brand-navy -mx-3 px-3 sm:-mx-6 sm:px-6 -mt-6 sm:-mt-8 pt-6 sm:pt-3 pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black">Live Results</h1>
              <p className="text-gray-400 text-sm mt-0.5">
                {played} results · {liveNow > 0 && <><span className="text-emerald-400 font-bold">{liveNow} live</span> · </>}{total - played - liveNow} upcoming · updates every 30s
              </p>
              {tab === 'bracket' && allGroupsDone && (
                <p className="text-gray-400 text-xs mt-0.5">Knockout bracket confirmed</p>
              )}
              {/* Desktop: toggle below subtitle */}
              {tab === 'bracket' && !allGroupsDone && (
                <div className="hidden sm:flex items-center gap-1 p-0.5 bg-brand-card rounded-lg border border-brand-border w-fit mt-2">
                  <button onClick={() => setSecuredMode(false)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${!securedMode ? 'bg-brand-gold text-brand-navy' : 'text-gray-400 hover:text-gray-200'}`}>Projected</button>
                  <button onClick={() => setSecuredMode(true)}  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${securedMode  ? 'bg-brand-gold text-brand-navy' : 'text-gray-400 hover:text-gray-200'}`}>Secured</button>
                </div>
              )}
            </div>
            <div className="flex w-full sm:w-auto rounded-lg overflow-hidden border border-brand-border">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: 'instant' }); }}
                  className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold transition-all ${
                    tab === t.id ? 'bg-brand-gold text-brand-navy' : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {/* Mobile: toggle below tabs */}
          {tab === 'bracket' && !allGroupsDone && (
            <div className="flex sm:hidden items-center gap-1 p-0.5 bg-brand-card rounded-lg border border-brand-border w-fit">
              <button onClick={() => setSecuredMode(false)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${!securedMode ? 'bg-brand-gold text-brand-navy' : 'text-gray-400 hover:text-gray-200'}`}>Projected</button>
              <button onClick={() => setSecuredMode(true)}  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${securedMode  ? 'bg-brand-gold text-brand-navy' : 'text-gray-400 hover:text-gray-200'}`}>Secured</button>
            </div>
          )}
        </div>

        {tab === 'groups' && (
          <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-1.5 gap-x-4">
            <div className="flex items-center gap-x-4">
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-4 rounded-full shrink-0" style={{ background: 'rgba(234,179,8,0.85)' }} />
                <span className="text-xs text-gray-400">1st secured</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-4 rounded-full shrink-0" style={{ background: 'rgba(16,185,129,0.7)' }} />
                <span className="text-xs text-gray-400">Qualified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-4 rounded-full shrink-0" style={{ background: 'rgba(239,68,68,0.6)' }} />
                <span className="text-xs text-gray-400">Eliminated</span>
              </div>
            </div>
            <div className="flex items-center gap-x-4">
              <span className="hidden sm:inline text-gray-700 text-xs">|</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-4 shrink-0 rounded-sm" style={{ background: DASH_GRADIENT(234,179,8,0.75) }} />
                <span className="text-xs text-gray-400">1st (live)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-4 shrink-0 rounded-sm" style={{ background: DASH_GRADIENT(16,185,129,0.65) }} />
                <span className="text-xs text-gray-400">Qual. (live)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-4 shrink-0 rounded-sm" style={{ background: DASH_GRADIENT(239,68,68,0.6) }} />
                <span className="text-xs text-gray-400">Elim. (live)</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'calendar' && (
          <div className="mt-3">
            <div className="flex gap-1.5 items-center">
              <FilterBtn value="all" active={filter} onChange={handleFilterChange} compact>All</FilterBtn>
              <FilterDropdown
                baseValue="GROUP_STAGE"
                baseLabel="Groups ▾"
                options={groups.map(g => ({ value: g, label: `Group ${g}` }))}
                active={filter}
                onChange={handleFilterChange}
                compact stretch
              />
              <FilterDropdown
                baseValue="KNOCKOUTS"
                baseLabel="Knockouts ▾"
                options={koPhases.map(p => ({ value: p, label: KO_PHASE_LABEL[p] ?? p }))}
                active={filter}
                onChange={handleFilterChange}
                compact stretch
              />
              <button
                onClick={handleScrollToToday}
                className="sm:ml-auto px-3 py-1 rounded-lg text-xs font-bold transition-all bg-brand-card border border-brand-gold/40 text-brand-gold hover:border-brand-gold hover:bg-brand-gold/10 whitespace-nowrap"
              >
                ↓ Latest
              </button>
            </div>
          </div>
        )}
      </div>

      {tab === 'groups'   && <GroupsTab   matches={dbMatches} groups={groups} />}
      {tab === 'calendar' && <CalendarTab
        matches={matches}
        filter={filter}
        pendingScrollToToday={pendingScrollToToday}
        setPendingScrollToToday={setPendingScrollToToday}
      />}
      {tab === 'bracket'  && <BracketTab  allMatches={dbMatches} securedMode={securedMode} />}
    </div>
  );
}
