import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import Flag from '../components/Flag';

function PtsBadge({ pts }) {
  const base = 'tag font-bold text-center w-8 shrink-0';
  if (pts === 5) return <span className={`${base} pts-exact`}>+5</span>;
  if (pts === 3) return <span className={`${base} pts-correct`}>+3</span>;
  if (pts === 1) return <span className={`${base} bg-amber-800/30 text-amber-500 border border-amber-700/30`}>+1</span>;
  return <span className={`${base} pts-zero`}>0</span>;
}

function computeStats(predictions) {
  const finished = predictions.filter(p => p.status === 'finished');
  return {
    pts: finished.reduce((s, p) => s + (p.points ?? 0), 0),
    exact: finished.filter(p => p.points === 5).length,
    correct: finished.filter(p => p.points === 3).length,
    partial: finished.filter(p => p.points === 1).length,
    wrong: finished.filter(p => p.points === 0).length,
  };
}

function computeMatchRecord(predsA, predsB) {
  const mapB = Object.fromEntries(predsB.map(p => [p.match_id, p]));
  let winsA = 0, draws = 0, winsB = 0;
  for (const pA of predsA) {
    if (pA.status !== 'finished') continue;
    const pB = mapB[pA.match_id];
    if (!pB) continue;
    const ptA = pA.points ?? 0;
    const ptB = pB.points ?? 0;
    if (ptA > ptB) winsA++;
    else if (ptB > ptA) winsB++;
    else draws++;
  }
  return { winsA, draws, winsB };
}

function groupByGroup(predictions) {
  const groups = {};
  for (const p of predictions) {
    const g = p.group_name ?? 'Other';
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  }
  return groups;
}

function cellTint(ptsA, ptsB, side) {
  if (ptsA === 0 && ptsB === 0) return '';
  if (ptsA === ptsB && ptsA > 0) return 'bg-blue-900/10';
  if (side === 'a' && ptsA > ptsB) return 'bg-emerald-900/20';
  if (side === 'b' && ptsB > ptsA) return 'bg-emerald-900/20';
  return '';
}

function MatchRow({ predA, predB }) {
  const isFinished = predA?.status === 'finished' || predB?.status === 'finished';
  const isUpcoming = predA?.status === 'upcoming' || predB?.status === 'upcoming';

  const src = predA ?? predB;
  if (!src) return null;

  const ptsA = predA?.points ?? 0;
  const ptsB = predB?.points ?? 0;

  const predStrA = predA && predA.pred_home != null && predA.pred_away != null
    ? `${predA.pred_home} – ${predA.pred_away}`
    : '—';
  const predStrB = predB && predB.pred_home != null && predB.pred_away != null
    ? `${predB.pred_home} – ${predB.pred_away}`
    : '—';

  const tintA = isFinished ? cellTint(ptsA, ptsB, 'a') : '';
  const tintB = isFinished ? cellTint(ptsA, ptsB, 'b') : '';

  return (
    <div className="grid grid-cols-3 items-stretch border-b border-brand-border/30 last:border-b-0">
      {/* A: score + badge right-aligned as a unit */}
      <div className={`flex items-center justify-end gap-2 px-4 py-2.5 ${tintA}`}>
        <span className="font-mono text-sm text-gray-200">{predStrA}</span>
        {isFinished && predA && <PtsBadge pts={ptsA} />}
      </div>

      {/* Centre: fixed-width score/vs so flags never shift between rows */}
      <div className="flex items-center justify-center px-2 py-2.5 border-x border-brand-border/30">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Flag code={src.home_code} name={src.home_team} className="w-6 h-6" />
          <span className="text-gray-300">{src.home_code}</span>
          <span className="w-12 text-center">
            {isFinished && src.home_score != null
              ? <span className="text-white font-bold tabular-nums">{src.home_score} – {src.away_score}</span>
              : <span className="text-gray-500 font-semibold">vs</span>
            }
          </span>
          <span className="text-gray-300">{src.away_code}</span>
          <Flag code={src.away_code} name={src.away_team} className="w-6 h-6" />
        </div>
      </div>

      {/* B: badge + score left-aligned as a unit */}
      <div className={`flex items-center justify-start gap-2 px-4 py-2.5 ${tintB}`}>
        {isFinished && predB && <PtsBadge pts={ptsB} />}
        <span className="font-mono text-sm text-gray-200">{predStrB}</span>
      </div>
    </div>
  );
}

function GroupCard({ groupName, predsA, predsB }) {
  const mapA = Object.fromEntries(predsA.map(p => [p.match_id, p]));
  const mapB = Object.fromEntries(predsB.map(p => [p.match_id, p]));

  const allMatchIds = [];
  const seen = new Set();
  for (const p of [...predsA, ...predsB]) {
    if (!seen.has(p.match_id)) {
      seen.add(p.match_id);
      allMatchIds.push(p.match_id);
    }
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-2 border-b border-brand-border bg-brand-navy/60">
        <span className="font-black text-sm">Group {groupName}</span>
      </div>
      {allMatchIds.map(mid => (
        <MatchRow key={mid} predA={mapA[mid] ?? null} predB={mapB[mid] ?? null} />
      ))}
    </div>
  );
}

function PlayerCard({ name, stats }) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-black text-lg truncate">{name}</p>
        <div className="shrink-0 text-right">
          <span className="text-brand-gold font-black text-3xl">{stats.pts}</span>
          <span className="text-gray-500 text-xs ml-1">pts</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1 text-center">
        <div>
          <span className="tag pts-exact block w-full">{stats.exact}</span>
          <span className="text-[10px] text-gray-600 mt-0.5 block">Exact</span>
        </div>
        <div>
          <span className="tag pts-correct block w-full">{stats.correct}</span>
          <span className="text-[10px] text-gray-600 mt-0.5 block">Result+GD</span>
        </div>
        <div>
          <span className="tag bg-amber-800/30 text-amber-500 border border-amber-700/30 block w-full">{stats.partial}</span>
          <span className="text-[10px] text-gray-600 mt-0.5 block">Result</span>
        </div>
        <div>
          <span className="tag pts-zero block w-full">{stats.wrong}</span>
          <span className="text-[10px] text-gray-600 mt-0.5 block">Wrong</span>
        </div>
      </div>
    </div>
  );
}

function StatsHeader({ nameA, statsA, nameB, statsB }) {
  return (
    <div className="grid grid-cols-2 gap-4 items-stretch">
      <PlayerCard name={nameA} stats={statsA} />
      <PlayerCard name={nameB} stats={statsB} />
    </div>
  );
}

export default function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(true);

  const [selA, setSelA] = useState(searchParams.get('a') ?? '');
  const [selB, setSelB] = useState(searchParams.get('b') ?? '');

  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState(null);
  const [compared, setCompared] = useState(false);

  useEffect(() => {
    api.getLeaderboard()
      .then(board => setPlayers(board.map(r => r.name)))
      .catch(() => setPlayers([]))
      .finally(() => setPlayersLoading(false));
  }, []);

  const runCompare = useCallback(async (a, b) => {
    if (!a || !b) return;
    setComparing(true);
    setError(null);
    setDataA(null);
    setDataB(null);
    setCompared(false);
    try {
      const [resA, resB] = await Promise.all([api.getUser(a), api.getUser(b)]);
      if (!resA.exists) { setError(`Player "${a}" not found.`); return; }
      if (!resB.exists) { setError(`Player "${b}" not found.`); return; }
      setDataA(resA);
      setDataB(resB);
      setCompared(true);
    } catch (e) {
      setError(e.message ?? 'Failed to load data.');
    } finally {
      setComparing(false);
    }
  }, []);

  useEffect(() => {
    const a = searchParams.get('a') ?? '';
    const b = searchParams.get('b') ?? '';
    if (a && b) {
      setSelA(a);
      setSelB(b);
      runCompare(a, b);
    }
  }, []);

  function handleCompare() {
    if (!selA || !selB) return;
    setSearchParams({ a: selA, b: selB });
    runCompare(selA, selB);
  }

  const predsA = dataA?.predictions ?? [];
  const predsB = dataB?.predictions ?? [];

  const statsA = computeStats(predsA);
  const statsB = computeStats(predsB);
  const record = computeMatchRecord(predsA, predsB);

  const groupsA = groupByGroup(predsA);
  const groupsB = groupByGroup(predsB);
  const allGroups = [...new Set([...Object.keys(groupsA), ...Object.keys(groupsB)])].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/leaderboard" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">← Leaderboard</Link>
          <h1 className="text-2xl font-black mt-1">H2H Prediction Comparison</h1>
        </div>
        {compared && dataA && dataB && (
          <button
            className="btn-primary text-sm shrink-0"
            onClick={() => { setCompared(false); setDataA(null); setDataB(null); setSelA(''); setSelB(''); setSearchParams({}); }}
          >
            New comparison
          </button>
        )}
      </div>

      {!compared && (
        <div className="card flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-36 space-y-1">
            <label className="text-xs text-gray-500 uppercase tracking-wider">Player A</label>
            <select
              className="w-full bg-brand-navy border border-brand-border rounded-lg px-3 py-2 text-sm
                         focus:border-brand-gold focus:outline-none transition-colors"
              value={selA}
              onChange={e => setSelA(e.target.value)}
              disabled={playersLoading}
            >
              <option value="">Select player…</option>
              {players.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="shrink-0 text-gray-600 font-bold pb-2">vs</div>

          <div className="flex-1 min-w-36 space-y-1">
            <label className="text-xs text-gray-500 uppercase tracking-wider">Player B</label>
            <select
              className="w-full bg-brand-navy border border-brand-border rounded-lg px-3 py-2 text-sm
                         focus:border-brand-gold focus:outline-none transition-colors"
              value={selB}
              onChange={e => setSelB(e.target.value)}
              disabled={playersLoading}
            >
              <option value="">Select player…</option>
              {players.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button
            className="btn-primary shrink-0"
            disabled={!selA || !selB || selA === selB || comparing}
            onClick={handleCompare}
          >
            {comparing ? 'Loading…' : 'Compare →'}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30">
          {error}
        </div>
      )}

      {compared && dataA && dataB && (
        <>
          <StatsHeader
            nameA={dataA.user.name}
            statsA={statsA}
            nameB={dataB.user.name}
            statsB={statsB}
          />

          <div className="space-y-4">
            {allGroups.map(g => (
              <GroupCard
                key={g}
                groupName={g}
                predsA={groupsA[g] ?? []}
                predsB={groupsB[g] ?? []}
              />
            ))}
          </div>
        </>
      )}

      {!compared && !comparing && !error && (
        <div className="card text-center py-12 text-gray-500">
          <p className="font-semibold">Select two players and click Compare</p>
        </div>
      )}
    </div>
  );
}
