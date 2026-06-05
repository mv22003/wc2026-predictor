import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import Flag from '../components/Flag';

function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-brand-gold font-black text-sm w-8 text-center">1st</span>;
  if (rank === 2) return <span className="text-gray-300 font-black text-sm w-8 text-center">2nd</span>;
  if (rank === 3) return <span className="text-amber-600 font-black text-sm w-8 text-center">3rd</span>;
  return <span className="text-gray-400 font-bold text-sm w-8 text-center">{rank}</span>;
}

function PtsBadge({ pts }) {
  if (pts === 5) return <span className="tag pts-exact font-bold px-1.5">+5</span>;
  if (pts === 3) return <span className="tag pts-correct font-bold px-1.5">+3</span>;
  if (pts === 1) return <span className="tag bg-amber-800/30 text-amber-500 border border-amber-700/30 font-bold px-1.5">+1</span>;
  return <span className="tag pts-zero font-bold px-1.5">0</span>;
}

function PredictionBreakdown({ name, cache, setCache }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cache[name]) return;
    setLoading(true);
    api.getUser(name)
      .then(data => setCache(prev => ({ ...prev, [name]: data.predictions ?? [] })))
      .catch(() => setCache(prev => ({ ...prev, [name]: [] })))
      .finally(() => setLoading(false));
  }, [name]);

  if (loading) {
    return (
      <tr className="bg-brand-surface/50">
        <td colSpan={8} className="px-6 py-3 text-xs text-gray-500">Loading…</td>
      </tr>
    );
  }

  const predictions = (cache[name] ?? []).filter(p => p.status === 'finished');

  if (predictions.length === 0) {
    return (
      <tr className="bg-brand-surface/50">
        <td colSpan={8} className="px-6 py-3 text-xs text-gray-500">No finished matches yet.</td>
      </tr>
    );
  }

  return (
    <tr className="bg-brand-surface/50">
      <td colSpan={8} className="px-4 py-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {predictions.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 text-xs min-w-0">
              <Flag code={p.home_code} name={p.home_team} className="w-4 h-4 shrink-0" />
              <span className="text-gray-300 font-medium w-6 text-right shrink-0">{p.home_code}</span>
              <span className="font-mono text-white shrink-0">{p.pred_home}–{p.pred_away}</span>
              <span className="text-gray-600 shrink-0">→</span>
              <span className={`font-mono shrink-0 ${p.points > 0 ? 'text-white' : 'text-gray-500'}`}>{p.home_score}–{p.away_score}</span>
              <span className="text-gray-300 font-medium w-6 shrink-0">{p.away_code}</span>
              <Flag code={p.away_code} name={p.away_team} className="w-4 h-4 shrink-0" />
              <PtsBadge pts={p.points} />
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}

export default function Leaderboard() {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [predCache, setPredCache] = useState({});

  useEffect(() => {
    api.getLeaderboard()
      .then(setBoard)
      .catch(console.error)
      .finally(() => setLoading(false));

    const t = setInterval(() => {
      api.getLeaderboard().then(setBoard).catch(() => {});
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const filtered = board.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id) => setExpanded(prev => prev === id ? null : id);

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>;
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Leaderboard</h1>
          <p className="text-gray-400 text-sm">{board.length} players · updates every 30 s</p>
        </div>
        <input
          type="text"
          placeholder="Search player…"
          className="bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-sm
                     focus:border-brand-gold focus:outline-none w-48 transition-colors"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Top 3 podium */}
      {board.length >= 3 && !search && (
        <div className="grid grid-cols-3 gap-3">
          {[board[1], board[0], board[2]].map((row, i) => (
            <div
              key={row.id}
              className={`card text-center transition-all ${
                i === 1 ? 'ring-2 ring-brand-gold/50 bg-brand-gold/5 sm:-mt-4' : ''
              }`}
            >
              <p className={`text-lg font-black mb-1 ${i === 1 ? 'text-brand-gold' : i === 0 ? 'text-gray-300' : 'text-amber-600'}`}>
                {i === 1 ? '1st' : i === 0 ? '2nd' : '3rd'}
              </p>
              <p className="font-black truncate text-sm">{row.name}</p>
              <p className="text-brand-gold font-black text-2xl">{row.total_points}</p>
              <p className="text-gray-500 text-xs">pts</p>
            </div>
          ))}
        </div>
      )}

      {/* Full table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left w-12">#</th>
              <th className="px-4 py-3 text-left">Player</th>
              <th className="px-4 py-3 text-center">Played</th>
              <th className="px-4 py-3 text-center hidden sm:table-cell">
                <span className="tag pts-exact px-2">+5</span>
              </th>
              <th className="px-4 py-3 text-center hidden sm:table-cell">
                <span className="tag pts-correct px-2">+3</span>
              </th>
              <th className="px-4 py-3 text-center hidden sm:table-cell">
                <span className="tag bg-amber-800/30 text-amber-500 border border-amber-700/30 px-2">+1</span>
              </th>
              <th className="px-4 py-3 text-center hidden sm:table-cell">
                <span className="tag pts-zero px-2">0</span>
              </th>
              <th className="px-4 py-3 text-right font-bold text-brand-gold">Points</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-500">
                  {search ? 'No player found.' : 'No predictions submitted yet. Be the first!'}
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <>
                  <tr
                    key={row.id}
                    onClick={() => toggle(row.id)}
                    className={`border-b border-brand-border/50 cursor-pointer hover:bg-white/5 transition-colors ${
                      expanded === row.id ? 'bg-white/5 border-brand-border' : ''
                    } ${idx < 3 && !search ? 'bg-brand-gold/3' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <RankBadge rank={row.rank} />
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      <span className="flex items-center gap-1.5">
                        {row.name}
                        <span className={`text-gray-600 text-xs transition-transform inline-block ${expanded === row.id ? 'rotate-180' : ''}`}>▾</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400">{row.matches_played ?? 0}</td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="tag pts-exact">{row.pts_5 ?? 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="tag pts-correct">{row.pts_3 ?? 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="tag bg-amber-800/30 text-amber-500 border border-amber-700/30">{row.pts_1 ?? 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="tag pts-zero">{row.pts_0 ?? 0}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-brand-gold text-lg">
                      {row.total_points}
                    </td>
                  </tr>
                  {expanded === row.id && (
                    <PredictionBreakdown
                      key={`${row.id}-breakdown`}
                      name={row.name}
                      cache={predCache}
                      setCache={setPredCache}
                    />
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {board.length === 0 && (
        <div className="card text-center py-10 text-gray-500">
          <p className="font-semibold">Leaderboard is empty</p>
          <p className="text-sm mt-1">Share the link with your group and start predicting!</p>
        </div>
      )}
    </div>
  );
}
