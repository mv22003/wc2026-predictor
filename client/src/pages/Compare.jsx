import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, Link, useNavigate, Navigate } from 'react-router-dom';
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
      {/* A: badge on outer-left, score on inner-right */}
      <div className={`flex items-center justify-end gap-3 px-2 sm:px-4 py-2.5 ${tintA}`}>
        {isFinished && predA && <PtsBadge pts={ptsA} />}
        <span className="font-mono text-xs sm:text-sm text-gray-200 tabular-nums">{predStrA}</span>
      </div>

      {/* Centre: [code] flag [result] flag [code] */}
      <div className="flex items-center justify-center px-1 py-2.5 border-x border-brand-border/30">
        <div className="flex items-center gap-1 sm:gap-1.5 text-sm font-semibold">
          <span className="hidden sm:inline text-gray-400 text-xs w-7 text-right">{src.home_code}</span>
          <Flag code={src.home_code} name={src.home_team} className="w-5 sm:w-6 h-5 sm:h-6 shrink-0" />
          <span className="w-10 sm:w-12 text-center shrink-0 text-xs sm:text-sm">
            {isFinished && src.home_score != null
              ? <span className="text-white font-bold tabular-nums">{src.home_score}–{src.away_score}</span>
              : <span className="text-gray-500 font-semibold">vs</span>
            }
          </span>
          <Flag code={src.away_code} name={src.away_team} className="w-5 sm:w-6 h-5 sm:h-6 shrink-0" />
          <span className="hidden sm:inline text-gray-400 text-xs w-7 text-left">{src.away_code}</span>
        </div>
      </div>

      {/* B: score on inner-left, badge on outer-right */}
      <div className={`flex items-center justify-start gap-3 px-2 sm:px-4 py-2.5 ${tintB}`}>
        <span className="font-mono text-xs sm:text-sm text-gray-200 tabular-nums">{predStrB}</span>
        {isFinished && predB && <PtsBadge pts={ptsB} />}
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

function ScoringModal({ onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        className="relative w-full mx-4 max-w-sm bg-brand-card border border-brand-border rounded-2xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-black text-base">How scoring works</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          {[
            { cls: 'pts-exact', label: '+5 pts', desc: 'Exact scoreline' },
            { cls: 'pts-correct', label: '+3 pts', desc: 'Correct result + goal difference' },
            { cls: 'bg-amber-800/30 text-amber-500 border border-amber-700/30', label: '+1 pt', desc: 'Correct result (W/D/L) only' },
            { cls: 'pts-zero', label: '0 pts', desc: 'Wrong prediction' },
          ].map(({ cls, label, desc }) => (
            <div key={label} className="flex items-center gap-3">
              <span className={`tag font-bold shrink-0 w-16 text-center whitespace-nowrap ${cls}`}>{label}</span>
              <span className="text-sm text-gray-300">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

function PlayerCard({ name, stats, onInfoClick }) {
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
          <button className="sm:cursor-default w-full" onClick={onInfoClick}>
            <span className="tag pts-exact block w-full">{stats.exact}</span>
          </button>
          <span className="hidden sm:block text-[10px] text-gray-600 mt-0.5">Exact</span>
        </div>
        <div>
          <button className="sm:cursor-default w-full" onClick={onInfoClick}>
            <span className="tag pts-correct block w-full">{stats.correct}</span>
          </button>
          <span className="hidden sm:block text-[10px] text-gray-600 mt-0.5">Result+GD</span>
        </div>
        <div>
          <button className="sm:cursor-default w-full" onClick={onInfoClick}>
            <span className="tag bg-amber-800/30 text-amber-500 border border-amber-700/30 block w-full">{stats.partial}</span>
          </button>
          <span className="hidden sm:block text-[10px] text-gray-600 mt-0.5">Result</span>
        </div>
        <div>
          <button className="sm:cursor-default w-full" onClick={onInfoClick}>
            <span className="tag pts-zero block w-full">{stats.wrong}</span>
          </button>
          <span className="hidden sm:block text-[10px] text-gray-600 mt-0.5">Wrong</span>
        </div>
      </div>
    </div>
  );
}

function StatsHeader({ nameA, statsA, nameB, statsB }) {
  const [showScoring, setShowScoring] = useState(false);
  return (
    <>
      {showScoring && <ScoringModal onClose={() => setShowScoring(false)} />}
      <div className="grid grid-cols-2 gap-4 items-stretch">
        <PlayerCard name={nameA} stats={statsA} onInfoClick={() => setShowScoring(true)} />
        <PlayerCard name={nameB} stats={statsB} onInfoClick={() => setShowScoring(true)} />
      </div>
    </>
  );
}

export default function Compare() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const a = searchParams.get('a') ?? '';
  const b = searchParams.get('b') ?? '';

  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState(null);

  if (!a || !b) return <Navigate to="/leaderboard" replace />;

  useEffect(() => {
    setComparing(true);
    setError(null);
    setDataA(null);
    setDataB(null);
    Promise.all([api.getUser(a), api.getUser(b)])
      .then(([resA, resB]) => {
        if (!resA.exists) { setError(`Player "${a}" not found.`); return; }
        if (!resB.exists) { setError(`Player "${b}" not found.`); return; }
        setDataA(resA);
        setDataB(resB);
      })
      .catch(e => setError(e.message ?? 'Failed to load data.'))
      .finally(() => setComparing(false));
  }, [a, b]);

  const predsA = dataA?.predictions ?? [];
  const predsB = dataB?.predictions ?? [];

  const statsA = computeStats(predsA);
  const statsB = computeStats(predsB);

  const groupsA = groupByGroup(predsA);
  const groupsB = groupByGroup(predsB);
  const allGroups = [...new Set([...Object.keys(groupsA), ...Object.keys(groupsB)])].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black">H2H Comparison</h1>
          <p className="text-sm text-gray-400 mt-0.5">Head-to-head prediction breakdown</p>
        </div>
        {/* Desktop: full button */}
        <button
          className="hidden sm:block btn-primary text-sm shrink-0"
          onClick={() => navigate('/leaderboard')}
        >
          Back to Leaderboard
        </button>
        {/* Mobile: icon-only back button */}
        <button
          className="sm:hidden btn-secondary flex items-center gap-1.5"
          onClick={() => navigate('/leaderboard')}
          aria-label="Back to Leaderboard"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {comparing && (
        <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
      )}

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30">
          {error}
        </div>
      )}

      {!comparing && dataA && dataB && (
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
    </div>
  );
}
