import { useEffect, useState } from 'react';
import { api } from '../api';

function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-brand-gold font-black text-sm w-8 text-center">1st</span>;
  if (rank === 2) return <span className="text-gray-300 font-black text-sm w-8 text-center">2nd</span>;
  if (rank === 3) return <span className="text-amber-600 font-black text-sm w-8 text-center">3rd</span>;
  return <span className="text-gray-400 font-bold text-sm w-8 text-center">{rank}</span>;
}

function BreakdownRow({ row }) {
  const categories = [
    { label: 'Exact scoreline',           pts: 5, count: row.pts_5 ?? 0, cls: 'pts-exact' },
    { label: 'Correct result + goal diff', pts: 3, count: row.pts_3 ?? 0, cls: 'pts-correct' },
    { label: 'Correct result',             pts: 1, count: row.pts_1 ?? 0, cls: 'bg-amber-800/30 text-amber-500 border border-amber-700/30' },
    { label: 'Wrong prediction',           pts: 0, count: row.pts_0 ?? 0, cls: 'pts-zero' },
  ];

  return (
    <tr className="bg-brand-surface/50">
      <td colSpan={8} className="px-6 py-4">
        <div className="flex flex-wrap gap-4">
          {categories.map(({ label, pts, count, cls }) => (
            <div key={pts} className="flex items-center gap-2">
              <span className={`tag font-bold px-2 py-0.5 ${cls}`}>{pts > 0 ? `+${pts}` : '0'}</span>
              <span className="text-sm text-gray-300 font-semibold">{count}×</span>
              <span className="text-xs text-gray-500">{label}</span>
              {pts > 0 && (
                <span className="text-xs text-gray-600">= {count * pts} pts</span>
              )}
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
                      expanded === row.id ? 'bg-white/5' : ''
                    } ${idx < 3 && !search ? 'bg-brand-gold/3' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <RankBadge rank={row.rank} />
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      <span className="flex items-center gap-1.5">
                        {row.name}
                        <span className={`text-gray-600 text-xs transition-transform ${expanded === row.id ? 'rotate-180' : ''}`}>▾</span>
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
                  {expanded === row.id && <BreakdownRow key={`${row.id}-breakdown`} row={row} />}
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
