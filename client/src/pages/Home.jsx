import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Flag from '../components/Flag';

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

function MatchRow({ match }) {
  const live = match.status === 'live';
  const finished = match.status === 'finished';
  const d = match.match_date ? new Date(match.match_date) : null;
  const dateStr = d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBD';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-brand-border last:border-0">
      <span className="tag bg-brand-border text-gray-300 w-16 text-center shrink-0 whitespace-nowrap">{match.group_name}</span>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className={`flex-1 font-semibold text-sm flex items-center gap-1.5 justify-end min-w-0 ${live || finished ? 'text-white' : 'text-gray-300'}`}>
          <span className="truncate text-right">{match.home_team}</span>
          <Flag code={match.home_code} name={match.home_team} className="w-6 h-6 shrink-0" />
        </span>
        {finished ? (
          <span className="font-black text-brand-gold shrink-0 tabular-nums">{match.home_score}–{match.away_score}</span>
        ) : live ? (
          <span className="font-black text-white shrink-0 tabular-nums">{match.home_score}–{match.away_score}</span>
        ) : (
          <span className="text-gray-500 text-xs shrink-0">vs</span>
        )}
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
        <span className="hidden sm:flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-gray-500 whitespace-nowrap">{dateStr}</span>
          <span className="w-7 flex justify-center">
            {finished && <span className="tag pts-exact text-xs">FT</span>}
          </span>
        </span>
      )}
    </div>
  );
}

function LiveNowSection({ matches }) {
  if (matches.length === 0) return null;
  return (
    <div className="card border border-emerald-700/40 bg-emerald-900/10">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <h2 className="font-black text-lg text-emerald-400">Live Now</h2>
        <span className="text-xs text-emerald-600 font-semibold">{matches.length} match{matches.length !== 1 ? 'es' : ''} in progress</span>
        <Link to="/live" className="ml-auto text-emerald-500 text-xs font-semibold hover:underline">
          Full view →
        </Link>
      </div>
      {matches.map(m => <MatchRow key={m.id} match={m} />)}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  function load() {
    Promise.all([api.getLeaderboard(), api.getMatches()])
      .then(([lb, mts]) => {
        setLeaderboard(lb);
        setMatches(mts);
        const finished = mts.filter(m => m.status === 'finished').length;
        const participants = lb.length;
        setStats({ participants, finished, total: mts.length });
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
