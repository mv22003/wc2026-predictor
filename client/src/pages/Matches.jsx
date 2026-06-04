import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import Flag from '../components/Flag';

const PHASE_LABEL = {
  group: 'Group Stage',
  r32:   'Round of 32',
  r16:   'Round of 16',
  qf:    'Quarter-finals',
  sf:    'Semi-finals',
  '3rd': 'Third Place',
  final: 'Final',
};

function MatchRow({ match }) {
  const finished  = match.status === 'finished';
  const today     = new Date().toDateString();
  const matchDate = match.match_date ? new Date(match.match_date) : null;
  const isToday   = matchDate?.toDateString() === today;

  const timeStr = matchDate
    ? matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '–';

  return (
    <div className={`flex items-center gap-3 py-3 px-4 border-b border-brand-border/50 last:border-0
      hover:bg-white/5 transition-colors ${isToday && !finished ? 'bg-brand-gold/5' : ''}`}>

      {/* Group / Phase badge */}
      <span className="tag bg-brand-border text-gray-400 text-xs w-8 text-center shrink-0">
        {match.group_name || PHASE_LABEL[match.phase]?.slice(0, 3)}
      </span>

      {/* Home team */}
      <div className="flex-1 min-w-0 flex items-center gap-2 justify-end">
        <span className={`text-sm font-semibold truncate text-right ${finished ? 'text-white' : 'text-gray-300'}`}>
          {match.home_team}
        </span>
        <Flag code={match.home_code} name={match.home_team} className="w-7 h-7 shrink-0" />
      </div>

      {/* Score / Time */}
      <div className="w-20 shrink-0 text-center">
        {finished ? (
          <span className="font-black text-brand-gold text-lg tabular-nums">
            {match.home_score} – {match.away_score}
          </span>
        ) : (
          <span className={`text-sm font-bold tabular-nums ${isToday ? 'text-brand-gold' : 'text-gray-500'}`}>
            {timeStr}
          </span>
        )}
      </div>

      {/* Away team */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <Flag code={match.away_code} name={match.away_team} className="w-7 h-7 shrink-0" />
        <span className={`text-sm font-semibold truncate ${finished ? 'text-white' : 'text-gray-300'}`}>
          {match.away_team}
        </span>
      </div>

      {/* Status */}
      <div className="w-16 shrink-0 text-right hidden sm:block">
        {finished ? (
          <span className="tag pts-exact text-xs">FT</span>
        ) : isToday ? (
          <span className="tag bg-brand-gold/20 text-brand-gold border border-brand-gold/30 text-xs">Today</span>
        ) : (
          <span className="text-xs text-gray-600">
            {matchDate ? matchDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
          </span>
        )}
      </div>
    </div>
  );
}

function DateGroup({ dateStr, matches }) {
  const date   = new Date(matches[0].match_date);
  const today  = new Date().toDateString();
  const isToday = date.toDateString() === today;

  const label = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="card p-0 overflow-hidden">
      <div className={`px-4 py-2.5 flex items-center gap-2 border-b border-brand-border
        ${isToday ? 'bg-brand-gold/10' : 'bg-brand-navy/60'}`}>
        <h3 className={`font-bold text-sm ${isToday ? 'text-brand-gold' : 'text-gray-300'}`}>
          {label}
        </h3>
        {isToday && <span className="tag bg-brand-gold text-brand-navy text-xs font-bold">Today</span>}
        <span className="ml-auto text-xs text-gray-600">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
      </div>
      {matches.map(m => <MatchRow key={m.id} match={m} />)}
    </div>
  );
}

export default function Matches() {
  const [matches, setMatches]       = useState([]);
  const [filter, setFilter]         = useState('all');
  const [groups, setGroups]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const todayRef                    = useRef(null);

  function load() {
    Promise.all([api.getMatches(), api.getGroups()])
      .then(([mts, grps]) => {
        setMatches(mts);
        setGroups(grps);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  // Scroll to today on first load
  useEffect(() => {
    if (!loading && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading]);

  const filtered = filter === 'all'
    ? matches
    : matches.filter(m => m.group_name === filter);

  // Group by calendar date
  const byDate = {};
  for (const m of filtered) {
    const key = m.match_date
      ? new Date(m.match_date).toDateString()
      : 'TBD';
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(m);
  }

  const today  = new Date().toDateString();
  const played = matches.filter(m => m.status === 'finished').length;
  const total  = matches.length;

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">📅 Match Calendar</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {played} results entered · {total - played} upcoming · updates every 30 s
          </p>
        </div>
        <button
          onClick={() => todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="btn-secondary text-sm"
        >
          Jump to Today ↓
        </button>
      </div>

      {/* Group filter */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
            filter === 'all'
              ? 'bg-brand-gold text-brand-navy'
              : 'bg-brand-card border border-brand-border text-gray-300 hover:border-brand-gold/50'
          }`}
        >
          All
        </button>
        {groups.map(g => (
          <button
            key={g}
            onClick={() => setFilter(g)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
              filter === g
                ? 'bg-brand-gold text-brand-navy'
                : 'bg-brand-card border border-brand-border text-gray-300 hover:border-brand-gold/50'
            }`}
          >
            Group {g}
          </button>
        ))}
      </div>

      {/* Calendar */}
      <div className="space-y-4">
        {Object.entries(byDate).map(([dateStr, dayMatches]) => (
          <div
            key={dateStr}
            ref={dateStr === today ? todayRef : null}
          >
            <DateGroup dateStr={dateStr} matches={dayMatches} />
          </div>
        ))}
      </div>
    </div>
  );
}
