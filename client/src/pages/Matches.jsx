import { useEffect, useState } from 'react';
import { api } from '../api';
import Flag from '../components/Flag';
import { calcStandings } from '../bracketUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PHASE_LABEL = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-finals', sf: 'Semi-finals', '3rd': 'Third Place', final: 'Final',
};

// Returns a Set of team names that are currently in the best 8 third places
function getBest3rds(allMatches, groups) {
  const thirds = [];
  for (const g of groups) {
    const gm = allMatches.filter(m => m.group_name === g && m.phase === 'group');
    const standings = calcStandings(gm);
    if (standings.length >= 3 && standings[2].played > 0) {
      thirds.push(standings[2]);
    }
  }
  thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));
  return new Set(thirds.slice(0, 8).map(t => t.name));
}

// ─── Calendar components ──────────────────────────────────────────────────────
function MatchRow({ match }) {
  const finished  = match.status === 'finished';
  const today     = new Date().toDateString();
  const matchDate = match.match_date ? new Date(match.match_date) : null;
  const isToday   = matchDate?.toDateString() === today;
  const timeStr   = matchDate
    ? matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '–';

  return (
    <div className={`flex items-center gap-3 py-3 px-4 border-b border-brand-border/50 last:border-0
      hover:bg-white/5 transition-colors`}>
      <span className="tag bg-brand-border text-gray-400 text-xs w-8 text-center shrink-0">
        {match.group_name || PHASE_LABEL[match.phase]?.slice(0, 3)}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-2 justify-end">
        <span className={`text-sm font-semibold truncate text-right ${finished ? 'text-white' : 'text-gray-300'}`}>
          {match.home_team}
        </span>
        <Flag code={match.home_code} name={match.home_team} className="w-7 h-7 shrink-0" />
      </div>
      <div className="w-20 shrink-0 text-center">
        {finished ? (
          <span className="font-black text-brand-gold text-xl tabular-nums">
            {match.home_score}–{match.away_score}
          </span>
        ) : (
          <span className={`text-sm font-bold tabular-nums ${isToday ? 'text-brand-gold' : 'text-gray-500'}`}>
            {timeStr}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <Flag code={match.away_code} name={match.away_team} className="w-7 h-7 shrink-0" />
        <span className={`text-sm font-semibold truncate ${finished ? 'text-white' : 'text-gray-300'}`}>
          {match.away_team}
        </span>
      </div>
      <div className="w-16 shrink-0 text-right hidden sm:block">
        {finished ? (
          <span className="tag pts-exact text-xs">FT</span>
        ) : (
          <span className="text-xs text-gray-600">
            {matchDate?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  );
}

const DATE_FMT = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const todayKey  = new Date().toLocaleDateString('en-GB', DATE_FMT);

function localDateKey(matchDate) {
  return new Date(matchDate).toLocaleDateString('en-GB', DATE_FMT);
}

function DateGroup({ dateStr, matches }) {
  const isToday = dateStr === todayKey;
  const label   = dateStr.replace(/\s\d{4}$/, ''); // strip year for display
  return (
    <div className={`card p-0 overflow-hidden ${isToday ? 'border border-brand-gold/50' : ''}`}>
      <div className={`px-4 py-2.5 flex items-center gap-2 border-b border-brand-border ${isToday ? 'bg-brand-gold/20' : 'bg-brand-navy/60'}`}>
        <h3 className={`font-bold text-sm ${isToday ? 'text-brand-gold' : 'text-gray-300'}`}>{label}</h3>
        {isToday && <span className="hidden sm:inline text-brand-gold/50 text-sm">·</span>}
        {isToday && <span className="hidden sm:inline-flex tag bg-brand-gold text-brand-navy text-sm font-bold">Today</span>}
        <span className="ml-auto text-xs text-gray-600">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
      </div>
      {matches.map(m => <MatchRow key={m.id} match={m} />)}
    </div>
  );
}

// ─── Groups view components ───────────────────────────────────────────────────
function StandingsTable({ groupName, matches, qualifying3rd }) {
  const [open, setOpen] = useState(false);
  const groupMatches = matches.filter(m => m.group_name === groupName && m.phase === 'group');
  const standings    = calcStandings(groupMatches);
  const played       = groupMatches.filter(m => m.status === 'finished').length;

  return (
    <div className="card p-0 overflow-hidden">
      {/* Group header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border bg-brand-navy/60">
        <h3 className="font-black text-base">Group {groupName}</h3>
        <span className="text-xs text-gray-500">{played}/6 played</span>
      </div>

      {/* Standings table */}
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
            <th className="px-2 py-2 text-center w-10 hidden sm:table-cell">TCS</th>
            <th className="px-3 py-2 text-center w-10 font-bold text-brand-gold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr
              key={row.name}
              className={`border-b border-brand-border/30 last:border-0 transition-colors
                ${i < 2
                  ? 'bg-emerald-900/10 hover:bg-emerald-900/20'
                  : i === 2 && qualifying3rd?.has(row.name)
                  ? 'bg-amber-900/10 hover:bg-amber-900/20'
                  : 'hover:bg-white/5'}`}
            >
              <td className="px-3 py-2.5">
                <span className={`text-xs font-bold
                  ${i < 2
                    ? 'text-emerald-400'
                    : i === 2 && qualifying3rd?.has(row.name)
                    ? 'text-amber-400'
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
              <td className="px-2 py-2.5 text-center text-gray-400 hidden sm:table-cell">{row.conduct_score ?? 0}</td>
              <td className="px-3 py-2.5 text-center font-black text-brand-gold">{row.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer: matches toggle */}
      <div className="border-t border-brand-border/50 flex items-center justify-end px-3 py-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          Matches {open ? '▲' : '▼'}
        </button>
      </div>

      {/* Collapsible matches */}
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
              <div className="w-16 text-center shrink-0">
                {m.status === 'finished' ? (
                  <span className="font-black text-brand-gold text-base tabular-nums">{m.home_score}–{m.away_score}</span>
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

// ─── Dropdown (Groups view) ───────────────────────────────────────────────────
function GroupDropdown({ groups, active, onChange }) {
  return (
    <select
      value={active}
      onChange={e => onChange(e.target.value)}
      className="bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-sm font-bold
                 text-gray-300 focus:border-brand-gold focus:outline-none transition-colors cursor-pointer"
    >
      <option value="all">All Groups</option>
      {groups.map(g => (
        <option key={g} value={g}>Group {g}</option>
      ))}
    </select>
  );
}

// ─── Pills (Calendar view) ────────────────────────────────────────────────────
function GroupFilter({ groups, active, onChange }) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-7 gap-1.5">
        <button
          onClick={() => onChange('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all w-full ${
            active === 'all' ? 'bg-brand-gold text-brand-navy' : 'bg-brand-card border border-brand-border text-gray-300 hover:border-brand-gold/50'
          }`}
        >All</button>
        {groups.slice(0, 6).map(g => (
          <button key={g} onClick={() => onChange(g)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all w-full ${
              active === g ? 'bg-brand-gold text-brand-navy' : 'bg-brand-card border border-brand-border text-gray-300 hover:border-brand-gold/50'
            }`}
          >Group {g}</button>
        ))}
      </div>
      <div className="flex justify-center gap-1.5">
        {groups.slice(6).map(g => (
          <button key={g} onClick={() => onChange(g)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
              active === g ? 'bg-brand-gold text-brand-navy' : 'bg-brand-card border border-brand-border text-gray-300 hover:border-brand-gold/50'
            }`}
            style={{ minWidth: 'calc((100% - 5 * 0.375rem) / 7)' }}
          >Group {g}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState('groups');   // 'calendar' | 'groups'
  const [filter,  setFilter]  = useState('all');

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
  const total  = matches.length;

  // Calendar view — group by local display date so the box header always matches
  // the date shown on each row (a 9pm ET match is "Saturday" for BST viewers).
  const calFiltered = filter === 'all' ? matches : matches.filter(m => m.group_name === filter);
  const byDate = {};
  for (const m of calFiltered) {
    const key = m.match_date ? localDateKey(m.match_date) : 'TBD';
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(m);
  }

  // Groups view always shows all 12 groups
  const groupsToShow = groups;
  const qualifying3rd = getBest3rds(matches, groups);

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">
            {view === 'groups' ? 'Group Stage' : 'Match Calendar'}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {played} results · {total - played} upcoming · updates every 30 s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-brand-border">
            <button
              onClick={() => setView('groups')}
              className={`px-4 py-2 text-sm font-bold transition-all ${
                view === 'groups' ? 'bg-brand-gold text-brand-navy' : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Groups
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-4 py-2 text-sm font-bold transition-all ${
                view === 'calendar' ? 'bg-brand-gold text-brand-navy' : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Calendar
            </button>
          </div>
        </div>
      </div>

      {/* Filter pills — Calendar view only */}
      {view === 'calendar' && (
        <GroupFilter groups={groups} active={filter} onChange={setFilter} />
      )}

      {/* ── Groups view ─────────────────────────────────────────────────────── */}
      {view === 'groups' && (
        <>
          {/* Shared colour legend */}
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
          {groupsToShow.map(g => (
            <StandingsTable key={g} groupName={g} matches={matches} qualifying3rd={qualifying3rd} />
          ))}
        </div>
        </>
      )}

      {/* ── Calendar view ───────────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <div className="space-y-4">
          {Object.entries(byDate).map(([dateStr, dayMatches]) => (
            <div key={dateStr}>
              <DateGroup dateStr={dateStr} matches={dayMatches} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
