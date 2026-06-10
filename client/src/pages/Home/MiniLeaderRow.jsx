export default function MiniLeaderRow({ row, hasResults, className = '' }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-brand-border last:border-0 ${className}`}>
      <span className={`w-8 text-center font-bold text-sm ${hasResults ? `rank-${row.rank}` : 'text-gray-400'}`}>
        {hasResults ? `#${row.rank}` : '—'}
      </span>
      <span className="flex-1 font-semibold truncate">{row.name}</span>
      <span className="font-black text-brand-gold text-lg text-right">
        {row.total_points}
        <span className="text-xs text-gray-400 font-normal ml-0.5">pts</span>
      </span>
    </div>
  );
}
