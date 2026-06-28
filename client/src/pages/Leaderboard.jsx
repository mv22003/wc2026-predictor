import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Flag from '../components/Flag';
import { R32_SLOTS, calcStandings, resolveTeam, resolveBest3rdSlots } from '../bracketUtils';

function ordinal(n) {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

function RankBadge({ rank, hasResults }) {
  if (!hasResults) return <span className="text-gray-400 font-bold text-sm w-8 text-center">—</span>;
  if (rank === 1) return <span className="text-brand-gold font-black text-sm w-8 text-center">1st</span>;
  if (rank === 2) return <span className="text-gray-300 font-black text-sm w-8 text-center">2nd</span>;
  if (rank === 3) return <span className="text-amber-600 font-black text-sm w-8 text-center">3rd</span>;
  return <span className="text-gray-400 font-bold text-sm w-8 text-center">{ordinal(rank)}</span>;
}

function PtsBadge({ pts, pending }) {
  const base = 'tag font-bold text-center w-8 shrink-0';
  if (pending) return <span className={`${base} bg-brand-border text-gray-400`}>–</span>;
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
        <span className="w-3 shrink-0 inline-flex justify-center text-gray-400 text-xs leading-none ml-1">
          {state === 'desc' ? '▾' : state === 'asc' ? '▴' : '·'}
        </span>
      </div>
    </th>
  );
}

// ── Bracket layout constants (compact — no scores, flags+code only) ───────────
const B_CW = 76, B_CH = 36, B_GAP = 24, B_COL = B_CW + B_GAP, B_SH = 50, B_H = 8 * B_SH;
const B_L_R32 = 0;
const B_L_R16 = B_L_R32 + B_COL;
const B_L_QF  = B_L_R16 + B_COL;
const B_L_SF  = B_L_QF  + B_COL;
const B_MG    = 30;
const B_FINAL = B_L_SF  + B_CW + B_MG;
const B_R_SF  = B_FINAL + B_CW + B_MG;
const B_R_QF  = B_R_SF  + B_COL;
const B_R_R16 = B_R_QF  + B_COL;
const B_R_R32 = B_R_R16 + B_COL;
const B_TW    = B_R_R32 + B_CW;

const B_yc = {
  r32: i => (i + 0.5) * B_SH,
  r16: i => (2 * i + 1) * B_SH,
  qf:  i => (4 * i + 2) * B_SH,
  sf:  ()  => B_H / 2,
};

const B_LEFT  = { r32: [74,77,73,75,83,84,81,82], r16: [89,90,93,94], qf: [97,98], sf: [101] };
const B_RIGHT = { r32: [76,78,79,80,86,88,85,87], r16: [91,92,95,96], qf: [99,100], sf: [102] };

const B_LABELS = [
  { label: 'R32', x: B_L_R32 }, { label: 'R16', x: B_L_R16 },
  { label: 'QF',  x: B_L_QF  }, { label: 'SF',  x: B_L_SF  },
  { label: 'FINAL', x: B_FINAL },
  { label: 'SF',  x: B_R_SF  }, { label: 'QF',  x: B_R_QF  },
  { label: 'R16', x: B_R_R16 }, { label: 'R32', x: B_R_R32 },
];

function BCardPred({ matchNum, projMap, flip = false }) {
  const home = projMap?.[matchNum]?.home ?? null;
  const away = projMap?.[matchNum]?.away ?? null;
  const rh   = B_CH / 2;

  function TeamRow({ team }) {
    const code = team ? (team.code || team.name?.slice(0, 3).toUpperCase()) : null;
    return (
      <div className={`flex items-center gap-1 px-1.5 ${flip ? 'flex-row-reverse' : ''}`}
           style={{ height: rh }}>
        {team ? (
          <>
            <Flag code={team.code} name={team.name} className="w-3 h-3 shrink-0" />
            <span className={`text-[10px] font-bold shrink-0 leading-none uppercase ${flip ? 'text-right' : ''} text-gray-300`}>
              {code}
            </span>
          </>
        ) : (
          <>
            <span className="w-3 h-3 rounded-sm bg-brand-border/20 shrink-0" />
            <span className={`text-[9px] text-gray-600 w-[22px] leading-none ${flip ? 'text-right' : ''}`}>TBD</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-brand-border/40 bg-brand-navy/60"
         style={{ width: B_CW, height: B_CH }}>
      <TeamRow team={home} />
      <div className="border-t border-brand-border/30" />
      <TeamRow team={away} />
    </div>
  );
}

function BracketLinesPred() {
  const segs = [];
  const L = (x1, y1, x2, y2) => segs.push([x1, y1, x2, y2]);

  function connectL(xOut, xIn, ysOut, ysIn) {
    const sx = xOut + B_CW + B_GAP / 2;
    for (let i = 0; i < ysIn.length; i++) {
      const yT = ysOut[2*i], yB = ysOut[2*i+1], yM = ysIn[i];
      L(xOut+B_CW, yT, sx, yT); L(xOut+B_CW, yB, sx, yB);
      L(sx, yT, sx, yB); L(sx, yM, xIn, yM);
    }
  }

  function connectR(xOut, xIn, ysOut, ysIn) {
    const sx = xOut - B_GAP / 2;
    for (let i = 0; i < ysIn.length; i++) {
      const yT = ysOut[2*i], yB = ysOut[2*i+1], yM = ysIn[i];
      L(xOut, yT, sx, yT); L(xOut, yB, sx, yB);
      L(sx, yT, sx, yB); L(sx, yM, xIn+B_CW, yM);
    }
  }

  const ysr32 = Array.from({ length: 8 }, (_, i) => B_yc.r32(i));
  const ysr16 = Array.from({ length: 4 }, (_, i) => B_yc.r16(i));
  const ysqf  = Array.from({ length: 2 }, (_, i) => B_yc.qf(i));
  const yssf  = [B_yc.sf()];

  connectL(B_L_R32, B_L_R16, ysr32, ysr16);
  connectL(B_L_R16, B_L_QF,  ysr16, ysqf);
  connectL(B_L_QF,  B_L_SF,  ysqf,  yssf);
  L(B_L_SF+B_CW, B_yc.sf(), B_FINAL, B_yc.sf());

  connectR(B_R_R32, B_R_R16, ysr32, ysr16);
  connectR(B_R_R16, B_R_QF,  ysr16, ysqf);
  connectR(B_R_QF,  B_R_SF,  ysqf,  yssf);
  L(B_FINAL+B_CW, B_yc.sf(), B_R_SF, B_yc.sf());

  return (
    <svg width={B_TW} height={B_H} className="absolute inset-0 pointer-events-none">
      {segs.map(([x1,y1,x2,y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#374151" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

function MobileBracketPair({ topNum, bottomNum, projMap, flip = false }) {
  const cardH = B_CH;
  const pairGap = 4;
  const totalH = cardH * 2 + pairGap;
  const connW = 14;

  const cardStack = (
    <div className="flex flex-col shrink-0" style={{ gap: pairGap }}>
      <BCardPred matchNum={topNum} projMap={projMap} flip={flip} />
      <BCardPred matchNum={bottomNum} projMap={projMap} flip={flip} />
    </div>
  );

  const r16Label = (
    <span className="text-[8px] font-bold text-gray-600 uppercase leading-none shrink-0"
          style={{ marginTop: totalH / 2 - 4 }}>R16</span>
  );

  if (flip) {
    // Right column: R16 ─┤ [Cards]
    return (
      <div className="flex items-start">
        {r16Label}
        <svg width={connW} height={totalH} className="shrink-0">
          <line x1={connW} y1={cardH / 2}          x2={2} y2={cardH / 2}          stroke="#374151" strokeWidth={1.5} />
          <line x1={connW} y1={totalH - cardH / 2} x2={2} y2={totalH - cardH / 2} stroke="#374151" strokeWidth={1.5} />
          <line x1={2}     y1={cardH / 2}           x2={2} y2={totalH - cardH / 2} stroke="#374151" strokeWidth={1.5} />
          <line x1={2}     y1={totalH / 2}          x2={0} y2={totalH / 2}         stroke="#374151" strokeWidth={1.5} />
        </svg>
        {cardStack}
      </div>
    );
  }

  // Left column: [Cards] ─┤ R16
  return (
    <div className="flex items-start">
      {cardStack}
      <svg width={connW} height={totalH} className="shrink-0">
        <line x1={0} y1={cardH / 2}           x2={connW - 2} y2={cardH / 2}           stroke="#374151" strokeWidth={1.5} />
        <line x1={0} y1={totalH - cardH / 2}  x2={connW - 2} y2={totalH - cardH / 2}  stroke="#374151" strokeWidth={1.5} />
        <line x1={connW - 2} y1={cardH / 2}   x2={connW - 2} y2={totalH - cardH / 2}  stroke="#374151" strokeWidth={1.5} />
        <line x1={connW - 2} y1={totalH / 2}  x2={connW}     y2={totalH / 2}           stroke="#374151" strokeWidth={1.5} />
      </svg>
      {r16Label}
    </div>
  );
}

function PredBracketView({ predictions }) {
  const groupPreds = predictions.filter(p => p.phase === 'group');

  if (groupPreds.length === 0) {
    return <div className="px-4 py-3 text-xs text-gray-400">No group predictions to build bracket from.</div>;
  }

  const synthMatches = groupPreds.map(p => ({
    phase: 'group', group_name: p.group_name, status: 'finished',
    home_score: p.pred_home, away_score: p.pred_away,
    home_team: p.home_team, home_code: p.home_code,
    away_team: p.away_team, away_code: p.away_code,
  }));

  const groups = [...new Set(synthMatches.map(m => m.group_name).filter(Boolean))].sort();
  const byGroup = {};
  for (const g of groups) byGroup[g] = calcStandings(synthMatches.filter(m => m.group_name === g));

  const dbByNum    = {};
  const best3rdMap = resolveBest3rdSlots(byGroup) || {};
  const projMap    = {};

  for (const num of Object.keys(R32_SLOTS).map(Number).sort()) {
    const slots = R32_SLOTS[num];
    projMap[num] = {};
    for (const side of ['home', 'away']) {
      const slot = slots[side];
      projMap[num][side] = slot.type === 'group'
        ? resolveTeam(slot, byGroup, dbByNum)
        : best3rdMap[num]?.[side] ?? null;
    }
  }

  const cards = [];
  function addRound(matchNums, xCol, ycFn, flip = false) {
    matchNums.forEach((num, i) => cards.push({ num, x: xCol, y: ycFn(i) - B_CH / 2, flip }));
  }

  addRound(B_LEFT.r32,  B_L_R32, B_yc.r32, true);
  addRound(B_LEFT.r16,  B_L_R16, B_yc.r16, true);
  addRound(B_LEFT.qf,   B_L_QF,  B_yc.qf,  true);
  addRound(B_LEFT.sf,   B_L_SF,  B_yc.sf,  true);
  cards.push({ num: 104, x: B_FINAL, y: B_yc.sf() - B_CH / 2, flip: false });
  addRound(B_RIGHT.sf,  B_R_SF,  B_yc.sf);
  addRound(B_RIGHT.qf,  B_R_QF,  B_yc.qf);
  addRound(B_RIGHT.r16, B_R_R16, B_yc.r16);
  addRound(B_RIGHT.r32, B_R_R32, B_yc.r32);

  return (
    <div className="overflow-y-auto max-h-[28rem] sm:max-h-none scrollbar-thin px-4 py-3">
      <p className="text-xs text-gray-500 italic mb-3">R32 projected from your group predictions</p>

      {/* Mobile: paired R32 matchups with bracket connector lines */}
      <div className="sm:hidden relative flex justify-between">
        <img
          src="/wc-logos/world-cup-trophy.png"
          alt="World Cup Trophy"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 72,
            height: 'auto',
            opacity: 0.85,
            pointerEvents: 'none',
          }}
        />
        <div className="flex flex-col gap-4">
          {[0, 2, 4, 6].map(i => (
            <MobileBracketPair key={i} topNum={B_LEFT.r32[i]} bottomNum={B_LEFT.r32[i + 1]} projMap={projMap} />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {[0, 2, 4, 6].map(i => (
            <MobileBracketPair key={i} topNum={B_RIGHT.r32[i]} bottomNum={B_RIGHT.r32[i + 1]} projMap={projMap} flip />
          ))}
        </div>
      </div>

      {/* Desktop: full symmetric bracket */}
      <div className="hidden sm:block overflow-x-auto w-full">
        <div style={{ width: B_TW, minWidth: B_TW }} className="mx-auto">
          <div className="relative mb-2" style={{ height: 18 }}>
            {B_LABELS.map(({ label, x }, i) => (
              <span key={i}
                className="absolute text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center"
                style={{ left: x, width: B_CW }}>
                {label}
              </span>
            ))}
          </div>
          <div className="relative" style={{ width: B_TW, height: B_H }}>
            <BracketLinesPred />
            {cards.map(({ num, x, y, flip }) => (
              <div key={num} style={{ position: 'absolute', left: x, top: y }}>
                <BCardPred matchNum={num} projMap={projMap} flip={flip} />
              </div>
            ))}
            <img
              src="/wc-logos/world-cup-trophy.png"
              alt="World Cup Trophy"
              style={{
                position: 'absolute',
                left: B_FINAL + B_CW / 2,
                top: B_yc.sf() + B_CH / 2 + 20,
                transform: 'translateX(-50%)',
                width: 90,
                height: 'auto',
                opacity: 0.9,
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PredictionExpanded({ name, cache, setCache }) {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('list');

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
        <td colSpan={9} className="px-6 py-3 text-xs text-gray-400">Loading…</td>
      </tr>
    );
  }

  const predictions = cache[name] ?? [];

  const rowTint = (pts, status) => {
    if (status !== 'finished') return 'border-b border-brand-border/30 last:border-b-0';
    if (pts === 5) return 'bg-emerald-900/20 border-l-2 border-l-emerald-400 border-b border-b-brand-border/30 last:border-b-0';
    if (pts === 3) return 'bg-blue-900/10 border-l-2 border-l-blue-500 border-b border-b-brand-border/30 last:border-b-0';
    if (pts === 1) return 'bg-amber-900/15 border-l-2 border-l-amber-500 border-b border-b-brand-border/30 last:border-b-0';
    return 'bg-red-900/10 border-l-2 border-l-red-600 border-b border-b-brand-border/30 last:border-b-0';
  };

  const finished = predictions.filter(p => p.status === 'finished').sort((a, b) => b.points - a.points);
  const pending  = predictions.filter(p => p.status !== 'finished').sort((a, b) => new Date(a.match_date) - new Date(b.match_date));
  const byScore  = [...finished, ...pending];
  const byTime   = [...predictions].sort((a, b) => new Date(a.match_date) - new Date(b.match_date));

  const displayList = view === 'time' ? byTime : byScore;

  return (
    <tr className="bg-brand-surface/50">
      <td colSpan={9} className="p-0">
        {/* View toggle */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 border-b border-brand-border/30">
          <button
            onClick={() => setView('list')}
            className={`text-xs font-semibold px-3 py-1 rounded transition-colors ${
              view === 'list'
                ? 'bg-brand-gold/20 text-brand-gold border border-brand-gold/40'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }`}
          >
            Predictions
          </button>
          <button
            onClick={() => setView('time')}
            className={`text-xs font-semibold px-3 py-1 rounded transition-colors ${
              view === 'time'
                ? 'bg-brand-gold/20 text-brand-gold border border-brand-gold/40'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }`}
          >
            By time
          </button>
        </div>

        {displayList.length === 0 ? (
          <div className="px-6 py-3 text-xs text-gray-400">No predictions yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 overflow-y-auto max-h-[28rem] sm:max-h-96 scrollbar-thin divide-y divide-brand-border/30 sm:divide-y-0">
            {displayList.map(p => (
              <div key={p.id} className={`flex items-center gap-2 px-4 py-2 text-xs ${rowTint(p.points, p.status)}`}>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Flag code={p.home_code} name={p.home_team} className="w-4 h-4 shrink-0" />
                  <span className="font-semibold text-gray-300">{p.home_code}</span>
                  <span className="text-gray-400">vs</span>
                  <span className="font-semibold text-gray-300">{p.away_code}</span>
                  <Flag code={p.away_code} name={p.away_team} className="w-4 h-4 shrink-0" />
                </div>
                <span className="font-mono text-gray-400 w-8 text-right tabular-nums shrink-0">{p.pred_home}–{p.pred_away}</span>
                <span className="text-gray-400 w-3 text-center shrink-0">→</span>
                {p.status === 'finished'
                  ? <span className={`font-mono font-bold w-8 tabular-nums shrink-0 ${p.points > 0 ? 'text-white' : 'text-gray-400'}`}>{p.home_score}–{p.away_score}</span>
                  : <span className="text-gray-400 italic w-8 shrink-0">pend.</span>
                }
                <PtsBadge pts={p.points} pending={p.status !== 'finished'} />
              </div>
            ))}
          </div>
        )}
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
  const [compareMode, setCompareMode] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [flashIds, setFlashIds] = useState(new Set());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [lastMatch, setLastMatch] = useState(null);
  const [lastMatchIsLive, setLastMatchIsLive] = useState(false);
  const [lastMatch2, setLastMatch2] = useState(null);
  const [nextMatch, setNextMatch] = useState(null);
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

    if (newBoard.length > 0 && newBoard[0].last_match_home_code) {
      setLastMatch({
        homeCode: newBoard[0].last_match_home_code,
        home: newBoard[0].last_match_home,
        awayCode: newBoard[0].last_match_away_code,
        away: newBoard[0].last_match_away,
      });
      setLastMatchIsLive(!!newBoard[0].last_match_is_live);
      setLastMatch2(newBoard[0].last_match2_home_code ? {
        homeCode: newBoard[0].last_match2_home_code,
        home: newBoard[0].last_match2_home,
        awayCode: newBoard[0].last_match2_away_code,
        away: newBoard[0].last_match2_away,
      } : null);
    }

    if (newBoard.length > 0 && newBoard[0].next_match_home_code) {
      setNextMatch({
        homeCode: newBoard[0].next_match_home_code,
        home: newBoard[0].next_match_home,
        awayCode: newBoard[0].next_match_away_code,
        away: newBoard[0].next_match_away,
      });
    }
  }, []);

  useEffect(() => {
    api.getLeaderboard()
      .then(applyUpdate)
      .catch(console.error)
      .finally(() => setLoading(false));

    const t = setInterval(() => {
      api.getLeaderboard().then(applyUpdate).catch(() => {});
    }, 15_000);

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

  const hasResults = board.some(r => Number(r.total_points) > 0);
  const filtered = board.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  const sorted = sort.key
    ? [...filtered].sort((a, b) => {
        let av = Number(a[sort.key] ?? 0);
        let bv = Number(b[sort.key] ?? 0);
        if (sort.key === 'last_result' && lastMatch2) {
          av += Number(a.last_result2 ?? 0);
          bv += Number(b.last_result2 ?? 0);
        }
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

  const enterCompareMode = () => {
    setCompareMode(true);
    setSelected(new Set());
    setExpanded(null);
  };

  const exitCompareMode = () => {
    setCompareMode(false);
    setComparing(false);
    setSelected(new Set());
  };

  useEffect(() => {
    if (!compareMode) return;
    const onKey = (e) => { if (e.key === 'Escape') exitCompareMode(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compareMode]);

  useEffect(() => {
    if (compareMode && selected.size === 2) {
      setComparing(true);
      const [a, b] = [...selected];
      const t = setTimeout(() => {
        navigate(`/leaderboard/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [selected, compareMode]);


  const colSort = (col) => sort.key === col ? sort.dir : null;

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>;
  }

  return (
    <div className="space-y-6 sm:-mt-5">

      {/* Header — sticky below navbar */}
      <div className="sticky top-14 sm:top-16 z-20 -mx-3 sm:-mx-6 px-3 sm:px-6 pb-3 bg-brand-navy border-b border-brand-border flex flex-row items-center sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">Leaderboard</h1>
            <p className="text-sm text-gray-400 mt-0.5 leading-snug">
              {board.length} players{lastUpdated && <><br className="sm:hidden" /><span className="hidden sm:inline"> · </span>Updated at {formatTime(lastUpdated)}</>}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            {comparing ? (
              <svg className="w-8 h-8 animate-spin text-brand-gold" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : compareMode ? (
              <>
                <span className="text-sm text-gray-400 leading-snug text-right">
                  {selected.size === 0 ? <>Click a player<br className="sm:hidden" />{' '}to select</> : <>Click one<br className="sm:hidden" />{' '}more player</>}
                </span>
                <button onClick={exitCompareMode} className="btn-secondary text-sm py-2 px-4 whitespace-nowrap">
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={enterCompareMode} className="btn-primary text-sm py-2 px-4 whitespace-nowrap">
                Compare
              </button>
            )}
          </div>
      </div>

      {/* Full table */}
      <div className="card overflow-x-auto overflow-y-auto p-0 max-h-[calc(100svh-225px)] sm:max-h-[calc(100svh-220px)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-brand-card">
            <tr className="border-b border-brand-border text-gray-400 text-xs uppercase tracking-wider">
              <th className="hidden px-3 py-3 w-8 text-center text-gray-400 text-xs uppercase tracking-wider">H2H</th>
              <th className="px-2 sm:px-4 py-3 text-left w-8 sm:w-12">#</th>
              <th className="px-2 sm:px-4 py-3 text-left">Player</th>
              <th className="px-4 py-3 text-center text-xs hidden">Paid</th>
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
                className="px-2 sm:px-4 py-3 text-center text-xs cursor-pointer select-none hover:opacity-80 transition-opacity"
                onClick={() => handleSort('last_result')}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="w-3 shrink-0" />
                  {lastMatchIsLive ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/50 text-xs font-black text-red-400 leading-none">
                      <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse shrink-0" />
                      {lastMatch2 ? 'LIVE MATCHES' : 'LIVE MATCH'}
                    </span>
                  ) : 'Last Result'}
                  <span className="w-3 shrink-0 inline-flex justify-center text-gray-400 text-xs leading-none">
                    {colSort('last_result') === 'desc' ? '▾' : colSort('last_result') === 'asc' ? '▴' : '·'}
                  </span>
                </div>
                {lastMatch && (
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <Flag code={lastMatch.homeCode} name={lastMatch.home} className="w-4 h-4 rounded-sm object-cover" />
                      <span className="text-gray-600 text-xs">v</span>
                      <Flag code={lastMatch.awayCode} name={lastMatch.away} className="w-4 h-4 rounded-sm object-cover" />
                    </div>
                    {lastMatch2 && (
                      <>
                        <span className="text-gray-600 text-xs">·</span>
                        <div className="flex items-center gap-1">
                          <Flag code={lastMatch2.homeCode} name={lastMatch2.home} className="w-4 h-4 rounded-sm object-cover" />
                          <span className="text-gray-600 text-xs">v</span>
                          <Flag code={lastMatch2.awayCode} name={lastMatch2.away} className="w-4 h-4 rounded-sm object-cover" />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </th>
              <th className="px-4 py-3 text-center text-xs hidden sm:table-cell">
                <div>Next Match</div>
                {nextMatch && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Flag code={nextMatch.homeCode} name={nextMatch.home} className="w-4 h-4 rounded-sm object-cover" />
                    <span className="text-gray-600 text-xs">v</span>
                    <Flag code={nextMatch.awayCode} name={nextMatch.away} className="w-4 h-4 rounded-sm object-cover" />
                  </div>
                )}
              </th>
              <th
                className="px-2 sm:px-4 py-3 text-center font-bold text-brand-gold cursor-pointer select-none hover:opacity-80 transition-opacity"
                onClick={() => handleSort('total_points')}
              >
                <div className="flex items-center justify-center">
                  <span className="w-3 shrink-0" />
                  <span className="sm:hidden">Pts</span><span className="hidden sm:inline">Points</span>
                  <span className="w-3 shrink-0 inline-flex justify-center text-gray-400 text-xs leading-none ml-1">
                    {colSort('total_points') === 'desc' ? '▾' : colSort('total_points') === 'asc' ? '▴' : '·'}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-gray-400">
                  {search ? 'No player found.' : 'No predictions submitted yet. Be the first!'}
                </td>
              </tr>
            ) : (
              sorted.map((row, idx) => (
                <React.Fragment key={row.id}>
                  <tr
                    onClick={() => compareMode ? toggleSelect(row.name, { stopPropagation: () => {} }) : toggle(row.id)}
                    className={`border-b border-brand-border/50 cursor-pointer transition-colors duration-700 ${
                      flashIds.has(row.id)                          ? 'bg-emerald-900/25' :
                      compareMode && selected.has(row.name)         ? 'bg-brand-gold/15 border-brand-gold/30' :
                      compareMode                                   ? 'hover:bg-brand-gold/5' :
                      expanded === row.id                           ? 'bg-white/5 border-brand-border' :
                      selected.has(row.name)                        ? 'bg-brand-gold/5' :
                      idx < 3 && !search                            ? 'bg-brand-gold/3 hover:bg-white/5' : 'hover:bg-white/5'
                    }`}
                  >
                    <td className="hidden px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.name)}
                        onChange={e => toggleSelect(row.name, e)}
                        onClick={e => e.stopPropagation()}
                        disabled={!selected.has(row.name) && selected.size >= 2}
                        className="w-4 h-4 rounded accent-brand-gold cursor-pointer disabled:opacity-30"
                      />
                    </td>
                    <td className="px-2 sm:px-4 py-3">
                      <RankBadge rank={row.rank} hasResults={hasResults} />
                    </td>
                    <td className="px-2 sm:px-4 py-3 font-semibold">
                      <span className="flex items-center gap-1.5">
                        {row.name}
                        <span className={`text-gray-400 text-xs transition-transform inline-block ${expanded === row.id ? 'rotate-180' : ''}`}>▾</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden">
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
                    <td className="px-2 sm:px-4 py-3 text-center">
                      {lastMatch2 ? (
                        <div className="flex items-center justify-center gap-1">
                          <PtsBadge pts={row.last_result} pending={row.last_result === null} />
                          <PtsBadge pts={row.last_result2} pending={row.last_result2 === null} />
                        </div>
                      ) : (
                        <PtsBadge pts={row.last_result} pending={row.last_result === null} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      {row.next_pred_home !== null
                        ? <span className="text-sm font-semibold text-gray-300">{row.next_pred_home}–{row.next_pred_away}</span>
                        : <span className="text-gray-600 text-sm">—</span>
                      }
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center font-black text-brand-gold text-lg">
                      {row.total_points}
                    </td>
                  </tr>
                  {expanded === row.id && (
                    <PredictionExpanded
                      key={`${row.id}-expanded`}
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
        <div className="card text-center py-10 text-gray-400">
          <p className="font-semibold">Leaderboard is empty</p>
          <p className="text-sm mt-1">Share the link with your group and start predicting!</p>
        </div>
      )}
    </div>
  );
}
