import { useEffect, useState } from 'react';
import { api } from '../api';
import Flag from '../components/Flag';

// ── Bracket structure ──────────────────────────────────────────────────────────
// R32 slots: which group position feeds each side of each match
const R32_SLOTS = {
  73: { home: { type: 'group',   pos: 2, group: 'A' }, away: { type: 'group',   pos: 2, group: 'B' } },
  74: { home: { type: 'group',   pos: 1, group: 'E' }, away: { type: 'best3rd', groups: ['A','B','C','D','F'] } },
  75: { home: { type: 'group',   pos: 1, group: 'F' }, away: { type: 'group',   pos: 2, group: 'C' } },
  76: { home: { type: 'group',   pos: 1, group: 'C' }, away: { type: 'group',   pos: 2, group: 'F' } },
  77: { home: { type: 'group',   pos: 1, group: 'I' }, away: { type: 'best3rd', groups: ['C','D','F','G','H'] } },
  78: { home: { type: 'group',   pos: 2, group: 'E' }, away: { type: 'group',   pos: 2, group: 'I' } },
  79: { home: { type: 'group',   pos: 1, group: 'A' }, away: { type: 'best3rd', groups: ['C','E','F','H','I'] } },
  80: { home: { type: 'group',   pos: 1, group: 'L' }, away: { type: 'best3rd', groups: ['E','H','I','J','K'] } },
  81: { home: { type: 'group',   pos: 1, group: 'D' }, away: { type: 'best3rd', groups: ['B','E','F','I','J'] } },
  82: { home: { type: 'group',   pos: 1, group: 'G' }, away: { type: 'best3rd', groups: ['A','E','H','I','J'] } },
  83: { home: { type: 'group',   pos: 2, group: 'K' }, away: { type: 'group',   pos: 2, group: 'L' } },
  84: { home: { type: 'group',   pos: 1, group: 'H' }, away: { type: 'group',   pos: 2, group: 'J' } },
  85: { home: { type: 'group',   pos: 1, group: 'B' }, away: { type: 'best3rd', groups: ['E','F','G','I','J'] } },
  86: { home: { type: 'group',   pos: 1, group: 'J' }, away: { type: 'group',   pos: 2, group: 'H' } },
  87: { home: { type: 'group',   pos: 1, group: 'K' }, away: { type: 'best3rd', groups: ['D','E','I','J','L'] } },
  88: { home: { type: 'group',   pos: 2, group: 'D' }, away: { type: 'group',   pos: 2, group: 'G' } },
};

// R16-Final slots: which match winners/losers fill each side
const LATE_SLOTS = {
  89:  { home: { type: 'winner', match: 74 }, away: { type: 'winner', match: 77 } },
  90:  { home: { type: 'winner', match: 73 }, away: { type: 'winner', match: 75 } },
  91:  { home: { type: 'winner', match: 76 }, away: { type: 'winner', match: 78 } },
  92:  { home: { type: 'winner', match: 79 }, away: { type: 'winner', match: 80 } },
  93:  { home: { type: 'winner', match: 83 }, away: { type: 'winner', match: 84 } },
  94:  { home: { type: 'winner', match: 81 }, away: { type: 'winner', match: 82 } },
  95:  { home: { type: 'winner', match: 86 }, away: { type: 'winner', match: 88 } },
  96:  { home: { type: 'winner', match: 85 }, away: { type: 'winner', match: 87 } },
  97:  { home: { type: 'winner', match: 89  }, away: { type: 'winner', match: 90  } },
  98:  { home: { type: 'winner', match: 93  }, away: { type: 'winner', match: 94  } },
  99:  { home: { type: 'winner', match: 91  }, away: { type: 'winner', match: 92  } },
  100: { home: { type: 'winner', match: 95  }, away: { type: 'winner', match: 96  } },
  101: { home: { type: 'winner', match: 97  }, away: { type: 'winner', match: 98  } },
  102: { home: { type: 'winner', match: 99  }, away: { type: 'winner', match: 100 } },
  103: { home: { type: 'loser',  match: 101 }, away: { type: 'loser',  match: 102 } },
  104: { home: { type: 'winner', match: 101 }, away: { type: 'winner', match: 102 } },
};

const ALL_SLOTS = { ...R32_SLOTS, ...LATE_SLOTS };

const PHASES = ['r32', 'r16', 'qf', 'sf', '3rd', 'final'];
const PHASE_LABEL = {
  r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-finals', sf: 'Semi-finals',
  '3rd': 'Third Place', final: 'Final',
};
const PHASE_COLS = {
  r32:   'grid-cols-2 sm:grid-cols-4',
  r16:   'grid-cols-2 sm:grid-cols-4',
  qf:    'grid-cols-2 sm:grid-cols-4',
  sf:    'grid-cols-1 sm:grid-cols-2',
  '3rd': 'grid-cols-1',
  final: 'grid-cols-1',
};
const PHASE_RANGE = {
  r32: [73, 88], r16: [89, 96], qf: [97, 100], sf: [101, 102], '3rd': [103, 103], final: [104, 104],
};

// ── Standings helper (mirrors Matches.jsx) ─────────────────────────────────────
function calcStandings(groupMatches) {
  const table = {};
  for (const m of groupMatches) {
    for (const side of ['home', 'away']) {
      const name = m[`${side}_team`];
      if (!table[name]) table[name] = {
        name, code: m[`${side}_code`],
        played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0,
      };
    }
  }
  for (const m of groupMatches) {
    if (m.status !== 'finished') continue;
    const hs = m.home_score, as_ = m.away_score;
    const h = table[m.home_team], a = table[m.away_team];
    h.played++; h.gf += hs; h.ga += as_; h.gd = h.gf - h.ga;
    a.played++; a.gf += as_; a.ga += hs; a.gd = a.gf - a.ga;
    if (hs > as_)      { h.won++;   h.pts += 3; a.lost++; }
    else if (hs < as_) { a.won++;   a.pts += 3; h.lost++; }
    else               { h.drawn++; h.pts++;     a.drawn++; a.pts++; }
  }
  return Object.values(table).sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
  );
}

// ── Slot helpers ───────────────────────────────────────────────────────────────
function slotLabel(slot) {
  if (!slot) return '';
  if (slot.type === 'group')   return `${slot.pos}${slot.group}`;
  if (slot.type === 'best3rd') return '3rd';
  if (slot.type === 'winner')  return `W${slot.match}`;
  if (slot.type === 'loser')   return `L${slot.match}`;
  return '';
}

function slotColor(slot) {
  if (!slot) return 'text-gray-600';
  if (slot.type === 'group' && slot.pos === 1) return 'text-emerald-400';
  if (slot.type === 'group' && slot.pos === 2) return 'text-sky-400';
  if (slot.type === 'best3rd') return 'text-amber-400';
  return 'text-gray-500';
}

function resolveTeam(slot, byGroup, dbByNum) {
  if (slot.type === 'group') {
    const row = (byGroup[slot.group] || [])[slot.pos - 1];
    return row ? { name: row.name, code: row.code, projected: true } : null;
  }
  if (slot.type === 'best3rd') {
    const thirds = slot.groups
      .map(g => (byGroup[g] || [])[2])
      .filter(t => t && t.played > 0)
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));
    return thirds[0] ? { name: thirds[0].name, code: thirds[0].code, projected: true } : null;
  }
  if (slot.type === 'winner' || slot.type === 'loser') {
    const m = dbByNum[slot.match];
    if (m?.status === 'finished') {
      const homeWon  = m.home_score > m.away_score;
      const pickHome = slot.type === 'winner' ? homeWon : !homeWon;
      return pickHome
        ? { name: m.home_team, code: m.home_code, projected: false }
        : { name: m.away_team, code: m.away_code, projected: false };
    }
    return null;
  }
  return null;
}

// ── Team row variants ──────────────────────────────────────────────────────────
function DBTeamRow({ team, code, score, won, draw, finished, slot }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 border-b border-brand-border/30 last:border-0
      ${won ? 'bg-brand-gold/10' : ''}`}>
      <span className={`text-[10px] font-bold w-6 shrink-0 tabular-nums ${slotColor(slot)}`}>
        {slotLabel(slot)}
      </span>
      <Flag code={code} name={team} className="w-5 h-5 shrink-0" />
      <span className={`flex-1 text-sm font-semibold truncate min-w-0
        ${won ? 'text-white' : finished ? 'text-gray-500' : 'text-gray-300'}`}>
        {team}
      </span>
      {finished && (
        <span className={`text-sm font-black tabular-nums shrink-0
          ${won ? 'text-brand-gold' : draw ? 'text-gray-400' : 'text-gray-600'}`}>
          {score}
        </span>
      )}
    </div>
  );
}

function ProjTeamRow({ team, slot }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-brand-border/30 last:border-0">
      <span className={`text-[10px] font-bold w-6 shrink-0 tabular-nums ${slotColor(slot)}`}>
        {slotLabel(slot)}
      </span>
      {team ? (
        <>
          <Flag code={team.code} name={team.name} className="w-5 h-5 shrink-0" />
          <span className="flex-1 text-sm font-semibold truncate text-gray-400 min-w-0">{team.name}</span>
        </>
      ) : (
        <>
          <span className="w-5 h-5 rounded-sm bg-brand-border/30 shrink-0" />
          <span className="flex-1 text-xs italic truncate text-gray-600 min-w-0">TBD</span>
        </>
      )}
    </div>
  );
}

// ── Match card ─────────────────────────────────────────────────────────────────
function MatchCard({ matchNum, dbMatch, dbByNum, byGroup }) {
  const slots  = ALL_SLOTS[matchNum];
  const isFinal = matchNum === 104;

  if (dbMatch) {
    const finished = dbMatch.status === 'finished';
    const homeWon  = finished && dbMatch.home_score > dbMatch.away_score;
    const awayWon  = finished && dbMatch.away_score > dbMatch.home_score;
    const draw     = finished && dbMatch.home_score === dbMatch.away_score;
    const dateStr  = dbMatch.match_date
      ? new Date(dbMatch.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : null;

    return (
      <div className={`card p-0 overflow-hidden ${isFinal ? 'ring-1 ring-brand-gold/40' : ''}`}>
        <div className="px-3 py-1.5 bg-brand-navy/60 border-b border-brand-border flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-500 shrink-0">M{matchNum}</span>
          {finished
            ? <span className="tag pts-exact text-[10px] px-1.5">FT</span>
            : dateStr
            ? <span className="text-[11px] text-gray-500">{dateStr}</span>
            : <span className="text-[11px] text-gray-600">TBD</span>
          }
        </div>
        <DBTeamRow team={dbMatch.home_team} code={dbMatch.home_code} score={dbMatch.home_score}
          won={homeWon} draw={draw} finished={finished} slot={slots?.home} />
        <DBTeamRow team={dbMatch.away_team} code={dbMatch.away_code} score={dbMatch.away_score}
          won={awayWon} draw={draw} finished={finished} slot={slots?.away} />
      </div>
    );
  }

  if (!slots) return null;
  const homeTeam   = resolveTeam(slots.home, byGroup, dbByNum);
  const awayTeam   = resolveTeam(slots.away, byGroup, dbByNum);
  const hasProjected = homeTeam?.projected || awayTeam?.projected;

  return (
    <div className={`card p-0 overflow-hidden opacity-75 ${isFinal ? 'ring-1 ring-brand-gold/20' : ''}`}>
      <div className="px-3 py-1.5 bg-brand-navy/60 border-b border-brand-border flex items-center justify-between gap-2">
        <span className="text-[11px] text-gray-500 shrink-0">M{matchNum}</span>
        {hasProjected && (
          <span className="text-[10px] text-brand-gold/60 font-bold tracking-wide">PROJ</span>
        )}
      </div>
      <ProjTeamRow team={homeTeam} slot={slots.home} />
      <ProjTeamRow team={awayTeam} slot={slots.away} />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Bracket() {
  const [allMatches, setAllMatches] = useState([]);
  const [loading,    setLoading]    = useState(true);

  function load() {
    api.getMatches()
      .then(setAllMatches)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
  );

  const groupMatches = allMatches.filter(m => m.phase === 'group');
  const koMatches    = allMatches.filter(m => m.phase !== 'group');

  // Standings by group
  const groups = [...new Set(groupMatches.map(m => m.group_name).filter(Boolean))].sort();
  const byGroup = {};
  for (const g of groups) {
    byGroup[g] = calcStandings(groupMatches.filter(m => m.group_name === g));
  }

  // Lookup by match_number
  const dbByNum = {};
  for (const m of allMatches) dbByNum[m.match_number] = m;

  const groupStarted = groupMatches.some(m => m.status === 'finished');
  const koFinished   = koMatches.filter(m => m.status === 'finished').length;

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-2xl font-black">Knockout Bracket</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {koMatches.length > 0
            ? `${koFinished} of ${koMatches.length} knockout matches played · updates every 30 s`
            : groupStarted
            ? 'Projected from live standings · updates every 30 s'
            : 'Bracket will project once the group stage begins'}
        </p>
      </div>

      {!groupStarted ? (
        <div className="card text-center py-16">
          <p className="text-5xl mb-4">⏳</p>
          <p className="font-semibold text-gray-300">Group stage hasn't started yet</p>
          <p className="text-sm text-gray-500 mt-1">The projected bracket will appear once matches kick off</p>
        </div>
      ) : (
        PHASES.map(phase => {
          const [min, max] = PHASE_RANGE[phase];
          const matchNums  = Array.from({ length: max - min + 1 }, (_, i) => min + i);

          // R16 and later: only show once the admin has entered matches for that phase
          const hasDbEntries = matchNums.some(n => dbByNum[n]?.phase === phase);
          if (phase !== 'r32' && !hasDbEntries) return null;

          const phaseFinished = matchNums.filter(n => dbByNum[n]?.status === 'finished').length;
          const isProjectedPhase = phase === 'r32' && !hasDbEntries;

          return (
            <section key={phase}>
              <div className="flex items-baseline gap-2 mb-3">
                <h2 className="text-lg font-black">{PHASE_LABEL[phase]}</h2>
                {hasDbEntries ? (
                  <span className="text-sm text-gray-500">{phaseFinished}/{matchNums.length}</span>
                ) : isProjectedPhase ? (
                  <span className="text-xs font-semibold text-brand-gold/60 uppercase tracking-wide">projected</span>
                ) : null}
              </div>

              <div className={`grid gap-3 ${PHASE_COLS[phase] || 'grid-cols-2 sm:grid-cols-4'}
                ${phase === '3rd' || phase === 'final' ? 'max-w-sm' : ''}`}>
                {matchNums.map(n => (
                  <MatchCard
                    key={n}
                    matchNum={n}
                    dbMatch={dbByNum[n]?.phase === phase ? dbByNum[n] : null}
                    dbByNum={dbByNum}
                    byGroup={byGroup}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

    </div>
  );
}
