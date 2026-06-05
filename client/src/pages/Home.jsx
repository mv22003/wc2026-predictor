import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Flag from '../components/Flag';
import { VENUE_BY_MATCH } from '../venueData';

function StatBox({ label, value, color = 'text-brand-gold' }) {
  return (
    <div className="card text-center">
      <p className={`text-3xl font-black ${color}`}>{value ?? '—'}</p>
      <p className="text-gray-400 text-sm mt-1">{label}</p>
    </div>
  );
}

function MiniLeaderRow({ row }) {
  const medal = null;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-brand-border last:border-0">
      <span className={`w-8 text-center font-bold text-sm rank-${row.rank}`}>
        {medal || `#${row.rank}`}
      </span>
      <span className="flex-1 font-semibold truncate">{row.name}</span>

      <span className="font-black text-brand-gold text-lg w-12 text-right">{row.total_points}</span>
    </div>
  );
}

function parseScorers(raw) {
  if (!raw || raw === 'null') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(s => ({ name: s.name ?? String(s), minute: s.minute ?? null }));
  } catch {}
  return [{ name: raw, minute: null }];
}

function parseMinute(m) {
  if (m == null) return 999;
  const parts = String(m).split('+');
  return parseInt(parts[0], 10) + (parts[1] ? parseInt(parts[1], 10) / 100 : 0);
}

function LiveMatchCard({ match, showMinute = false }) {
  const venue = VENUE_BY_MATCH[match.match_number] || match.venue;
  const homeScorers = parseScorers(match.home_scorers).sort((a, b) => parseMinute(a.minute) - parseMinute(b.minute));
  const awayScorers = parseScorers(match.away_scorers).sort((a, b) => parseMinute(a.minute) - parseMinute(b.minute));
  const showScorers = homeScorers.length === (match.home_score ?? 0)
    && awayScorers.length === (match.away_score ?? 0)
    && (homeScorers.length > 0 || awayScorers.length > 0);

  return (
    <div className="py-2 px-1">
      {/* minute pill — own row so flags align purely with the score */}
      {showMinute && (
        <div className="flex justify-center mb-1">
          <span className="flex items-center gap-1 text-sm font-black text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            {match.live_minute != null ? `${match.live_minute}'` : 'LIVE'}
          </span>
        </div>
      )}
      {/* teams + score — flags now center-align with score only */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span className="text-lg font-black text-white text-right leading-tight truncate">{match.home_team}</span>
          <Flag code={match.home_code} name={match.home_team} className="w-12 h-12 shrink-0" />
        </div>
        <div className="shrink-0 px-2">
          <span className="text-4xl font-black text-white tabular-nums">
            {match.home_score} – {match.away_score}
          </span>
        </div>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Flag code={match.away_code} name={match.away_team} className="w-12 h-12 shrink-0" />
          <span className="text-lg font-black text-white leading-tight truncate">{match.away_team}</span>
        </div>
      </div>

      {/* scorers — mirror gap-2 + shrink-0 px-2 centre to align with score column */}
      {showScorers && (
        <div className="mt-2 space-y-0.5">
          {Array.from({ length: Math.max(homeScorers.length, awayScorers.length) }, (_, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
              <span className="flex-1 text-right">
                {homeScorers[i] ? `${homeScorers[i].name}${homeScorers[i].minute != null ? ` ${homeScorers[i].minute}'` : ''} ⚽️` : ''}
              </span>
              <span className="shrink-0 px-2 flex justify-center">
                <span className="w-px h-3 bg-brand-border/60" />
              </span>
              <span className="flex-1">
                {awayScorers[i] ? `⚽️ ${awayScorers[i].name}${awayScorers[i].minute != null ? ` ${awayScorers[i].minute}'` : ''}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* venue */}
      {venue && (
        <div className="mt-2 flex justify-center">
          <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-brand-border/60 text-xs text-gray-500 whitespace-nowrap">
            {venue}
          </span>
        </div>
      )}
    </div>
  );
}

function MatchRow({ match }) {
  const live     = match.status === 'live';
  const finished = match.status === 'finished';
  const d        = match.match_date ? new Date(match.match_date) : null;
  const dateStr  = d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBD';

  return (
    <div className="py-3 border-b border-brand-border last:border-0">
      <div className="flex items-center gap-3">
        <span className="tag bg-brand-border text-gray-300 w-16 text-center shrink-0 whitespace-nowrap">{match.group_name}</span>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className={`flex-1 font-semibold text-sm flex items-center gap-1.5 justify-end min-w-0 ${live || finished ? 'text-white' : 'text-gray-300'}`}>
            <span className="truncate text-right">{match.home_team}</span>
            <Flag code={match.home_code} name={match.home_team} className="w-6 h-6 shrink-0" />
          </span>
          <span className="w-12 shrink-0 flex items-center justify-center">
            {finished ? (
              <span className="font-black text-brand-gold tabular-nums">{match.home_score} – {match.away_score}</span>
            ) : live ? (
              <span className="font-black text-white tabular-nums">{match.home_score} – {match.away_score}</span>
            ) : (
              <span className="text-gray-500 text-xs">vs</span>
            )}
          </span>
          <span className={`flex-1 font-semibold text-sm flex items-center gap-1.5 min-w-0 ${live || finished ? 'text-white' : 'text-gray-300'}`}>
            <Flag code={match.away_code} name={match.away_team} className="w-6 h-6 shrink-0" />
            <span className="truncate">{match.away_team}</span>
          </span>
        </div>
        {live ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 whitespace-nowrap shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            {match.live_minute != null ? `${match.live_minute}'` : 'LIVE'}
          </span>
        ) : (
          <span className="hidden sm:flex items-center justify-end gap-1.5 shrink-0 w-44">
            <span className="text-xs text-gray-500 whitespace-nowrap">{dateStr}</span>
            <span className="w-7 shrink-0 flex justify-center">
              {finished && <span className="tag pts-exact text-xs">FT</span>}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function LiveNowSection({ matches }) {
  if (matches.length === 0) return null;
  const showMinuteInHeader = matches.length === 1;
  return (
    <div className="card border border-emerald-700/40 bg-emerald-900/10">
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <h2 className="font-black text-lg text-emerald-400">Live Now</h2>
        </span>
        {showMinuteInHeader && (
          <span className="text-xl font-black text-emerald-400">
            {matches[0].live_minute != null ? `${matches[0].live_minute}'` : 'LIVE'}
          </span>
        )}
      </div>
      <div className={matches.length > 1 ? 'grid grid-cols-2 divide-x divide-brand-border/40' : ''}>
        {matches.map(m => <LiveMatchCard key={m.id} match={m} showMinute={!showMinuteInHeader} />)}
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const isDemo = new URLSearchParams(window.location.search).has('demo');

  function load() {
    Promise.all([api.getLeaderboard(), api.getMatches()])
      .then(([lb, mts]) => {
        let allMatches = mts;
        if (isDemo && mts.length > 0) {
          const demo1 = {
            ...mts[0],
            status: 'live', live_minute: 67,
            home_score: 2, away_score: 1,
            home_scorers: '[{"name":"Hernández","minute":"23"},{"name":"Vega","minute":"58"}]',
            away_scorers: '[{"name":"Adeyemi","minute":"45+2"}]',
          };
          const demo2 = {
            ...mts[1 < mts.length ? 1 : 0],
            id: 'demo2',
            status: 'live', live_minute: 12,
            home_score: 0, away_score: 1,
            home_scorers: null,
            away_scorers: '[{"name":"Müller","minute":"8"}]',
          };
          allMatches = [demo1, demo2, ...mts.slice(2)];
        }
        setLeaderboard(lb);
        setMatches(allMatches);
        const finished = allMatches.filter(m => m.status === 'finished').length;
        setStats({ participants: lb.length, finished, total: allMatches.length });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const liveMatches = matches.filter(m => m.status === 'live');
  const upcoming    = matches.filter(m => m.status === 'upcoming').slice(0, 3);
  const recent      = matches.filter(m => m.status === 'finished').slice(-3).reverse();
  const top5        = leaderboard.slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="card relative overflow-hidden">
        {/* Background gradient accent */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/10 via-transparent to-brand-blue/10 pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <img
            src="/wc-logos/wc2026-logo-white.svg"
            alt="FIFA World Cup 2026"
            className="h-28 w-auto shrink-0 px-3"
          />

          <div>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight whitespace-nowrap">
              FIFA World Cup <span className="text-brand-gold">2026</span>
            </h1>
            <p className="text-gray-400 mt-2 text-sm whitespace-nowrap">
              Predict every match, climb the leaderboard, and prove your football knowledge!
            </p>
            <div className="mt-4">
              <Link to="/predict" className="btn-primary inline-flex items-center justify-center text-sm">
                Make Predictions →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Live Now ────────────────────────────────────────────────────────── */}
      <LiveNowSection matches={liveMatches} />

      {/* ── Scoring guide ───────────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-3">How Scoring Works</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="tag pts-exact px-3 py-1 text-sm font-bold">5 pts</span>
            <span className="text-sm text-gray-300">Exact scoreline</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="tag pts-correct px-3 py-1 text-sm font-bold">3 pts</span>
            <span className="text-sm text-gray-300">Correct result + goal difference</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="tag bg-amber-800/30 text-amber-500 border border-amber-700/30 px-3 py-1 text-sm font-bold">1 pt</span>
            <span className="text-sm text-gray-300">Correct result (W/D/L) only</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="tag pts-zero px-3 py-1 text-sm font-bold">0 pts</span>
            <span className="text-sm text-gray-300">Wrong prediction</span>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-5 gap-6">

        {/* Leaderboard preview */}
        <div className="card sm:col-span-2 cursor-pointer" onClick={() => navigate('/leaderboard')}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-lg">Leaderboard</h2>
            <Link to="/leaderboard" className="text-brand-gold text-xs font-semibold hover:underline">
              Full table →
            </Link>
          </div>
          {top5.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No predictions yet. Be the first!</p>
          ) : (
            top5.map(row => <MiniLeaderRow key={row.id} row={row} />)
          )}
        </div>

        {/* Matches */}
        <div className="card sm:col-span-3 cursor-pointer" onClick={() => navigate('/live')}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-lg">Matches</h2>
            <Link to="/live" className="text-brand-gold text-xs font-semibold hover:underline">
              Full Calendar →
            </Link>
          </div>
          {recent.length === 0 && upcoming.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">
              No matches loaded yet.
            </p>
          ) : (
            <>
              {recent.length > 0 && (
                <>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Recent Results</p>
                  {recent.map(m => <MatchRow key={m.id} match={m} />)}
                </>
              )}
              {recent.length > 0 && upcoming.length > 0 && (
                <div className="border-t border-brand-border/40 my-2" />
              )}
              {upcoming.length > 0 && (
                <>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Upcoming Matches</p>
                  {upcoming.map(m => <MatchRow key={m.id} match={m} />)}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
