import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';

const COLORS = [
  '#FFD700', '#60A5FA', '#F87171', '#34D399', '#A78BFA',
  '#FB923C', '#38BDF8', '#F472B6', '#4ADE80', '#FBBF24',
  '#818CF8', '#E879F9', '#2DD4BF', '#FF6B6B', '#93C5FD',
  '#C4B5FD', '#FCD34D', '#67E8F9', '#F9A8D4', '#6EE7B7',
  '#FF8C00', '#00CED1', '#FF69B4', '#7CFC00', '#9370DB',
  '#FF4500', '#20B2AA',
];

// Human-readable phase labels
const PHASE_LABELS = {
  group:       'Group Stage',
  r32:         'Round of 32',
  round_of_32: 'Round of 32',
  r16:         'Round of 16',
  round_of_16: 'Round of 16',
  qf:          'Quarter-finals',
  quarterfinal:'Quarter-finals',
  sf:          'Semi-finals',
  semifinal:   'Semi-finals',
  final:       'Final',
  third:       '3rd Place',
};

const PAD_L = 40;
const PAD_T = 52;
const PAD_B = 44;

// Measure the exact pixel width of the longest possible end label so PAD_R
// is tight rather than a conservative guess. Longest name is "Maxi Webster-Coles";
// worst-case rank prefix is two digits, e.g. "#10 ".
const PAD_R = (() => {
  try {
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    ctx.font     = '600 11px ui-sans-serif, sans-serif';
    return Math.ceil(ctx.measureText('#10 Maxi Webster-Coles').width) + 20; // 12px gap + 8px buffer
  } catch {
    return 180;
  }
})();
const MIN_STEP_Y = 22;
const DOT_R      = 3;

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}

export default function RankingsHistory() {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [hoveredCol, setHoveredCol] = useState(null);
  const [selected, setSelected]     = useState(new Set());
  const [search, setSearch]         = useState('');
  const [zoom, setZoom]             = useState(36); // STEP_X in px
  const containerRef                = useRef(null);
  const isMobile                    = useIsMobile();
  const autoZoomDone                = useRef(false);

  useEffect(() => {
    api.getLeaderboardHistory()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Once data arrives: pick the zoom that fits all matches + names in the viewport,
  // then scroll right so the most recent standings (and name labels) are in view.
  useEffect(() => {
    if (!data || !containerRef.current || autoZoomDone.current) return;
    const availW     = containerRef.current.clientWidth;
    if (availW === 0) return;
    const count      = data.matches.length;
    const optimalStep = Math.floor((availW - PAD_L - PAD_R) / count);
    setZoom(Math.max(18, Math.min(60, optimalStep)));
    setTimeout(() => {
      containerRef.current?.scrollTo({ left: containerRef.current.scrollWidth, behavior: 'instant' });
    }, 80);
    autoZoomDone.current = true;
  }, [data]);

  const toggle = useCallback((name) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const showAll  = useCallback(() => setSelected(new Set()), []);
  const showTopN = useCallback((n, users) => {
    setSelected(new Set(users.slice(0, n).map(u => u.name)));
  }, []);

  if (isMobile) return (
    <div>
      <div className="sticky top-14 sm:top-16 z-20 bg-brand-navy -mx-3 px-3 sm:-mx-6 sm:px-6 -mt-6 sm:-mt-8 pt-6 sm:pt-3 pb-3">
        <h1 className="text-2xl font-black">Ranking History</h1>
        <p className="text-sm text-gray-400 mt-0.5">How the standings have evolved match by match</p>
      </div>
      <div className="bg-brand-card border border-brand-border rounded-2xl flex flex-col items-center justify-center gap-3 text-center py-16 px-6">
        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z" />
        </svg>
        <p className="text-white font-bold text-lg">Desktop only</p>
        <p className="text-gray-400 text-sm">Open this page on your computer to see the full chart.</p>
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading history…</div>
  );
  if (error) return (
    <div className="text-red-400 text-center py-8">{error}</div>
  );
  if (!data || data.matches.length === 0) return (
    <div className="text-center text-gray-400 py-16">
      <p className="text-lg font-bold text-white">No results yet</p>
      <p className="text-sm mt-1">Rankings will appear as matches are completed.</p>
    </div>
  );

  const { matches, users } = data;
  const STEP_X     = zoom;
  const matchCount = matches.length;
  const userCount  = users.length;

  const isVisible = (name) => selected.size === 0 || selected.has(name);

  const stepY = Math.max(MIN_STEP_Y, Math.floor(400 / Math.max(userCount - 1, 1)));
  const plotH = stepY * (userCount - 1);
  const svgH  = PAD_T + plotH + PAD_B;
  const svgW  = PAD_L + matchCount * STEP_X + PAD_R;

  const xOf = (i)   => PAD_L + i * STEP_X + STEP_X / 2;
  const yOf = (pos) => PAD_T + (pos - 1) * stepY;

  // Find phase transition points (first index of each new phase)
  const phaseTransitions = [];
  let lastPhase = null;
  matches.forEach((m, i) => {
    const p = m.phase || 'group';
    if (p !== lastPhase) {
      phaseTransitions.push({ index: i, phase: p, label: PHASE_LABELS[p] || p });
      lastPhase = p;
    }
  });

  // Alternating phase background bands
  const phaseBands = phaseTransitions.map((pt, pi) => {
    const nextStart = phaseTransitions[pi + 1]?.index ?? matchCount;
    return {
      x:     PAD_L + pt.index * STEP_X,
      width: (nextStart - pt.index) * STEP_X,
      label: pt.label,
      even:  pi % 2 === 0,
    };
  });

  const resolveCol = (clientX) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect   = el.getBoundingClientRect();
    const mouseX = clientX - rect.left + el.scrollLeft;
    let nearest = null, minDist = STEP_X / 2 + 1;
    matches.forEach((_, i) => {
      const d = Math.abs(mouseX - xOf(i));
      if (d < minDist) { minDist = d; nearest = i; }
    });
    return nearest;
  };

  const legendUsers = search
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : users;

  return (
    <div>
      <div className="sticky top-14 sm:top-16 z-20 bg-brand-navy -mx-3 px-3 sm:-mx-6 sm:px-6 -mt-6 sm:-mt-8 pt-6 sm:pt-3 pb-3">
        <h1 className="text-2xl font-black">Ranking History</h1>
        <p className="text-sm text-gray-400 mt-0.5">How the standings have evolved match by match</p>
      </div>

      <div className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-6 space-y-4">

        {/* ── Controls row ── */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-36 px-2.5 py-1.5 rounded-lg bg-brand-navy border border-brand-border text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold/60"
          />
          <div className="flex gap-2">
            <button onClick={showAll} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${selected.size === 0 ? 'bg-brand-gold text-black' : 'bg-white/10 text-gray-300 hover:bg-white/15'}`}>All</button>
            {[5, 10].map(n => (
              <button key={n} onClick={() => showTopN(n, users)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${selected.size === n && users.slice(0, n).every(u => selected.has(u.name)) ? 'bg-brand-gold text-black' : 'bg-white/10 text-gray-300 hover:bg-white/15'}`}>
                Top {n}
              </button>
            ))}
            {selected.size > 0 && <span className="text-xs text-gray-500 self-center">{selected.size} shown</span>}
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-2 ml-auto">
            <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" clipRule="evenodd"/>
            </svg>
            <input
              type="range" min={18} max={60} step={2} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="w-28 accent-brand-gold"
              title={`Column width: ${zoom}px`}
            />
            <svg className="w-4.5 h-4.5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" clipRule="evenodd"/>
            </svg>
          </div>
        </div>

        {/* ── Legend chips — horizontally scrollable ── */}
        <div className="flex flex-wrap gap-1.5">
          {legendUsers.map((u) => {
            const ui    = users.indexOf(u);
            const color = COLORS[ui % COLORS.length];
            const vis   = isVisible(u.name);
            const finalRank = u.ranks[u.ranks.length - 1];
            return (
              <button
                key={u.name}
                onClick={() => toggle(u.name)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all shrink-0 select-none ${vis ? 'text-white' : 'border-white/8 text-gray-600'}`}
                style={vis ? { background: color + '1a', borderColor: color + '55' } : {}}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: vis ? color : '#444' }} />
                {finalRank != null && <span style={{ color: vis ? color : '#555' }} className="font-bold">#{finalRank}</span>}
                <span>{u.name}</span>
              </button>
            );
          })}
        </div>

        {/* ── Chart ── */}
        <div
          ref={containerRef}
          className="overflow-x-auto rounded-lg"
          onMouseMove={e => setHoveredCol(resolveCol(e.clientX))}
          onMouseLeave={() => setHoveredCol(null)}
        >
          <svg width={svgW} height={svgH} className="block">

            {/* Phase background bands */}
            {phaseBands.map((band, i) => (
              <g key={i}>
                <rect
                  x={band.x} y={0}
                  width={band.width} height={svgH}
                  fill={band.even ? 'rgba(255,255,255,0.0)' : 'rgba(255,255,255,0.025)'}
                />
                {/* Phase divider line (skip the first) */}
                {i > 0 && (
                  <line
                    x1={band.x} y1={PAD_T - 8}
                    x2={band.x} y2={PAD_T + plotH + 8}
                    stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="3 3"
                  />
                )}
              </g>
            ))}

            {/* Horizontal rank grid lines */}
            {Array.from({ length: userCount }, (_, i) => (
              <line key={i} x1={PAD_L} y1={yOf(i+1)} x2={svgW - PAD_R + 12} y2={yOf(i+1)} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            ))}

            {/* Column hover tint + indicator */}
            {hoveredCol !== null && (() => {
              const m = matches[hoveredCol];
              const cx = xOf(hoveredCol);
              return (
                <>
                  <rect x={cx - STEP_X/2} y={PAD_T} width={STEP_X} height={plotH} fill="rgba(255,255,255,0.05)" rx={2} />
                  <line x1={cx} y1={PAD_T} x2={cx} y2={PAD_T + plotH} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4 3" />
                  {m.home_code && (
                    <>
                      <rect x={cx - 20} y={PAD_T - 36} width={40} height={20} rx={3} fill="rgba(10,14,30,0.9)" />
                      <image href={`/flags/${m.home_code.toLowerCase()}.svg`} x={cx - 18} y={PAD_T - 34} width={14} height={14} preserveAspectRatio="xMidYMid meet" />
                      <text x={cx} y={PAD_T - 24} textAnchor="middle" fontSize={11} fontWeight="700" fill="rgba(255,255,255,0.5)" fontFamily="ui-sans-serif,sans-serif">v</text>
                      <image href={`/flags/${m.away_code.toLowerCase()}.svg`} x={cx + 4}  y={PAD_T - 34} width={14} height={14} preserveAspectRatio="xMidYMid meet" />
                    </>
                  )}
                </>
              );
            })()}

            {/* Y-axis rank labels */}
            {Array.from({ length: userCount }, (_, i) => (
              <text key={i} x={PAD_L - 6} y={yOf(i+1) + 4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.2)" fontFamily="ui-monospace,monospace">{i+1}</text>
            ))}

            {/* X-axis match number labels — only every Nth tick to avoid overlap */}
            {matches.map((m, i) => {
              const every = zoom <= 24 ? 5 : zoom <= 32 ? 3 : zoom <= 44 ? 2 : 1;
              if (i % every !== 0) return null;
              return (
                <text key={i} x={xOf(i)} y={svgH - 14} textAnchor="middle" fontSize={9}
                  fill={hoveredCol === i ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)'}
                  fontFamily="ui-monospace,monospace"
                >
                  {m.match_number}
                </text>
              );
            })}

            {/* Dim lines first, visible on top */}
            {[false, true].flatMap(renderVisible =>
              users.map((user, ui) => {
                const vis = isVisible(user.name);
                if (vis !== renderVisible) return null;

                const color   = COLORS[ui % COLORS.length];
                const opacity = vis ? 1 : 0.05;
                const sw      = vis ? 1.5 : 1;

                const segments = [];
                let seg = [];
                user.ranks.forEach((rank, i) => {
                  if (rank != null) seg.push([xOf(i), yOf(rank)]);
                  else if (seg.length) { segments.push(seg); seg = []; }
                });
                if (seg.length) segments.push(seg);

                const lastRank = user.ranks[user.ranks.length - 1];

                return (
                  <g key={user.name} opacity={opacity} onClick={() => toggle(user.name)} style={{ cursor: 'pointer' }}>
                    {segments.map((s, si) => (
                      <polyline key={si} points={s.map(([x,y]) => `${x},${y}`).join(' ')} fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
                    ))}
                    {user.ranks.map((rank, i) => rank != null ? (
                      <circle key={i} cx={xOf(i)} cy={yOf(rank)} r={hoveredCol === i && vis ? DOT_R + 2 : DOT_R} fill={color} stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
                    ) : null)}
                    {vis && lastRank != null && (
                      <text x={xOf(matchCount - 1) + 12} y={yOf(lastRank) + 4} fontSize={11} fill={color} fontWeight="600" fontFamily="ui-sans-serif,sans-serif">
                        #{lastRank} {user.name}
                      </text>
                    )}
                  </g>
                );
              })
            )}

            {/* Rank badges — only when a single user is isolated */}
            {hoveredCol !== null && hoveredCol !== matchCount - 1 && selected.size >= 1 && selected.size <= 5 && users.map((user, ui) => {
              if (!isVisible(user.name)) return null;
              const rank = user.ranks[hoveredCol];
              if (rank == null) return null;
              const color = COLORS[ui % COLORS.length];
              const cx = xOf(hoveredCol);
              const cy = yOf(rank);
              const label = String(rank);
              const badgeW = label.length > 1 ? 24 : 18;
              return (
                <g key={user.name}>
                  <rect
                    x={cx - badgeW / 2} y={cy - 10}
                    width={badgeW} height={18}
                    rx={4} fill={color} opacity={0.92}
                  />
                  <text
                    x={cx} y={cy + 4}
                    textAnchor="middle" fontSize={12} fontWeight="700"
                    fill="rgba(0,0,0,0.85)" fontFamily="ui-monospace,monospace"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

      </div>
    </div>
  );
}
