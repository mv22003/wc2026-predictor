import Flag from '../../components/Flag';

export function TeamName({ name, code }) {
  return (
    <>
      <span className="sm:hidden">{code}</span>
      <span className="hidden sm:inline">{name}</span>
    </>
  );
}

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
      <div className="flex items-center gap-2">
        {/* left: group tag */}
        <span className="tag bg-brand-border text-gray-300 w-10 sm:w-20 text-center shrink-0 whitespace-nowrap text-xs">
          <span className="sm:hidden">{match.group_name}</span>
          <span className="hidden sm:inline">{match.group_name} · M{match.match_number}</span>
        </span>

        {/* center: home · score · away */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className={`flex-1 font-semibold text-sm flex items-center gap-1.5 justify-end min-w-0 ${live || finished ? 'text-white' : 'text-gray-300'}`}>
            <span className="truncate text-right"><TeamName name={match.home_team} code={match.home_code} /></span>
            <Flag code={match.home_code} name={match.home_team} className="w-6 h-6 shrink-0" />
          </span>
          <span className="w-12 shrink-0 flex items-center justify-center">
            {finished ? (
              <span className="font-black text-brand-gold tabular-nums">{match.home_score} – {match.away_score}</span>
            ) : live ? (
              <span className="font-black text-white tabular-nums">{match.home_score} – {match.away_score}</span>
            ) : (
              <span className="text-gray-400 text-xs">vs</span>
            )}
          </span>
          <span className={`flex-1 font-semibold text-sm flex items-center gap-1.5 min-w-0 ${live || finished ? 'text-white' : 'text-gray-300'}`}>
            <Flag code={match.away_code} name={match.away_team} className="w-6 h-6 shrink-0" />
            <span className="truncate"><TeamName name={match.away_team} code={match.away_code} /></span>
          </span>
        </div>

        {/* right: FT / live / date — same width as left to keep score centered */}
        <span className="w-10 sm:w-20 shrink-0 flex items-center justify-end">
          {live ? (
            <span className="inline-flex items-center justify-center gap-1 w-12 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/60 text-xs font-semibold text-emerald-400 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              {match.live_minute != null ? `${match.live_minute}'` : 'LIVE'}
            </span>
          ) : finished ? (
            <span className="tag pts-exact text-xs inline-flex justify-center w-12">FT</span>
          ) : (
            <>
              <span className="text-xs text-gray-400 whitespace-nowrap sm:hidden">{shortDate}</span>
              <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:block">{dateStr}</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
