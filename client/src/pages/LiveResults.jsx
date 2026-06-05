import { useEffect, useState } from 'react';
import { api } from '../api';
import Flag from '../components/Flag';
import { R32_SLOTS, LATE_SLOTS, calcStandings, resolveTeam, resolveBest3rdSlots } from '../bracketUtils';
import { VENUE_BY_MATCH } from '../venueData';

// ─── Shared helpers ────────────────────────────────────────────────────────────
const PHASE_LABEL = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-finals', sf: 'Semi-finals', '3rd': 'Third Place', final: 'Final',
};

function calcGroupStandings(groupMatches) {
  const table = {};
  for (const m of groupMatches) {
    for (const key of ['home', 'away']) {
      const name = m[`${key}_team`];
      if (!table[name]) table[name] = {
        name, code: m[`${key}_code`],
        played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, gd: 0, pts: 0,
      };
    }
  }
  for (const m of groupMatches) {
    if (m.status !== 'finished') continue;
    const hs = m.home_score, as_ = m.away_score;
    const h = table[m.home_team], a = table[m.away_team];
    h.played++; h.gf += hs; h.ga += as_; h.gd = h.gf - h.ga;
    a.played++; a.gf += as_; a.ga += hs; a.gd = a.gf - a.ga;
    if (hs > as_)       { h.won++;   h.pts += 3; a.lost++; }
    else if (hs < as_)  { a.won++;   a.pts += 3; h.lost++; }
    else                { h.drawn++; h.pts++;     a.drawn++; a.pts++; }
  }
  return Object.values(table).sort((a, b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
  );
}

function getBest3rds(allMatches, groups) {
  const thirds = [];
  for (const g of groups) {
    const gm = allMatches.filter(m => m.group_name === g && m.phase === 'group');
    const standings = calcGroupStandings(gm);
    if (standings.length >= 3 && standings[2].played > 0) thirds.push(standings[2]);
  }
  thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));
  return new Set(thirds.slice(0, 8).map(t => t.name));
}

// ─── Groups tab ────────────────────────────────────────────────────────────────
function StandingsTable({ groupName, matches, qualifying3rd }) {
  const [open, setOpen] = useState(false);
  const groupMatches = matches.filter(m => m.group_name === groupName && m.phase === 'group');
  const standings    = calcGroupStandings(groupMatches);
  const played       = groupMatches.filter(m => m.status === 'finished').length;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border bg-brand-navy/60">
        <h3 className="font-black text-base">Group {groupName}</h3>
        <span className="text-xs text-gray-500">{played}/6 played</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-brand-border/50">
            <th className="px-3 py-2 text-left w-6">#</th>
            <th className="px-3 py-2 text-left">Team</th>
            <th className="px-2 py-2 text-center w-7">P</th>
            <th className="px-2 py-2 text-center w-7">W</th>
            <th className="px-2 py-2 text-center w-7">D</th>
            <th className="px-2 py-2 text-center w-7">L</th>
            <th className="px-2 py-2 text-center w-10 hidden sm:table-cell">GF</th>
            <th className="px-2 py-2 text-center w-10 hidden sm:table-cell">GA</th>
            <th className="px-2 py-2 text-center w-10">GD</th>
            <th className="px-3 py-2 text-center w-10 font-bold text-brand-gold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr key={row.name}
              className={`border-b border-brand-border/30 last:border-0 transition-colors
                ${i < 2
                  ? 'bg-emerald-900/10 hover:bg-emerald-900/20'
                  : i === 2 && qualifying3rd?.has(row.name)
                  ? 'bg-amber-900/10 hover:bg-amber-900/20'
                  : 'hover:bg-white/5'}`}
            >
              <td className="px-3 py-2.5">
                <span className={`text-xs font-bold
                  ${i < 2 ? 'text-emerald-400'
                    : i === 2 && qualifying3rd?.has(row.name) ? 'text-amber-400'
                    : 'text-gray-600'}`}>
                  {i + 1}
                </span>
              </td>
              <td className="px-3 py-2.5 max-w-0 w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <Flag code={row.code} name={row.name} className="w-5 h-5 shrink-0" />
                  <span className="font-semibold truncate text-sm">{row.name}</span>
                </div>
              </td>
              <td className="px-2 py-2.5 text-center text-gray-400">{row.played}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.won}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.drawn}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.lost}</td>
              <td className="px-2 py-2.5 text-center text-gray-500 hidden sm:table-cell">{row.gf}</td>
              <td className="px-2 py-2.5 text-center text-gray-500 hidden sm:table-cell">{row.ga}</td>
              <td className="px-2 py-2.5 text-center text-gray-400">
                {row.gd > 0 ? `+${row.gd}` : row.gd}
              </td>
              <td className="px-3 py-2.5 text-center font-black text-brand-gold">{row.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-brand-border/50 flex items-center justify-end px-3 py-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
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
                <span className="text-xs text-gray-600 w-28 shrink-0 hidden sm:block">
                  {m.match_date ? new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                </span>
                <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                  <span className={`text-xs font-semibold truncate text-right ${m.status === 'finished' ? 'text-white' : 'text-gray-400'}`}>
                    {m.home_team}
                  </span>
                  <Flag code={m.home_code} name={m.home_team} className="w-5 h-5 shrink-0" />
                </div>
                <div className="w-16 shrink-0 flex items-center justify-center">
                  {m.status === 'finished' ? (
                    <span className="font-black text-brand-gold text-sm tabular-nums">{m.home_score}–{m.away_score}</span>
                  ) : (
                    <span className="text-xs text-gray-600">
                      {m.match_date ? new Date(m.match_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                    </span>
                  )}
                </div>
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <Flag code={m.away_code} name={m.away_team} className="w-5 h-5 shrink-0" />
                  <span className={`text-xs font-semibold truncate ${m.status === 'finished' ? 'text-white' : 'text-gray-400'}`}>
                    {m.away_team}
                  </span>
                </div>
                <span className={`tag pts-exact text-xs shrink-0 hidden sm:inline ${m.status !== 'finished' ? 'invisible' : ''}`}>FT</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function GroupsTab({ matches, groups }) {
  const qualifying3rd = getBest3rds(matches, groups);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 shrink-0" />
          <span className="text-xs text-gray-400">Qualified (top 2)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70 shrink-0" />
          <span className="text-xs text-gray-400">Best 3rd (8 advance)</span>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        {groups.map(g => (
          <StandingsTable key={g} groupName={g} matches={matches} qualifying3rd={qualifying3rd} />
        ))}
      </div>
    </div>
  );
}

// ─── Calendar tab ──────────────────────────────────────────────────────────────
function LiveMinute({ minute }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
      {minute != null ? `${minute}'` : 'LIVE'}
    </span>
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

  return (
    <div className={`pt-4 pb-3 px-4 border-b border-brand-border/50 last:border-0
      hover:bg-white/5 transition-colors
      ${live ? 'bg-emerald-900/10' : isToday && !finished ? 'bg-brand-gold/5' : ''}`}>
      <div className="flex items-stretch gap-3">
        {/* group · match# pill — spans full height including venue row */}
        <div className="shrink-0 w-20 flex items-center justify-center">
          <span className="tag bg-brand-border text-gray-400 text-xs text-center whitespace-nowrap w-full">
            {match.group_name} · M{match.match_number}
          </span>
        </div>

        {/* center: teams + score + venue pill */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0 flex items-center gap-2 justify-end">
              <span className={`text-sm font-semibold truncate text-right ${finished || live ? 'text-white' : 'text-gray-300'}`}>
                {match.home_team}
              </span>
              <Flag code={match.home_code} name={match.home_team} className="w-7 h-7 shrink-0" />
            </div>
            <div className="w-20 shrink-0 flex items-center justify-center">
              {finished ? (
                <span className="font-black text-brand-gold text-lg tabular-nums">
                  {match.home_score} – {match.away_score}
                </span>
              ) : live ? (
                <span className="font-black text-white text-lg tabular-nums">
                  {match.home_score} – {match.away_score}
                </span>
              ) : (
                <span className={`text-sm font-bold tabular-nums ${isToday ? 'text-brand-gold' : 'text-gray-500'}`}>
                  {timeStr}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <Flag code={match.away_code} name={match.away_team} className="w-7 h-7 shrink-0" />
              <span className={`text-sm font-semibold truncate ${finished || live ? 'text-white' : 'text-gray-300'}`}>
                {match.away_team}
              </span>
            </div>
          </div>
          {venue && (
            <div className="mt-2 flex justify-center">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/5 border border-brand-border/60 text-[11px] text-gray-500 whitespace-nowrap">
                {venue}
              </span>
            </div>
          )}
        </div>

        {/* FT / LIVE / Today / date — spans full height */}
        <div className="w-16 shrink-0 hidden sm:flex items-center justify-end">
          {finished ? (
            <span className="tag pts-exact text-xs">FT</span>
          ) : live ? (
            <LiveMinute minute={match.live_minute} />
          ) : isToday ? (
            <span className="tag bg-brand-gold/20 text-brand-gold border border-brand-gold/30 text-xs">Today</span>
          ) : (
            <span className="text-xs text-gray-600">
              {matchDate?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DateGroup({ matches, dateKey }) {
  // Parse at noon UTC so the label stays on the correct calendar day in all timezones
  const date    = dateKey ? new Date(dateKey + 'T12:00:00Z') : new Date(matches[0].match_date);
  const todayKey = new Date().toISOString().slice(0, 10);
  const isToday  = dateKey === todayKey;
  const label    = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="card p-0 overflow-hidden">
      <div className={`px-4 py-2.5 flex items-center gap-2 border-b border-brand-border ${isToday ? 'bg-brand-gold/10' : 'bg-brand-navy/60'}`}>
        <h3 className={`font-bold text-sm ${isToday ? 'text-brand-gold' : 'text-gray-300'}`}>{label}</h3>
        {isToday && <span className="tag bg-brand-gold text-brand-navy text-xs font-bold">Today</span>}
        <span className="ml-auto text-xs text-gray-600">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
      </div>
      {matches.map(m => <MatchRow key={m.id} match={m} />)}
    </div>
  );
}

const KO_PHASES = ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'];

function FilterBtn({ value, active, onChange, children }) {
  return (
    <button
      onClick={() => onChange(value)}
      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
        active === value
          ? 'bg-brand-gold text-brand-navy'
          : 'bg-brand-card border border-brand-border text-gray-300 hover:border-brand-gold/50'
      }`}
    >
      {children}
    </button>
  );
}

function CalendarTab({ matches, groups }) {
  const [filter, setFilter] = useState('all');

  const koPhases = KO_PHASES.filter(p => matches.some(m => m.group_name === p));

  const calFiltered = filter === 'all'
    ? matches
    : matches.filter(m => m.group_name === filter);

  const byDate = {};
  for (const m of calFiltered) {
    const key = m.match_date ? m.match_date.slice(0, 10) : 'TBD';
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(m);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <FilterBtn value="all" active={filter} onChange={setFilter}>All</FilterBtn>
        {groups.map(g => (
          <FilterBtn key={g} value={g} active={filter} onChange={setFilter}>{g}</FilterBtn>
        ))}
        {koPhases.length > 0 && (
          <span className="w-px bg-brand-border self-stretch mx-1" />
        )}
        {koPhases.map(p => (
          <FilterBtn key={p} value={p} active={filter} onChange={setFilter}>{p}</FilterBtn>
        ))}
      </div>

      {Object.entries(byDate).map(([dateStr, dayMatches]) => (
        <div key={dateStr}>
          <DateGroup matches={dayMatches} dateKey={dateStr} />
        </div>
      ))}
    </div>
  );
}

// ─── Bracket tab ───────────────────────────────────────────────────────────────
const CW  = 104;
const CH  = 48;
const GAP = 34;
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

function BCard({ matchNum, dbByNum, projMap, flip = false }) {
  const dbMatch  = dbByNum[matchNum];
  const finished = dbMatch?.status === 'finished';
  const homeWon  = finished && dbMatch.home_score > dbMatch.away_score;
  const awayWon  = finished && dbMatch.away_score > dbMatch.home_score;

  function getTeam(side) {
    if (dbMatch) return { code: dbMatch[`${side}_code`], name: dbMatch[`${side}_team`] };
    return projMap?.[matchNum]?.[side] ?? null;
  }

  const home = getTeam('home');
  const away = getTeam('away');
  const rh   = CH / 2;

  function Row({ team, score, won }) {
    const codeText = team ? (team.code || team.name?.slice(0, 3).toUpperCase()) : null;
    return (
      <div className={`flex items-center gap-1 px-1.5 ${won ? 'bg-brand-gold/10' : ''} ${flip ? 'flex-row-reverse' : ''}`}
           style={{ height: rh }}>
        {team ? (
          <>
            <Flag code={team.code} name={team.name} className="w-3.5 h-3.5 shrink-0" />
            <span className={`text-[11px] font-bold w-[26px] shrink-0 truncate leading-none uppercase
              ${flip ? 'text-right' : ''} ${won ? 'text-white' : 'text-gray-300'}`}>
              {codeText}
            </span>
          </>
        ) : (
          <>
            <span className="w-3.5 h-3.5 rounded-sm bg-brand-border/20 shrink-0" />
            <span className={`text-[10px] text-gray-600 w-[26px] leading-none ${flip ? 'text-right' : ''}`}>TBD</span>
          </>
        )}
        {finished && (
          <span className={`text-[11px] font-black tabular-nums ${flip ? 'mr-auto' : 'ml-auto'}
            ${won ? 'text-brand-gold' : 'text-gray-600'}`}>
            {score ?? '–'}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded border ${dbMatch
        ? 'border-brand-border bg-brand-navy'
        : 'border-brand-border bg-brand-card'}`}
         style={{ width: CW, height: CH }}>
      <Row team={home} score={dbMatch?.home_score} won={homeWon} />
      <div className="border-t border-brand-border/30" />
      <Row team={away} score={dbMatch?.away_score} won={awayWon} />
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

function BracketTab({ allMatches }) {
  const groupMatches = allMatches.filter(m => m.phase === 'group');
  const koMatches    = allMatches.filter(m => m.phase !== 'group');

  const groups = [...new Set(groupMatches.map(m => m.group_name).filter(Boolean))].sort();
  const byGroup = {};
  for (const g of groups) byGroup[g] = calcStandings(groupMatches.filter(m => m.group_name === g));

  const dbByNum = {};
  for (const m of allMatches) dbByNum[m.match_number] = m;

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

  if (!allTeamsPlayed) {
    return (
      <div className="card text-center py-16">
        <p className="font-semibold text-gray-300">Bracket unlocks after every team plays once</p>
        <p className="text-sm text-gray-500 mt-1">
          {teamsWithGame.size} / {allTeams.size} teams have played their first match
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-gray-400 text-sm">
        {koMatches.length > 0
          ? `${koFinished} of ${koMatches.length} knockout matches played`
          : 'Projected from live standings'}
      </p>
      <div className="overflow-x-auto pb-4">
        <div style={{ width: TW, minWidth: TW }} className="mx-auto">
          <div className="relative mb-2" style={{ height: 18 }}>
            {BRACKET_LABELS.map(({ label, x }, i) => (
              <span key={i}
                className="absolute flex justify-center text-[10px] font-bold text-gray-500 uppercase tracking-wider"
                style={{ left: x, width: CW }}>
                {label}
              </span>
            ))}
          </div>
          <div className="relative" style={{ width: TW, height: H }}>
            <BracketLines />
            {cards.map(({ num, x, y, flip }) => (
              <div key={num} style={{ position: 'absolute', left: x, top: y }}>
                <BCard matchNum={num} dbByNum={dbByNum} projMap={projMap} flip={flip} />
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <div className="text-center">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">3rd Place</p>
              <BCard matchNum={103} dbByNum={dbByNum} projMap={projMap} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'groups',   label: 'Groups' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'bracket',  label: 'Bracket' },
];

export default function LiveResults() {
  const [matches, setMatches] = useState([]);
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('groups');

  function load() {
    Promise.all([api.getMatches(), api.getGroups()])
      .then(([mts, grps]) => { setMatches(mts); setGroups(grps); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const played = matches.filter(m => m.status === 'finished').length;
  const liveNow = matches.filter(m => m.status === 'live').length;
  const total  = matches.length;

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Live Results</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {played} results · {liveNow > 0 && <><span className="text-emerald-400 font-bold">{liveNow} live</span> · </>}{total - played - liveNow} upcoming · updates every 30 s
          </p>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-brand-border">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-bold transition-all ${
                tab === t.id ? 'bg-brand-gold text-brand-navy' : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'groups'   && <GroupsTab   matches={matches} groups={groups} />}
      {tab === 'calendar' && <CalendarTab matches={matches} groups={groups} />}
      {tab === 'bracket'  && <BracketTab  allMatches={matches} />}
    </div>
  );
}
