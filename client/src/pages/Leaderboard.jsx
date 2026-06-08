import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Flag from '../components/Flag';

function ordinal(n) {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-brand-gold font-black text-sm w-8 text-center">1st</span>;
  if (rank === 2) return <span className="text-gray-300 font-black text-sm w-8 text-center">2nd</span>;
  if (rank === 3) return <span className="text-amber-600 font-black text-sm w-8 text-center">3rd</span>;
  return <span className="text-gray-400 font-bold text-sm w-8 text-center">{ordinal(rank)}</span>;
}


function PtsBadge({ pts }) {
  const base = 'tag font-bold text-center w-8 shrink-0';
  if (pts === 5) return <span className={`${base} pts-exact`}>+5</span>;
  if (pts === 3) return <span className={`${base} pts-correct`}>+3</span>;
  if (pts === 1) return <span className={`${base} bg-amber-800/30 text-amber-500 border border-amber-700/30`}>+1</span>;
  return <span className={`${base} pts-zero`}>0</span>;
}

function SortableCell({ children, col, sort, onSort }) {
  const state = sort.key === col ? sort.dir : null;
  return (
    <th
      className="px-4 py-3 text-center hidden sm:table-cell cursor-pointer select-none hover:opacity-80 transition-opacity"
      onClick={() => onSort(col)}
    >
      <div className="flex items-center justify-center">
        <span className="w-3 shrink-0" />
        {children}
        <span className="w-3 shrink-0 text-gray-600 text-xs leading-none text-left ml-1">
          {state === 'desc' ? '▾' : state === 'asc' ? '▴' : '·'}
        </span>
      </div>
    </th>
  );
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

  const predictions = (cache[name] ?? [])
    .filter(p => p.status === 'finished')
    .sort((a, b) => b.points - a.points);

  if (predictions.length === 0) {
    return (
      <tr className="bg-brand-surface/50">
        <td colSpan={8} className="px-6 py-3 text-xs text-gray-500">No finished matches yet.</td>
      </tr>
    );
  }

  const rowTint = (pts) => {
    if (pts === 5) return 'bg-emerald-900/20 border-l-2 border-l-emerald-400 border-b border-b-brand-border/30 last:border-b-0';
    if (pts === 3) return 'bg-blue-900/10 border-l-2 border-l-blue-500 border-b border-b-brand-border/30 last:border-b-0';
    if (pts === 1) return 'bg-amber-900/15 border-l-2 border-l-amber-500 border-b border-b-brand-border/30 last:border-b-0';
    return 'bg-red-900/10 border-l-2 border-l-red-600 border-b border-b-brand-border/30 last:border-b-0';
  };

  return (
    <tr className="bg-brand-surface/50">
      <td colSpan={8} className="px-4 py-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 overflow-y-auto max-h-48 scrollbar-thin">
          {predictions.map(p => (
            <div key={p.id} className={`flex items-center gap-3 px-3 py-2 text-xs ${rowTint(p.points)}`}>
              <div className="flex items-center gap-1.5 shrink-0">
                <Flag code={p.home_code} name={p.home_team} className="w-4 h-4 shrink-0" />
                <span className="font-semibold text-gray-300">{p.home_code}</span>
                <span className="text-gray-600">vs</span>
                <span className="font-semibold text-gray-300">{p.away_code}</span>
                <Flag code={p.away_code} name={p.away_team} className="w-4 h-4 shrink-0" />
              </div>
              <span className="font-mono text-gray-500 shrink-0 ml-auto">{p.pred_home}–{p.pred_away}</span>
              <span className="text-gray-600 shrink-0">→</span>
              <span className={`font-mono font-bold shrink-0 ${p.points > 0 ? 'text-white' : 'text-gray-600'}`}>{p.home_score}–{p.away_score}</span>
              <PtsBadge pts={p.points} />
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [predCache, setPredCache] = useState({});
  const [sort, setSort] = useState({ key: null, dir: null });
  const [selected, setSelected] = useState(new Set());
  const [flashIds, setFlashIds] = useState(new Set());
  const [lastUpdated, setLastUpdated] = useState(null);
  const prevBoardRef = useRef(null);
  const flashTimerRef = useRef(null);

  const applyUpdate = useCallback((newBoard) => {
    const prev = prevBoardRef.current;
    if (prev && prev.length > 0) {
      const prevPtsById = Object.fromEntries(prev.map(r => [r.id, Number(r.total_points)]));
      const changed = new Set();

      for (const row of newBoard) {
        if (prevPtsById[row.id] !== undefined && prevPtsById[row.id] !== Number(row.total_points)) {
          changed.add(row.id);
        }
      }

      if (changed.size > 0) {
        clearTimeout(flashTimerRef.current);
        setFlashIds(changed);
        flashTimerRef.current = setTimeout(() => setFlashIds(new Set()), 2000);
      }
    }

    prevBoardRef.current = newBoard;
    setBoard(newBoard);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    api.getLeaderboard()
      .then(applyUpdate)
      .catch(console.error)
      .finally(() => setLoading(false));

    const t = setInterval(() => {
      api.getLeaderboard().then(applyUpdate).catch(() => {});
    }, 60_000);

    return () => {
      clearInterval(t);
      clearTimeout(flashTimerRef.current);
    };
  }, [applyUpdate]);

  const handleSort = (col) => {
    setSort(prev => {
      if (prev.key !== col) return { key: col, dir: 'desc' };
      if (prev.dir === 'desc') return { key: col, dir: 'asc' };
      return { key: null, dir: null };
    });
  };

  const filtered = board.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  const sorted = sort.key
    ? [...filtered].sort((a, b) => {
        const av = Number(a[sort.key] ?? 0);
        const bv = Number(b[sort.key] ?? 0);
        return sort.dir === 'desc' ? bv - av : av - bv;
      })
    : filtered;

  const toggle = (id) => setExpanded(prev => prev === id ? null : id);

  const toggleSelect = (name, e) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) { next.delete(name); return next; }
      if (next.size >= 2) return prev;
      next.add(name);
      return next;
    });
  };

  const handleCompare = () => {
    const [a, b] = [...selected];
    navigate(`/leaderboard/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
  };

  const colSort = (col) => sort.key === col ? sort.dir : null;

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>;
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Leaderboard</h1>
          <p className="text-gray-400 text-sm">
            {board.length} players
            {lastUpdated && (
              <span className="text-gray-600"> · Updated at {formatTime(lastUpdated)}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {selected.size === 2 && (
            <button
              onClick={handleCompare}
              className="inline-flex items-center px-3 py-2 rounded-lg bg-brand-gold text-black text-sm font-bold hover:bg-brand-gold/80 transition-colors whitespace-nowrap"
            >
              Compare {[...selected].join(' vs ')} →
            </button>
          )}
          {selected.size === 1 && (
            <span className="text-xs text-gray-400 whitespace-nowrap">Pick one more to compare</span>
          )}
          <input
            type="text"
            placeholder="Search player…"
            className="bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-sm
                       focus:border-brand-gold focus:outline-none w-full sm:w-48 transition-colors"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Full table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-3 py-3 w-8" />
              <th className="px-4 py-3 text-left w-12">#</th>
              <th className="px-4 py-3 text-left">Player</th>
              <th className="px-4 py-3 text-center text-xs">Paid</th>
              <SortableCell col="pts_5" sort={sort} onSort={handleSort}>
                <span className="tag pts-exact px-2">+5</span>
              </SortableCell>
              <SortableCell col="pts_3" sort={sort} onSort={handleSort}>
                <span className="tag pts-correct px-2">+3</span>
              </SortableCell>
              <SortableCell col="pts_1" sort={sort} onSort={handleSort}>
                <span className="tag bg-amber-800/30 text-amber-500 border border-amber-700/30 px-2">+1</span>
              </SortableCell>
              <SortableCell col="pts_0" sort={sort} onSort={handleSort}>
                <span className="tag pts-zero px-2">0</span>
              </SortableCell>
              <th
                className="px-4 py-3 text-right font-bold text-brand-gold cursor-pointer select-none hover:opacity-80 transition-opacity"
                onClick={() => handleSort('total_points')}
              >
                <div className="flex items-center justify-end gap-1">
                  Points
                  <span className="w-3 text-gray-600 text-xs leading-none ml-1">
                    {colSort('total_points') === 'desc' ? '▾' : colSort('total_points') === 'asc' ? '▴' : '·'}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-500">
                  {search ? 'No player found.' : 'No predictions submitted yet. Be the first!'}
                </td>
              </tr>
            ) : (
              sorted.map((row, idx) => (
                <React.Fragment key={row.id}>
                  <tr
                    onClick={() => toggle(row.id)}
                    className={`border-b border-brand-border/50 cursor-pointer transition-colors duration-700 hover:bg-white/5 ${
                      flashIds.has(row.id)    ? 'bg-emerald-900/25' :
                      expanded === row.id     ? 'bg-white/5 border-brand-border' :
                      selected.has(row.name)  ? 'bg-brand-gold/5' :
                      idx < 3 && !search      ? 'bg-brand-gold/3' : ''
                    }`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.name)}
                        onChange={e => toggleSelect(row.name, e)}
                        onClick={e => e.stopPropagation()}
                        disabled={!selected.has(row.name) && selected.size >= 2}
                        className="w-4 h-4 rounded accent-brand-gold cursor-pointer disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <RankBadge rank={row.rank} />
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      <span className="flex items-center gap-1.5">
                        {row.name}
                        <span className={`text-gray-600 text-xs transition-transform inline-block ${expanded === row.id ? 'rotate-180' : ''}`}>▾</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.paid
                        ? <span className="text-xs font-bold text-emerald-400">✓</span>
                        : <span className="text-xs font-bold text-red-400/60">✗</span>
                      }
                    </td>
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
                </React.Fragment>
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
