import Flag from '../../components/Flag';

export function TeamName({ name, code }) {
  return (
    <>
      <span className="sm:hidden">{code}</span>
      <span className="hidden sm:inline">{name}</span>
    </>
  );
}

const FIFA_PILL = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/5 border border-brand-border/60 text-[9px] text-gray-400 whitespace-nowrap';

export default function MatchRow({ match }) {
  const live      = match.status === 'live';
  const finished  = match.status === 'finished';
  const d         = match.match_date ? new Date(match.match_date) : null;
  const dateStr   = d
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'TBD';
  const shortDate = d
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : 'TBD';

  return (
    <div className="py-3 border-b border-brand-border last:border-0">
      <div className="flex items-end gap-2">
        {/* left: group tag */}
        <span className="tag bg-brand-border text-gray-300 w-10 sm:w-20 text-center shrink-0 whitespace-nowrap text-xs self-end">
          <span className="sm:hidden">{match.group_name}</span>
          <span className="hidden sm:inline">{match.group_name} · M{match.match_number}</span>
        </span>

        {/* center: home · score · away */}
        <div className="flex-1 flex items-end gap-2 min-w-0">
          {/* home */}
          <div className="flex-1 min-w-0 flex flex-col items-end gap-1">
            {match.home_ranking != null && (
              <span className={FIFA_PILL}>
                <img src="/wc-logos/FIFA_Logo_White_Generic.webp" alt="FIFA" className="h-2 w-auto opacity-70" />
                #{match.home_ranking}
              </span>
            )}
            <span className={`font-semibold text-sm flex items-center gap-1.5 justify-end min-w-0 w-full ${live || finished ? 'text-white' : 'text-gray-300'}`}>
              <span className="truncate text-right"><TeamName name={match.home_team} code={match.home_code} /></span>
              <Flag code={match.home_code} name={match.home_team} className="w-6 h-6 shrink-0" />
            </span>
          </div>

          {/* score — FT/LIVE above score on mobile */}
          <div className="w-12 shrink-0 flex flex-col items-center justify-end gap-0.5">
            {finished && (
              <span className="sm:hidden text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">FT</span>
            )}
            {live && (
              <span className="sm:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[9px] font-semibold text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />LIVE
              </span>
            )}
            {finished ? (
              <span className="font-black text-brand-gold text-lg tabular-nums">{match.home_score}–{match.away_score}</span>
            ) : live ? (
              <span className="font-black text-white text-lg tabular-nums">{match.home_score}–{match.away_score}</span>
            ) : (
              <span className="text-gray-400 text-xs">vs</span>
            )}
          </div>

          {/* away */}
          <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
            {match.away_ranking != null && (
              <span className={FIFA_PILL}>
                <img src="/wc-logos/FIFA_Logo_White_Generic.webp" alt="FIFA" className="h-2 w-auto opacity-70" />
                #{match.away_ranking}
              </span>
            )}
            <span className={`font-semibold text-sm flex items-center gap-1.5 min-w-0 w-full ${live || finished ? 'text-white' : 'text-gray-300'}`}>
              <Flag code={match.away_code} name={match.away_team} className="w-6 h-6 shrink-0" />
              <span className="truncate"><TeamName name={match.away_team} code={match.away_code} /></span>
            </span>
          </div>
        </div>

        {/* right: FT / LIVE / date — desktop only */}
        <span className="hidden sm:flex w-20 shrink-0 items-center justify-end">
          {live ? (
            <span className="inline-flex items-center justify-center gap-1 w-12 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/60 text-xs font-semibold text-emerald-400 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              LIVE
            </span>
          ) : finished ? (
            <span className="tag pts-exact text-xs inline-flex justify-center w-12">FT</span>
          ) : (
            <span className="text-xs text-gray-400 whitespace-nowrap">{dateStr}</span>
          )}
        </span>
      </div>
    </div>
  );
}
