import { useEffect, useState } from 'react';
import { api } from '../api';
import Flag from '../components/Flag';
import { R32_SLOTS, LATE_SLOTS, calcStandings, resolveTeam, resolveBest3rdSlots } from '../bracketUtils';

// ── Layout constants ──────────────────────────────────────────────────────────
const CW  = 104;  // card width
const CH  = 48;   // card height (2 × 24px rows)
const GAP = 34;   // horizontal gap between rounds
const COL = CW + GAP;
const SH  = 68;   // slot height for one R32 row
const H   = 8 * SH;

const L_R32 = 0;
const L_R16 = L_R32 + COL;
const L_QF  = L_R16 + COL;
const L_SF  = L_QF  + COL;
const MG    = 46;
const FINAL = L_SF  + CW + MG;
const R_SF  = FINAL + CW + MG;
const R_QF  = R_SF  + COL;
const R_R16 = R_QF  + COL;
const R_R32 = R_R16 + COL;
const TW    = R_R32 + CW;

// ── Y-center calculators ──────────────────────────────────────────────────────
const yc = {
  r32: i => (i + 0.5) * SH,
  r16: i => (2 * i + 1) * SH,
  qf:  i => (4 * i + 2) * SH,
  sf:  ()  => H / 2,
};

// ── Bracket tree order ────────────────────────────────────────────────────────
const LEFT = {
  r32: [74, 77, 73, 75, 83, 84, 81, 82],
  r16: [89, 90, 93, 94],
  qf:  [97, 98],
  sf:  [101],
};

const RIGHT = {
  r32: [76, 78, 79, 80, 86, 88, 85, 87],
  r16: [91, 92, 95, 96],
  qf:  [99, 100],
  sf:  [102],
};

// ── Compact bracket card ──────────────────────────────────────────────────────
// flip=true: left-half cards — flag on right so it faces the center
function BCard({ matchNum, dbByNum, projMap, flip = false }) {
  const dbMatch  = dbByNum[matchNum];
  const finished = dbMatch?.status === 'finished';
  const homeWon  = finished && dbMatch.home_score > dbMatch.away_score;
  const awayWon  = finished && dbMatch.away_score > dbMatch.home_score;

  function getTeam(side) {
    if (dbMatch) return { code: dbMatch[`${side}_code`], name: dbMatch[`${side}_team`] };
    return projMap?.[matchNum]?.[side] ?? null;
  }

  const home = getTeam('home');
  const away = getTeam('away');
  const rh   = CH / 2;

  function Row({ team, score, won }) {
    const codeText = team ? (team.code || team.name?.slice(0, 3).toUpperCase()) : null;
    return (
      <div className={`flex items-center gap-1 px-1.5 ${won ? 'bg-brand-gold/10' : ''} ${flip ? 'flex-row-reverse' : ''}`}
           style={{ height: rh }}>
        {team ? (
          <>
            <Flag code={team.code} name={team.name} className="w-3.5 h-3.5 shrink-0" />
            <span className={`text-[11px] font-bold w-[26px] shrink-0 truncate leading-none uppercase
              ${flip ? 'text-right' : ''} ${won ? 'text-white' : 'text-gray-300'}`}>
              {codeText}
            </span>
          </>
        ) : (
          <>
            <span className="w-3.5 h-3.5 rounded-sm bg-brand-border/20 shrink-0" />
            <span className={`text-[10px] text-gray-600 w-[26px] leading-none ${flip ? 'text-right' : ''}`}>TBD</span>
          </>
        )}
        {finished && (
          <span className={`text-[11px] font-black tabular-nums ${flip ? 'mr-auto' : 'ml-auto'}
            ${won ? 'text-brand-gold' : 'text-gray-600'}`}>
            {score ?? '–'}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded border ${dbMatch
        ? 'border-brand-border bg-brand-navy'
        : 'border-brand-border/40 bg-brand-navy/60'}`}
         style={{ width: CW, height: CH }}>
      <Row team={home} score={dbMatch?.home_score} won={homeWon} />
      <div className="border-t border-brand-border/30" />
      <Row team={away} score={dbMatch?.away_score} won={awayWon} />
    </div>
  );
}

// ── SVG connector lines ───────────────────────────────────────────────────────
function BracketLines() {
  const segs = [];
  const L = (x1, y1, x2, y2) => segs.push([x1, y1, x2, y2]);

  function connectL(xOut, xIn, ysOut, ysIn) {
    const sx = xOut + CW + GAP / 2;
    for (let i = 0; i < ysIn.length; i++) {
      const yT = ysOut[2 * i], yB = ysOut[2 * i + 1], yM = ysIn[i];
      L(xOut + CW, yT, sx, yT);
      L(xOut + CW, yB, sx, yB);
      L(sx, yT, sx, yB);
      L(sx, yM, xIn, yM);
    }
  }

  function connectR(xOut, xIn, ysOut, ysIn) {
    const sx = xOut - GAP / 2;
    for (let i = 0; i < ysIn.length; i++) {
      const yT = ysOut[2 * i], yB = ysOut[2 * i + 1], yM = ysIn[i];
      L(xOut, yT, sx, yT);
      L(xOut, yB, sx, yB);
      L(sx, yT, sx, yB);
      L(sx, yM, xIn + CW, yM);
    }
  }

  const ysr32 = Array.from({ length: 8 }, (_, i) => yc.r32(i));
  const ysr16 = Array.from({ length: 4 }, (_, i) => yc.r16(i));
  const ysqf  = Array.from({ length: 2 }, (_, i) => yc.qf(i));
  const yssf  = [yc.sf()];

  connectL(L_R32, L_R16, ysr32, ysr16);
  connectL(L_R16, L_QF,  ysr16, ysqf);
  connectL(L_QF,  L_SF,  ysqf,  yssf);
  L(L_SF + CW, yc.sf(), FINAL, yc.sf());

  connectR(R_R32, R_R16, ysr32, ysr16);
  connectR(R_R16, R_QF,  ysr16, ysqf);
  connectR(R_QF,  R_SF,  ysqf,  yssf);
  L(FINAL + CW, yc.sf(), R_SF, yc.sf());

  return (
    <svg width={TW} height={H} className="absolute inset-0 pointer-events-none">
      {segs.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#374151" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

// ── Round column labels ───────────────────────────────────────────────────────
const LABELS = [
  { label: 'R32', x: L_R32 }, { label: 'R16', x: L_R16 },
  { label: 'QF',  x: L_QF  }, { label: 'SF',  x: L_SF  },
  { label: 'FINAL', x: FINAL },
  { label: 'SF',  x: R_SF  }, { label: 'QF',  x: R_QF  },
  { label: 'R16', x: R_R16 }, { label: 'R32', x: R_R32 },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Bracket() {
  const [allMatches, setAllMatches] = useState([]);
  const [loading,    setLoading]    = useState(true);

  function load() {
    api.getMatches().then(setAllMatches).catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
  );

  const groupMatches = allMatches.filter(m => m.phase === 'group');
  const koMatches    = allMatches.filter(m => m.phase !== 'group');

  const groups = [...new Set(groupMatches.map(m => m.group_name).filter(Boolean))].sort();
  const byGroup = {};
  for (const g of groups) byGroup[g] = calcStandings(groupMatches.filter(m => m.group_name === g));

  const dbByNum = {};
  for (const m of allMatches) dbByNum[m.match_number] = m;

  const groupStarted = groupMatches.some(m => m.status === 'finished');
  const koFinished   = koMatches.filter(m => m.status === 'finished').length;

  const best3rdMap = resolveBest3rdSlots(byGroup) || {};
  const projMap    = {};

  for (const num of Object.keys(R32_SLOTS).map(Number).sort()) {
    if (dbByNum[num]) continue;
    const slots = R32_SLOTS[num];
    projMap[num] = {};
    for (const side of ['home', 'away']) {
      const slot = slots[side];
      projMap[num][side] = slot.type === 'group'
        ? resolveTeam(slot, byGroup, dbByNum)
        : best3rdMap[num]?.[side] ?? null;
    }
  }

  for (const num of Object.keys(LATE_SLOTS).map(Number)) {
    if (dbByNum[num]) continue;
    const slots = LATE_SLOTS[num];
    projMap[num] = {
      home: resolveTeam(slots.home, byGroup, dbByNum),
      away: resolveTeam(slots.away, byGroup, dbByNum),
    };
  }

  const cards = [];
  function addRound(matchNums, xCol, ycFn, flip = false) {
    matchNums.forEach((num, i) => cards.push({ num, x: xCol, y: ycFn(i) - CH / 2, flip }));
  }

  addRound(LEFT.r32,  L_R32, yc.r32, true);
  addRound(LEFT.r16,  L_R16, yc.r16, true);
  addRound(LEFT.qf,   L_QF,  yc.qf,  true);
  addRound(LEFT.sf,   L_SF,  yc.sf,  true);
  cards.push({ num: 104, x: FINAL, y: yc.sf() - CH / 2, flip: false });
  addRound(RIGHT.sf,  R_SF,  yc.sf);
  addRound(RIGHT.qf,  R_QF,  yc.qf);
  addRound(RIGHT.r16, R_R16, yc.r16);
  addRound(RIGHT.r32, R_R32, yc.r32);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Knockout Bracket</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {koMatches.length > 0
            ? `${koFinished} of ${koMatches.length} knockout matches played · updates every 30 s`
            : groupStarted
            ? 'Projected from live standings · updates every 30 s'
            : 'Bracket will project once the group stage begins'}
        </p>
      </div>

      {!groupStarted ? (
        <div className="card text-center py-16">
          <p className="text-5xl mb-4">⏳</p>
          <p className="font-semibold text-gray-300">Group stage hasn't started yet</p>
          <p className="text-sm text-gray-500 mt-1">The projected bracket will appear once matches kick off</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div style={{ width: TW, minWidth: TW }} className="mx-auto">
            <div className="relative mb-2" style={{ height: 18 }}>
              {LABELS.map(({ label, x }, i) => (
                <span key={i}
                  className="absolute text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center"
                  style={{ left: x, width: CW }}>
                  {label}
                </span>
              ))}
            </div>
            <div className="relative" style={{ width: TW, height: H }}>
              <BracketLines />
              {cards.map(({ num, x, y, flip }) => (
                <div key={num} style={{ position: 'absolute', left: x, top: y }}>
                  <BCard matchNum={num} dbByNum={dbByNum} projMap={projMap} flip={flip} />
                </div>
              ))}
            </div>
            <div className="flex justify-center -mt-2 mb-4">
              <img
                src="/wc-logos/world-cup-trophy.png"
                alt="World Cup Trophy"
                style={{ width: 72, height: 'auto', opacity: 0.9 }}
              />
            </div>
            <div className="mt-6 flex justify-center">
              <div className="text-center">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">3rd Place</p>
                <BCard matchNum={103} dbByNum={dbByNum} projMap={projMap} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
