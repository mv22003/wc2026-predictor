import { useEffect, useState } from 'react';
import { api } from '../api';
import Flag from '../components/Flag';
import PredictionsModal from '../components/PredictionsModal';
import { R32_SLOTS, LATE_SLOTS, calcStandings, resolveTeam, resolveBest3rdSlots } from '../bracketUtils';
import { VENUE_BY_MATCH } from '../venueData';

// ─── Shared helpers ────────────────────────────────────────────────────────────
const PHASE_LABEL = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-finals', sf: 'Semi-finals', '3rd': 'Third Place', final: 'Final',
};


function getAll3rdsRanked(allMatches, groups) {
  const thirds = [];
  for (const g of groups) {
    const gm = allMatches.filter(m => m.group_name === g && m.phase === 'group');
    const standings = calcStandings(gm, true);
    if (standings.length >= 3 && standings[2].played > 0) thirds.push({ ...standings[2], group: g });
  }
  thirds.sort((a, b) =>
    b.pts - a.pts ||
    b.gd  - a.gd  ||
    b.gf  - a.gf  ||
    (b.conduct_score ?? 0) - (a.conduct_score ?? 0) ||
    (a.fifa_ranking ?? Infinity) - (b.fifa_ranking ?? Infinity) ||
    a.name.localeCompare(b.name)
  );
  return thirds;
}

function getBest3rds(allMatches, groups) {
  return new Set(getAll3rdsRanked(allMatches, groups).slice(0, 8).map(t => t.name));
}

function TeamName({ name, code }) {
  return (
    <>
      <span className="sm:hidden">{code}</span>
      <span className="hidden sm:inline">{name}</span>
    </>
  );
}

// ─── Groups tab ────────────────────────────────────────────────────────────────
function StandingsTable({ groupName, matches, qualifying3rd }) {
  const [open, setOpen] = useState(false);
  const groupMatches = matches.filter(m => m.group_name === groupName && m.phase === 'group');
  const standings    = calcStandings(groupMatches, true);
  const played       = groupMatches.filter(m => m.status === 'finished').length;
  const hasLive      = groupMatches.some(m => m.status === 'live');

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border bg-brand-navy/60">
        <div className="flex items-center gap-2">
          <h3 className="font-black text-base">Group {groupName}</h3>
          {hasLive && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/50 text-[10px] font-black text-red-400 leading-none">
              <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse shrink-0" />
              LIVE
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{played}/6 played</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-brand-border/50">
            <th className="px-3 py-2 text-left w-6">#</th>
            <th className="px-3 py-2 text-left">Team</th>
            <th className="px-2 py-2 text-center w-7">P</th>
            <th className="px-2 py-2 text-center w-7">W</th>
            <th className="px-2 py-2 text-center w-7">D</th>
            <th className="px-2 py-2 text-center w-7">L</th>
            <th className="px-2 py-2 text-center w-10 hidden sm:table-cell">GF</th>
            <th className="px-2 py-2 text-center w-10 hidden sm:table-cell">GA</th>
            <th className="px-2 py-2 text-center w-10">GD</th>
            <th className="px-2 py-2 text-center w-10">TCS</th>
            <th className="px-3 py-2 text-center w-10 font-bold text-brand-gold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr key={row.name}
              className={`border-b border-brand-border/30 last:border-0 transition-colors
                ${i < 2
                  ? 'bg-emerald-900/10 hover:bg-emerald-900/20'
                  : i === 2 && qualifying3rd?.has(row.name)
                  ? 'bg-amber-900/10 hover:bg-amber-900/20'
                  : 'hover:bg-white/5'}`}
            >
              <td className="px-3 py-2.5">
                <span className={`text-xs font-bold
                  ${i < 2 ? 'text-emerald-400'
                    : i === 2 && qualifying3rd?.has(row.name) ? 'text-amber-400'
                    : 'text-gray-400'}`}>
                  {i + 1}
                </span>
              </td>
              <td className="px-3 py-2.5 max-w-0 w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <Flag code={row.code} name={row.name} className="w-5 h-5 shrink-0" />
                  <span className="font-semibold truncate text-sm"><TeamName name={row.name} code={row.code} /></span>
                </div>
              </td>
              <td className="px-2 py-2.5 text-center text-gray-400">{row.played}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.won}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.drawn}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.lost}</td>
              <td className="px-2 py-2.5 text-center text-gray-400 hidden sm:table-cell">{row.gf}</td>
              <td className="px-2 py-2.5 text-center text-gray-400 hidden sm:table-cell">{row.ga}</td>
              <td className="px-2 py-2.5 text-center text-gray-400">
                {row.gd > 0 ? `+${row.gd}` : row.gd}
              </td>
              <td className="px-2 py-2.5 text-center text-gray-400">{row.conduct_score ?? 0}</td>
              <td className="px-3 py-2.5 text-center font-black text-brand-gold">{row.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-brand-border/50 flex items-center justify-end px-3 py-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
        >
          Matches {open ? '▲' : '▼'}
        </button>
      </div>
      {open && (
        <div className="border-t border-brand-border">
          {groupMatches
            .sort((a, b) => new Date(a.match_date) - new Date(b.match_date))
            .map(m => (
              <div key={m.id} className="flex items-center gap-2 px-4 py-2 border-b border-brand-border/30 last:border-0 hover:bg-white/3">
                <span className="text-xs text-gray-400 w-14 sm:w-28 shrink-0">
                  {m.match_date ? new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                </span>
                <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                  <span className={`text-xs font-semibold truncate text-right ${m.status === 'finished' || m.status === 'live' ? 'text-white' : 'text-gray-400'}`}>
                    <TeamName name={m.home_team} code={m.home_code} />
                  </span>
                  <Flag code={m.home_code} name={m.home_team} className="w-5 h-5 shrink-0" />
                </div>
                <div className="w-16 shrink-0 flex items-center justify-center">
                  {m.status === 'finished' ? (
                    <span className="font-black text-brand-gold text-base tabular-nums">{m.home_score}–{m.away_score}</span>
                  ) : m.status === 'live' ? (
                    <span className="font-black text-white text-base tabular-nums">{m.home_score}–{m.away_score}</span>
                  ) : (
                    <span className="text-xs text-gray-400">
                      {m.match_date ? new Date(m.match_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                    </span>
                  )}
                </div>
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <Flag code={m.away_code} name={m.away_team} className="w-5 h-5 shrink-0" />
                  <span className={`text-xs font-semibold truncate ${m.status === 'finished' || m.status === 'live' ? 'text-white' : 'text-gray-400'}`}>
                    <TeamName name={m.away_team} code={m.away_code} />
                  </span>
                </div>
                <div className="w-14 sm:w-28 shrink-0 flex items-center justify-end">
                  {m.status === 'finished' && <span className="tag pts-exact text-xs">FT</span>}
                  {m.status === 'live' && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/50 text-[10px] font-black text-red-400 leading-none">
                      <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse shrink-0" />
                      LIVE
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function Best3rdsTable({ allMatches, groups }) {
  const thirds = getAll3rdsRanked(allMatches, groups);
  if (thirds.length === 0) return null;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border bg-brand-navy/60">
        <h3 className="font-black text-base">Best Third Places</h3>
        <span className="text-xs text-gray-400">{thirds.length} of {groups.length} groups</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-brand-border/50">
            <th className="px-3 py-2 text-left w-6">#</th>
            <th className="px-3 py-2 text-center w-8 hidden sm:table-cell">Group</th>
            <th className="px-3 py-2 text-left">Team</th>
            <th className="px-2 py-2 text-center w-7">P</th>
            <th className="px-2 py-2 text-center w-7">W</th>
            <th className="px-2 py-2 text-center w-7">D</th>
            <th className="px-2 py-2 text-center w-7">L</th>
            <th className="px-2 py-2 text-center w-10 hidden sm:table-cell">GF</th>
            <th className="px-2 py-2 text-center w-10 hidden sm:table-cell">GA</th>
            <th className="px-2 py-2 text-center w-10">GD</th>
            <th className="px-2 py-2 text-center w-10">TCS</th>
            <th className="px-3 py-2 text-center w-10 font-bold text-brand-gold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {thirds.map((row, i) => (
            <tr key={row.name}
              className={`border-b border-brand-border/30 last:border-0 transition-colors
                ${i < 8 ? 'bg-amber-900/10 hover:bg-amber-900/20' : 'hover:bg-white/5'}`}
            >
              <td className="px-3 py-2.5">
                <span className={`text-xs font-bold ${i < 8 ? 'text-amber-400' : 'text-gray-400'}`}>{i + 1}</span>
              </td>
              <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                <span className="text-xs font-bold text-gray-400">{row.group}</span>
              </td>
              <td className="px-3 py-2.5 max-w-0 w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <Flag code={row.code} name={row.name} className="w-5 h-5 shrink-0" />
                  <span className="font-semibold truncate text-sm"><TeamName name={row.name} code={row.code} /></span>
                </div>
              </td>
              <td className="px-2 py-2.5 text-center text-gray-400">{row.played}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.won}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.drawn}</td>
              <td className="px-2 py-2.5 text-center text-gray-300">{row.lost}</td>
              <td className="px-2 py-2.5 text-center text-gray-400 hidden sm:table-cell">{row.gf}</td>
              <td className="px-2 py-2.5 text-center text-gray-400 hidden sm:table-cell">{row.ga}</td>
              <td className="px-2 py-2.5 text-center text-gray-400">
                {row.gd > 0 ? `+${row.gd}` : row.gd}
              </td>
              <td className="px-2 py-2.5 text-center text-gray-400">{row.conduct_score ?? 0}</td>
              <td className="px-3 py-2.5 text-center font-black text-brand-gold">{row.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const COLUMN_LEGEND = [
  ['P', 'Matches Played'], ['W', 'Wins'], ['D', 'Draws'], ['L', 'Loss'],
  ['GF', 'Goals For'], ['GA', 'Goals Against'], ['GD', 'Goal Difference'], ['PTS', 'Points'],
];

function GroupsTab({ matches, groups }) {
  const qualifying3rd = getBest3rds(matches, groups);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 shrink-0" />
          <span className="text-xs text-gray-400">Qualified (top 2)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70 shrink-0" />
          <span className="text-xs text-gray-400">Best 3rd (8 advance)</span>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        {groups.map(g => (
          <StandingsTable key={g} groupName={g} matches={matches} qualifying3rd={qualifying3rd} />
        ))}
      </div>
      <div className="sm:max-w-[calc(50%-12px)] sm:mx-auto">
        <Best3rdsTable allMatches={matches} groups={groups} />
      </div>
      <div className="space-y-1">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {COLUMN_LEGEND.map(([abbr, label]) => (
            <span key={abbr} className="text-xs text-gray-500">
              <span className="text-gray-300 font-semibold">{abbr}</span> = {label}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          <span className="text-gray-300 font-semibold">TCS</span> = Team Conduct Score — calculated based on yellow (-1) and red (-3) cards received
        </p>
      </div>
    </div>
  );
}

// ─── Calendar tab ──────────────────────────────────────────────────────────────
const DATE_FMT = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
function localDateKey(matchDate) {
  return new Date(matchDate).toLocaleDateString('en-GB', DATE_FMT);
}
function localDateISO(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function LiveMinute({ minute }) {
  return (
    <span className="inline-flex items-center justify-center gap-1 w-12 py-0.5 rounded-full bg-red-500/20 border border-red-500/60 text-xs font-semibold text-red-400 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
      LIVE
    </span>
  );
}

function parseScorers(raw) {
  if (!raw || raw === 'null') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(s => ({
      name: s.name ?? s.player ?? s.scorer ?? String(s),
      minute: s.minute ?? s.min ?? s.time ?? null,
    }));
    if (typeof parsed === 'string') raw = parsed;
  } catch {}
  return raw.replace(/[{}"""'']/g, '').split(',').map(s => s.trim()).filter(Boolean).map(part => {
    const m = part.match(/^(.*?)\s+(\d+(?:\+\d+)?)['']?["""]?$/);
    return m ? { name: m[1].trim(), minute: m[2] } : { name: part, minute: null };
  });
}

function parseMinute(m) {
  if (m == null) return 999;
  const str = String(m);
  const parts = str.split('+');
  return parseInt(parts[0], 10) + (parts[1] ? parseInt(parts[1], 10) / 100 : 0);
}

function formatMinute(min) {
  const s = String(min);
  const m = s.match(/^(\d+(?:\+\d+)?)\s*(\(p\))?$/i);
  return m ? ` ${m[1]}'${m[2] ? ' (p)' : ''}` : ` ${s}'`;
}

function ScorerLine({ homeScorers, awayScorers, homeScore, awayScore }) {
  const home = parseScorers(homeScorers).sort((a, b) => parseMinute(a.minute) - parseMinute(b.minute));
  const away = parseScorers(awayScorers).sort((a, b) => parseMinute(a.minute) - parseMinute(b.minute));
  if (home.length !== homeScore || away.length !== awayScore) return null;
  if (home.length === 0 && away.length === 0) return null;

  const rows = Math.max(home.length, away.length);

  return (
    <div className="mt-3 px-1 space-y-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center text-xs text-gray-400 gap-1">
          <span className="flex-1 min-w-0 flex items-center justify-end whitespace-nowrap">
            {home[i] ? `${home[i].name}${home[i].minute != null ? formatMinute(home[i].minute) : ''}` : ''}
          </span>
          <span className="w-16 sm:w-20 shrink-0 flex items-center justify-between">
            {home[i]
              ? <img src="/wc-logos/trionda.webp" alt="goal" className="w-[1em] h-[1em] shrink-0" />
              : <span className="w-[1em] shrink-0" />}
            {away[i]
              ? <img src="/wc-logos/trionda.webp" alt="goal" className="w-[1em] h-[1em] shrink-0" />
              : <span className="w-[1em] shrink-0" />}
          </span>
          <span className="flex-1 min-w-0 flex items-center whitespace-nowrap">
            {away[i] ? `${away[i].name}${away[i].minute != null ? formatMinute(away[i].minute) : ''}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function MatchRow({ match }) {
  const finished  = match.status === 'finished';
  const live      = match.status === 'live';
  const today     = new Date().toDateString();
  const matchDate = match.match_date ? new Date(match.match_date) : null;
  const isToday   = matchDate?.toDateString() === today;
  const timeStr   = matchDate
    ? matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '–';

  const venue = VENUE_BY_MATCH[match.match_number];
  const [showPreds, setShowPreds] = useState(false);

  return (
    <div className={`pt-5 pb-4 px-4 border-b border-brand-border/50 last:border-0
      hover:bg-white/5 transition-colors
      ${live ? 'bg-emerald-900/20 border-l-4 border-l-emerald-400' : ''}`}>
      <div className="flex items-stretch gap-3">
        {/* no mobile spacer needed — FT lives inside the score column, keeping both sides balanced */}
        {/* group · match# pill — desktop only */}
        <div className="hidden sm:flex sm:w-20 shrink-0 items-center justify-center">
          <span className="tag bg-brand-border text-gray-400 text-xs text-center whitespace-nowrap w-full">
            {match.group_name} · M{match.match_number}
          </span>
        </div>

        {/* center: teams + score + venue pill */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-end gap-2 sm:gap-3">
            <div className="flex-1 min-w-0 flex flex-col items-end gap-1.5">
              {match.home_ranking != null && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-brand-border/60 text-[10px] text-gray-400 whitespace-nowrap">
                  <img src="/wc-logos/FIFA_Logo_White_Generic.webp" alt="FIFA" className="h-2.5 w-auto opacity-70" />
                  #{match.home_ranking}
                </span>
              )}
              <div className="flex items-center gap-2 justify-end w-full">
                <span className={`text-sm font-semibold min-w-0 truncate text-right ${finished || live ? 'text-white' : 'text-gray-300'}`}>
                  <TeamName name={match.home_team} code={match.home_code} />
                </span>
                <Flag code={match.home_code} name={match.home_team} className="w-6 sm:w-7 h-6 sm:h-7 shrink-0" />
              </div>
            </div>
            <div className="w-16 sm:w-20 shrink-0 flex flex-col items-center justify-center gap-1 min-h-[24px] sm:min-h-[28px]">
              {finished && <span className="sm:hidden text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">FT</span>}
              {live && <span className="sm:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[10px] font-semibold text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />LIVE</span>}
              {finished ? (
                <span className="font-black text-brand-gold text-xl tabular-nums">
                  {match.home_score}–{match.away_score}
                </span>
              ) : live ? (
                <span className="font-black text-white text-xl tabular-nums">
                  {match.home_score}–{match.away_score}
                </span>
              ) : (
                <span className={`text-sm font-bold tabular-nums ${isToday ? 'text-brand-gold' : 'text-gray-400'}`}>
                  {timeStr}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col items-start gap-1.5">
              {match.away_ranking != null && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-brand-border/60 text-[10px] text-gray-400 whitespace-nowrap">
                  <img src="/wc-logos/FIFA_Logo_White_Generic.webp" alt="FIFA" className="h-2.5 w-auto opacity-70" />
                  #{match.away_ranking}
                </span>
              )}
              <div className="flex items-center gap-2 w-full">
                <Flag code={match.away_code} name={match.away_team} className="w-6 sm:w-7 h-6 sm:h-7 shrink-0" />
                <span className={`text-sm font-semibold min-w-0 truncate ${finished || live ? 'text-white' : 'text-gray-300'}`}>
                  <TeamName name={match.away_team} code={match.away_code} />
                </span>
              </div>
            </div>
          </div>
          {(finished || live) && (
            <ScorerLine
              homeScorers={match.home_scorers}
              awayScorers={match.away_scorers}
              homeScore={match.home_score ?? 0}
              awayScore={match.away_score ?? 0}
            />
          )}
          {venue && (
            <div className="mt-3 flex justify-center">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/5 border border-brand-border/60 text-[11px] text-gray-400 whitespace-nowrap">
                {venue}
              </span>
            </div>
          )}
          {/* Predictions button — inside center column so it aligns with the score */}
          <div className="mt-2 flex justify-center">
            <button
              onClick={() => setShowPreds(true)}
              className="text-[11px] text-brand-gold/70 hover:text-brand-gold transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.356-3.789M9 20H4v-2a4 4 0 015.356-3.789M15 11a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              View predictions
            </button>
          </div>
        </div>

        {/* FT / LIVE / Today / date — desktop only; mobile FT lives inside the score column */}
        <div className="hidden sm:flex sm:w-16 shrink-0 items-center justify-end">
          {finished ? (
            <span className="tag pts-exact text-xs inline-flex justify-center w-12">FT</span>
          ) : live ? (
            <LiveMinute minute={match.live_minute} />
          ) : (
            <span className="text-xs text-gray-400 hidden sm:block">
              {matchDate?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
      {showPreds && <PredictionsModal match={match} onClose={() => setShowPreds(false)} />}
    </div>
  );
}

function DateGroup({ matches, dateKey }) {
  const todayKey = new Date().toLocaleDateString('en-GB', DATE_FMT);
  const isToday  = dateKey === todayKey;
  const label    = dateKey ? dateKey.replace(/\s\d{4}$/, '') : '';
  return (
    <div className={`card p-0 overflow-hidden ${isToday ? 'border border-brand-gold/50' : ''}`}>
      <div className={`px-4 py-2.5 flex items-center gap-2 border-b border-brand-border ${isToday ? 'bg-brand-gold/20' : 'bg-brand-navy/60'}`}>
        <h3 className={`font-bold text-sm ${isToday ? 'text-brand-gold' : 'text-gray-300'}`}>{label}</h3>
        {isToday && <span className="hidden sm:inline text-brand-gold/50 text-sm">·</span>}
        {isToday && <span className="hidden sm:inline-flex tag bg-brand-gold text-brand-navy text-sm font-bold">Today</span>}
        <span className="ml-auto text-xs text-gray-400">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
      </div>
      {matches.map(m => <MatchRow key={m.id} match={m} />)}
    </div>
  );
}

const KO_PHASES = ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'];

function FilterBtn({ value, active, onChange, compact, stretch, children }) {
  return (
    <button
      onClick={() => onChange(value)}
      className={`${compact ? 'px-4 py-1 text-xs' : 'px-5 py-1.5 text-sm'} ${stretch ? 'flex-1' : ''} rounded-lg font-bold transition-all ${
        active === value
          ? 'bg-brand-gold text-brand-navy'
          : 'bg-brand-card border border-brand-border text-gray-300 hover:border-brand-gold/50'
      }`}
    >
      {children}
    </button>
  );
}

function CalendarTab({ matches, filter, pendingScrollToToday, setPendingScrollToToday }) {
  const calFiltered = filter === 'all'
    ? matches
    : matches.filter(m => m.group_name === filter);

  const byDate = {};
  for (const m of calFiltered) {
    const key = m.match_date ? localDateKey(m.match_date) : 'TBD';
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(m);
  }

  useEffect(() => {
    if (!pendingScrollToToday) return;
    function scrollToEl(el) {
      if (!el) return;
      const stickyHeight = Array.from(document.querySelectorAll('.sticky'))
        .reduce((sum, s) => sum + s.offsetHeight, 0);
      const top = el.getBoundingClientRect().top + window.scrollY - stickyHeight - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    const liveEl = document.querySelector('[data-has-live="true"]');
    if (liveEl) {
      scrollToEl(liveEl);
    } else {
      const todayISO = localDateISO(new Date());
      const nearestUpcoming = matches
        .filter(m => m.status === 'upcoming' && m.match_date)
        .filter(m => localDateISO(m.match_date) >= todayISO)
        .sort((a, b) => new Date(a.match_date) - new Date(b.match_date))[0];
      const target = nearestUpcoming
        ? localDateKey(nearestUpcoming.match_date)
        : new Date().toLocaleDateString('en-GB', DATE_FMT);
      scrollToEl(document.querySelector(`[data-date="${target}"]`));
    }
    setPendingScrollToToday(false);
  }, [pendingScrollToToday, filter]);

  return (
    <div className="space-y-4">
      {Object.entries(byDate).map(([dateStr, dayMatches]) => (
        <div key={dateStr} data-date={dateStr} data-has-live={dayMatches.some(m => m.status === 'live') ? 'true' : undefined}>
          <DateGroup matches={dayMatches} dateKey={dateStr} />
        </div>
      ))}
    </div>
  );
}

// ─── Bracket tab ───────────────────────────────────────────────────────────────
const CW  = 88;
const CH  = 48;
const GAP = 28;
const COL = CW + GAP;
const SH  = 68;
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

const yc = {
  r32: i => (i + 0.5) * SH,
  r16: i => (2 * i + 1) * SH,
  qf:  i => (4 * i + 2) * SH,
  sf:  ()  => H / 2,
};

const LEFT  = { r32: [74, 77, 73, 75, 83, 84, 81, 82], r16: [89, 90, 93, 94], qf: [97, 98], sf: [101] };
const RIGHT = { r32: [76, 78, 79, 80, 86, 88, 85, 87], r16: [91, 92, 95, 96], qf: [99, 100], sf: [102] };

const BRACKET_LABELS = [
  { label: 'R32', x: L_R32 }, { label: 'R16', x: L_R16 },
  { label: 'QF',  x: L_QF  }, { label: 'SF',  x: L_SF  },
  { label: 'FINAL', x: FINAL },
  { label: 'SF',  x: R_SF  }, { label: 'QF',  x: R_QF  },
  { label: 'R16', x: R_R16 }, { label: 'R32', x: R_R32 },
];

function slotLabel(slot) {
  if (!slot) return null;
  if (slot.type === 'group') return { main: `${slot.pos}${slot.group}`, sub: null };
  if (slot.type === 'best3rd') return { main: `3${slot.groups.join('/')}`, sub: null };
  return null;
}

function BCard({ matchNum, dbByNum, projMap, allTeamsPlayed, flip = false }) {
  const dbMatch  = dbByNum[matchNum];
  const finished = dbMatch?.status === 'finished';
  const homeWon  = finished && dbMatch.home_score > dbMatch.away_score;
  const awayWon  = finished && dbMatch.away_score > dbMatch.home_score;

  const r32Slots = R32_SLOTS[matchNum];
  const showLabels = r32Slots && !allTeamsPlayed;

  function getTeam(side) {
    if (dbMatch) return { code: dbMatch[`${side}_code`], name: dbMatch[`${side}_team`] };
    if (showLabels) return null;
    return projMap?.[matchNum]?.[side] ?? null;
  }

  const home = getTeam('home');
  const away = getTeam('away');
  const homeSlot = showLabels ? slotLabel(r32Slots.home) : null;
  const awaySlot = showLabels ? slotLabel(r32Slots.away) : null;
  const rh   = CH / 2;

  function Row({ team, score, won, slot }) {
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
        ) : slot ? (
          <div className={`flex flex-col justify-center flex-1 ${flip ? 'items-end' : 'items-start'}`}>
            <span className={`text-[11px] font-bold text-gray-400 leading-none`}>{slot.main}</span>
            {slot.sub && <span className={`text-[8px] text-gray-400 leading-none mt-0.5`}>{slot.sub}</span>}
          </div>
        ) : (
          <>
            <span className="w-3.5 h-3.5 rounded-sm bg-brand-border/20 shrink-0" />
            <span className={`text-[10px] text-gray-400 w-[26px] leading-none ${flip ? 'text-right' : ''}`}>TBD</span>
          </>
        )}
        {finished && (
          <span className={`text-[11px] font-black tabular-nums ${flip ? 'mr-auto' : 'ml-auto'}
            ${won ? 'text-brand-gold' : 'text-gray-400'}`}>
            {score ?? '–'}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded border ${dbMatch
        ? 'border-brand-border bg-brand-navy'
        : 'border-brand-border bg-brand-card'}`}
         style={{ width: CW, height: CH }}>
      <Row team={home} score={dbMatch?.home_score} won={homeWon} slot={homeSlot} />
      <div className="border-t border-brand-border/30" />
      <Row team={away} score={dbMatch?.away_score} won={awayWon} slot={awaySlot} />
    </div>
  );
}

function BracketLines() {
  const segs = [];
  const L = (x1, y1, x2, y2) => segs.push([x1, y1, x2, y2]);

  function connectL(xOut, xIn, ysOut, ysIn) {
    const sx = xOut + CW + GAP / 2;
    for (let i = 0; i < ysIn.length; i++) {
      const yT = ysOut[2 * i], yB = ysOut[2 * i + 1], yM = ysIn[i];
      L(xOut + CW, yT, sx, yT); L(xOut + CW, yB, sx, yB);
      L(sx, yT, sx, yB); L(sx, yM, xIn, yM);
    }
  }

  function connectR(xOut, xIn, ysOut, ysIn) {
    const sx = xOut - GAP / 2;
    for (let i = 0; i < ysIn.length; i++) {
      const yT = ysOut[2 * i], yB = ysOut[2 * i + 1], yM = ysIn[i];
      L(xOut, yT, sx, yT); L(xOut, yB, sx, yB);
      L(sx, yT, sx, yB); L(sx, yM, xIn + CW, yM);
    }
  }

  const ysr32 = Array.from({ length: 8 }, (_, i) => yc.r32(i));
  const ysr16 = Array.from({ length: 4 }, (_, i) => yc.r16(i));
  const ysqf  = Array.from({ length: 2 }, (_, i) => yc.qf(i));
  const yssf  = [yc.sf()];

  connectL(L_R32, L_R16, ysr32, ysr16); connectL(L_R16, L_QF, ysr16, ysqf);
  connectL(L_QF,  L_SF,  ysqf,  yssf);
  L(L_SF + CW, yc.sf(), FINAL, yc.sf());
  connectR(R_R32, R_R16, ysr32, ysr16); connectR(R_R16, R_QF, ysr16, ysqf);
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

function BracketTab({ allMatches }) {
  const groupMatches = allMatches.filter(m => m.phase === 'group');
  const koMatches    = allMatches.filter(m => m.phase !== 'group');

  const groups = [...new Set(groupMatches.map(m => m.group_name).filter(Boolean))].sort();
  const byGroup = {};
  for (const g of groups) byGroup[g] = calcStandings(groupMatches.filter(m => m.group_name === g));

  const dbByNum = {};
  for (const m of allMatches) dbByNum[m.match_number] = m;

  const teamsWithGame = new Set();
  for (const m of groupMatches.filter(m => m.status === 'finished')) {
    teamsWithGame.add(m.home_team);
    teamsWithGame.add(m.away_team);
  }
  const allTeams = new Set(groupMatches.flatMap(m => [m.home_team, m.away_team]));
  const allTeamsPlayed = allTeams.size > 0 && teamsWithGame.size >= allTeams.size;
  const koFinished     = koMatches.filter(m => m.status === 'finished').length;

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
    <div className="space-y-2">
      {!allTeamsPlayed && (
        <div className="card border-brand-gold/20 bg-brand-gold/5 py-3 px-4 flex items-start gap-3">
          <span className="text-brand-gold text-base leading-none mt-0.5">ⓘ</span>
          <div>
            <p className="text-sm font-semibold text-gray-200">Positions update after every team plays once</p>
            <p className="text-xs text-gray-400 mt-0.5">{teamsWithGame.size} of {allTeams.size} teams have played their first match</p>
          </div>
        </div>
      )}
      {allTeamsPlayed && koFinished > 0 && (
        <p className="text-gray-400 text-xs">{koFinished} of {koMatches.length} knockout matches played</p>
      )}
      <div className="overflow-x-auto pb-4">
        <div style={{ width: TW, minWidth: TW }} className="mx-auto">
          <div className="relative mb-2" style={{ height: 18 }}>
            {BRACKET_LABELS.map(({ label, x }, i) => (
              <span key={i}
                className="absolute flex justify-center text-[10px] font-bold text-gray-400 uppercase tracking-wider"
                style={{ left: x, width: CW }}>
                {label}
              </span>
            ))}
          </div>
          <div className="relative" style={{ width: TW, height: H }}>
            <BracketLines />
            {cards.map(({ num, x, y, flip }) => (
              <div key={num} style={{ position: 'absolute', left: x, top: y }}>
                <BCard matchNum={num} dbByNum={dbByNum} projMap={projMap} allTeamsPlayed={allTeamsPlayed} flip={flip} />
              </div>
            ))}
            <img
              src="/wc-logos/world-cup-trophy.png"
              alt="World Cup Trophy"
              style={{
                position: 'absolute',
                left: FINAL + CW / 2,
                top: yc.sf() + CH / 2 + (H - yc.sf() - CH / 2) / 2,
                transform: 'translate(-50%, -50%)',
                width: 140,
                height: 'auto',
                opacity: 0.95,
              }}
            />
          </div>
          <div className="flex justify-center mt-6">
            <div className="text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">3rd Place</p>
              <BCard matchNum={103} dbByNum={dbByNum} projMap={projMap} allTeamsPlayed={allTeamsPlayed} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'groups',   label: 'Groups' },
  { id: 'bracket',  label: 'Bracket' },
];

export default function LiveResults() {
  const [matches, setMatches] = useState([]);
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('calendar');
  const [filter,  setFilter]  = useState('all');
  const [pendingScrollToToday, setPendingScrollToToday] = useState(false);

  function load() {
    Promise.all([api.getMatches(), api.getGroups()])
      .then(([mts, grps]) => {
        setMatches(mts);
        setGroups(grps);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const hasLive = matches.some(m => m.status === 'live');
  useEffect(() => {
    const t = setInterval(load, hasLive ? 10_000 : 30_000);
    return () => clearInterval(t);
  }, [hasLive]);

  const played = matches.filter(m => m.status === 'finished').length;
  const liveNow = matches.filter(m => m.status === 'live').length;
  const total  = matches.length;
  const koPhases = KO_PHASES.filter(p => matches.some(m => m.group_name === p));

  // Reset filter when switching tabs
  useEffect(() => { setFilter('all'); }, [tab]);

  const handleFilterChange = (value) => {
    setFilter(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollToToday = () => {
    if (filter !== 'all') handleFilterChange('all');
    setPendingScrollToToday(true);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
  );

  return (
    <div className="space-y-6">
      <div className="sticky top-14 sm:top-16 z-20 bg-brand-navy -mx-3 px-3 sm:-mx-6 sm:px-6 -mt-6 sm:-mt-8 pt-6 sm:pt-3 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">Live Results</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {played} results · {liveNow > 0 && <><span className="text-emerald-400 font-bold">{liveNow} live</span> · </>}{total - played - liveNow} upcoming · updates every 30s
            </p>
            <p className={`text-gray-400 text-xs mt-0.5 ${tab !== 'bracket' ? 'invisible' : ''}`}>Projected from live standings</p>
          </div>
          <div className="flex w-full sm:w-auto rounded-lg overflow-hidden border border-brand-border">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: 'instant' }); }}
                className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold transition-all ${
                  tab === t.id ? 'bg-brand-gold text-brand-navy' : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'calendar' && (
          <div className="mt-3 space-y-2">
            <div className="sm:hidden space-y-1.5">
              <div className="flex gap-1.5">
                <FilterBtn value="all" active={filter} onChange={handleFilterChange} compact stretch>All</FilterBtn>
                {groups.slice(0, 6).map(g => (
                  <FilterBtn key={g} value={g} active={filter} onChange={handleFilterChange} compact stretch>{g}</FilterBtn>
                ))}
              </div>
              <div className="flex gap-1.5">
                {groups.slice(6).map(g => (
                  <FilterBtn key={g} value={g} active={filter} onChange={handleFilterChange} compact stretch>{g}</FilterBtn>
                ))}
              </div>
            </div>
            <div className="hidden sm:flex flex-wrap gap-1.5">
              <FilterBtn value="all" active={filter} onChange={handleFilterChange} stretch>All</FilterBtn>
              {groups.map(g => (
                <FilterBtn key={g} value={g} active={filter} onChange={handleFilterChange} stretch>{g}</FilterBtn>
              ))}
              {koPhases.length > 0 && (
                <span className="w-px bg-brand-border self-stretch mx-1" />
              )}
              {koPhases.map(p => (
                <FilterBtn key={p} value={p} active={filter} onChange={handleFilterChange} stretch>{p}</FilterBtn>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleScrollToToday}
                className="px-3 py-1 rounded-lg text-xs font-bold transition-all bg-brand-card border border-brand-gold/40 text-brand-gold hover:border-brand-gold hover:bg-brand-gold/10"
              >
                ↓ Latest
              </button>
            </div>
          </div>
        )}
      </div>

      {tab === 'groups'   && <GroupsTab   matches={matches} groups={groups} />}
      {tab === 'calendar' && <CalendarTab
        matches={matches}
        filter={filter}
        pendingScrollToToday={pendingScrollToToday}
        setPendingScrollToToday={setPendingScrollToToday}
      />}
      {tab === 'bracket'  && <BracketTab  allMatches={matches} />}
    </div>
  );
}
