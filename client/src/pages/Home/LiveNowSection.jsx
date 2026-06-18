import { useState } from 'react';
import Flag from '../../components/Flag';
import { VENUE_BY_MATCH } from '../../venueData';
import { TeamName } from './MatchRow';
import PredictionsModal from '../../components/PredictionsModal';

function parseScorers(raw) {
  if (!raw || raw === 'null') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(s => ({ name: s.name ?? String(s), minute: s.minute ?? null }));
    if (typeof parsed === 'string') raw = parsed;
  } catch {}
  return raw.replace(/[{}"“”‘’]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(part => {
    const m = part.match(/^(.*?)\s+(\d+(?:\+\d+)?)['’]?["“”]?$/);
    return m ? { name: m[1].trim(), minute: m[2] } : { name: part, minute: null };
  });
}

function parseMinute(m) {
  if (m == null) return 999;
  const parts = String(m).split('+');
  return parseInt(parts[0], 10) + (parts[1] ? parseInt(parts[1], 10) / 100 : 0);
}

function formatMinute(min) {
  const s = String(min);
  const m = s.match(/^(\d+(?:\+\d+)?)\s*(\(p\))?$/i);
  return m ? ` ${m[1]}'${m[2] ? ' (p)' : ''}` : ` ${s}'`;
}

function LiveMatchCard({ match }) {
  const [showPreds, setShowPreds] = useState(false);
  const venue = VENUE_BY_MATCH[match.match_number] || match.venue;
  const homeScorers = parseScorers(match.home_scorers).sort((a, b) => parseMinute(a.minute) - parseMinute(b.minute));
  const awayScorers = parseScorers(match.away_scorers).sort((a, b) => parseMinute(a.minute) - parseMinute(b.minute));
  const showScorers = homeScorers.length === (match.home_score ?? 0)
    && awayScorers.length === (match.away_score ?? 0)
    && (homeScorers.length > 0 || awayScorers.length > 0);

  return (
    <div className="py-2 px-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span className="text-lg font-black text-white text-right leading-tight truncate">
            <TeamName name={match.home_team} code={match.home_code} />
          </span>
          <Flag code={match.home_code} name={match.home_team} className="w-12 h-12 shrink-0" />
        </div>
        <div className="shrink-0 px-2">
          <span className="font-black text-4xl text-white tabular-nums">
            {match.home_score}–{match.away_score}
          </span>
        </div>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Flag code={match.away_code} name={match.away_team} className="w-12 h-12 shrink-0" />
          <span className="text-lg font-black text-white leading-tight truncate">
            <TeamName name={match.away_team} code={match.away_code} />
          </span>
        </div>
      </div>

      {showScorers && (
        <div className="mt-2 space-y-0.5">
          {Array.from({ length: Math.max(homeScorers.length, awayScorers.length) }, (_, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-400" style={{ minHeight: '1.5em' }}>
              <div className="flex-1 flex items-center justify-end gap-1">
                {homeScorers[i] ? (
                  <>
                    <span>{homeScorers[i].name}{homeScorers[i].minute != null ? formatMinute(homeScorers[i].minute) : ''}</span>
                    <img src="/wc-logos/trionda.webp" alt="goal" className="w-[1em] h-[1em] shrink-0" />
                  </>
                ) : null}
              </div>
              <div className="shrink-0 px-2 flex items-center justify-center">
                <span className="w-px h-3 bg-brand-border/60" />
              </div>
              <div className="flex-1 flex items-center gap-1">
                {awayScorers[i] ? (
                  <>
                    <img src="/wc-logos/trionda.webp" alt="goal" className="w-[1em] h-[1em] shrink-0" />
                    <span>{awayScorers[i].name}{awayScorers[i].minute != null ? formatMinute(awayScorers[i].minute) : ''}</span>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {venue && (
        <div className="mt-2 flex justify-center">
          <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-brand-border/60 text-xs text-gray-400 whitespace-nowrap">
            {venue}
          </span>
        </div>
      )}

      <div className="mt-3 flex justify-center">
        <button
          onClick={() => setShowPreds(true)}
          className="text-xs text-brand-gold/70 hover:text-brand-gold transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.356-3.789M9 20H4v-2a4 4 0 015.356-3.789M15 11a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          View predictions
        </button>
      </div>

      {showPreds && <PredictionsModal match={match} onClose={() => setShowPreds(false)} />}
    </div>
  );
}

export default function LiveNowSection({ matches }) {
  if (matches.length === 0) return null;
  return (
    <div className="card relative border border-emerald-500/70 bg-emerald-900/10 pt-8 pb-4">
      <div className="absolute top-3 left-4 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <h2 className="font-black text-sm text-emerald-400 tracking-wide">LIVE</h2>
      </div>
      <div className={matches.length > 1 ? 'grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-brand-border/40' : ''}>
        {matches.map(m => <LiveMatchCard key={m.id} match={m} />)}
      </div>
    </div>
  );
}
