import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : null;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-brand-border last:border-0">
      <span className={`w-8 text-center font-bold text-sm rank-${row.rank}`}>
        {medal || `#${row.rank}`}
      </span>
      <span className="flex-1 font-semibold truncate">{row.name}</span>
      <span className="text-xs text-gray-400">{row.exact_scores} exact</span>
      <span className="font-black text-brand-gold text-lg w-12 text-right">{row.total_points}</span>
    </div>
  );
}

function MatchRow({ match }) {
  const d = match.match_date ? new Date(match.match_date) : null;
  const dateStr = d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBD';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-brand-border last:border-0">
      <span className="tag bg-brand-border text-gray-300 w-8 text-center">{match.group_name}</span>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="flex-1 font-semibold text-sm flex items-center gap-1.5 justify-end min-w-0">
          <span className="truncate text-right">{match.home_team}</span>
          <Flag code={match.home_code} name={match.home_team} className="w-6 h-6 shrink-0" />
        </span>
        {match.status === 'finished' ? (
          <span className="font-black text-brand-gold shrink-0 tabular-nums">{match.home_score}–{match.away_score}</span>
        ) : (
          <span className="text-gray-500 text-xs shrink-0">vs</span>
        )}
        <span className="flex-1 font-semibold text-sm flex items-center gap-1.5 min-w-0">
          <Flag code={match.away_code} name={match.away_team} className="w-6 h-6 shrink-0" />
          <span className="truncate">{match.away_team}</span>
        </span>
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap hidden sm:block">{dateStr}</span>
    </div>
  );
}

export default function Home() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  const upcoming = matches.filter(m => m.status === 'upcoming').slice(0, 6);
  const recent   = matches.filter(m => m.status === 'finished').slice(-6).reverse();
  const top5     = leaderboard.slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8">

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
            <h1 className="text-3xl sm:text-4xl font-black leading-tight">
              FIFA World Cup<br />
              <span className="text-brand-gold">2026</span>
            </h1>
            <p className="text-gray-400 mt-2 text-sm max-w-md">
              Predict every match, climb the leaderboard, and prove your football knowledge!
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/predict" className="btn-primary inline-flex items-center justify-center text-sm">
                Make Predictions →
              </Link>
              <Link to="/leaderboard" className="btn-secondary inline-flex items-center justify-center text-sm">
                View Leaderboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <StatBox label="Players" value={stats.participants} />
        <StatBox label="Matches Played" value={stats.finished} color="text-emerald-400" />
        <StatBox label="Total Matches" value={stats.total} color="text-sky-400" />
      </div>

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
      <div className="grid sm:grid-cols-2 gap-6">

        {/* Leaderboard preview */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-lg">🏆 Leaderboard</h2>
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
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-lg">
              {recent.length > 0 ? '✅ Recent Results' : '📅 Upcoming Matches'}
            </h2>
            <Link to="/live" className="text-brand-gold text-xs font-semibold hover:underline">
              Full Calendar →
            </Link>
          </div>
          {recent.length > 0 ? (
            recent.map(m => <MatchRow key={m.id} match={m} />)
          ) : upcoming.length > 0 ? (
            upcoming.map(m => <MatchRow key={m.id} match={m} />)
          ) : (
            <p className="text-gray-500 text-sm py-4 text-center">
              No matches loaded yet. Ask the admin to seed the database.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
