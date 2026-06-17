import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import Flag from './Flag';

function calcLivePoints(predHome, predAway, homeScore, awayScore) {
  if (homeScore == null || awayScore == null) return null;
  const predGD   = predHome - predAway;
  const actualGD = homeScore - awayScore;
  const predResult   = predGD > 0 ? 'H' : predGD < 0 ? 'A' : 'D';
  const actualResult = actualGD > 0 ? 'H' : actualGD < 0 ? 'A' : 'D';
  if (predHome === homeScore && predAway === awayScore) return 5;
  if (predResult === actualResult && predGD === actualGD) return 3;
  if (predResult === actualResult) return 1;
  return 0;
}

function PtsPill({ pts }) {
  const base = 'tag font-bold text-center shrink-0 w-9 text-xs';
  if (pts === 5) return <span className={`${base} pts-exact`}>+5</span>;
  if (pts === 3) return <span className={`${base} pts-correct`}>+3</span>;
  if (pts === 1) return <span className={`${base} bg-amber-800/30 text-amber-500 border border-amber-700/30`}>+1</span>;
  if (pts === 0) return <span className={`${base} pts-zero`}>0</span>;
  return <span className={`${base} pts-zero`}>–</span>;
}

export default function PredictionsModal({ match, onClose }) {
  const [preds, setPreds] = useState(null);
  const [error, setError] = useState(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    api.getMatchPredictions(match.id)
      .then(setPreds)
      .catch(e => setError(e.message));
  }, [match.id]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleClose = useCallback(() => {
    if (window.innerWidth < 640) {
      setClosing(true);
      setTimeout(onClose, 260);
    } else {
      onClose();
    }
  }, [onClose]);

  const finished = match.status === 'finished';
  const live     = match.status === 'live';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className={`absolute inset-0 bg-black/70 backdrop-blur-sm ${closing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={handleClose} />
      <div className={`relative bg-brand-card border border-brand-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col h-[72vh] sm:h-auto sm:max-h-[80vh] ${closing ? 'animate-slide-down sm:animate-none' : 'animate-slide-up sm:animate-none'}`}>

        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-4 border-b border-brand-border shrink-0">
          <div className="w-7 shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
            <div className="flex items-center w-full gap-1">
              <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
                <span className="font-bold text-base truncate min-w-0 text-right">{match.home_code}</span>
                <Flag code={match.home_code} name={match.home_team} className="w-7 h-7 shrink-0" />
              </div>
              <div className="shrink-0 w-16 sm:w-20 text-center">
                {finished ? (
                  <span className="font-black text-brand-gold text-2xl tabular-nums">{match.home_score}–{match.away_score}</span>
                ) : live ? (
                  <span className="font-black text-white text-2xl tabular-nums">{match.home_score}–{match.away_score}</span>
                ) : (
                  <span className="text-gray-400 text-sm font-bold">vs</span>
                )}
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <Flag code={match.away_code} name={match.away_team} className="w-7 h-7 shrink-0" />
                <span className="font-bold text-base truncate min-w-0">{match.away_code}</span>
              </div>
            </div>
            {live && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/50 text-[10px] font-black text-red-400 leading-none">
                <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse shrink-0" />
                {match.live_minute ? `${match.live_minute}'` : 'LIVE'}
              </span>
            )}
            {!finished && !live && (
              <span className="text-xs text-gray-500">
                {match.match_date ? new Date(match.match_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            )}
          </div>
          <button onClick={handleClose} className="shrink-0 self-start w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-base leading-none">✕</button>
        </div>

        {/* Sub-header */}
        <div className="px-4 py-2 border-b border-brand-border/50 shrink-0 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Predictions</span>
          {preds && <span className="text-xs text-gray-500">{preds.length} player{preds.length !== 1 ? 's' : ''}</span>}
        </div>

        {/* Column headers — always when there are predictions */}
        {preds?.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-brand-border/30 shrink-0">
            <span className="text-[10px] text-gray-600 w-5 shrink-0" />
            <span className="flex-1 text-[10px] text-gray-600 uppercase tracking-wide">Player</span>
            <span className="text-[10px] text-gray-600 uppercase tracking-wide w-14 text-center">Pred</span>
            <span className="text-[10px] text-gray-600 uppercase tracking-wide w-9 text-center">Pts</span>
          </div>
        )}

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 divide-y divide-brand-border/30">
          {error && <p className="text-center text-red-400 text-sm py-10">{error}</p>}
          {!error && preds === null && <p className="text-center text-gray-400 text-sm py-10 animate-pulse">Loading…</p>}
          {!error && preds?.length === 0 && <p className="text-center text-gray-400 text-sm py-10">No predictions submitted yet.</p>}
          {preds && (() => {
            const rows = preds.map(p => ({
              ...p,
              displayPts: finished
                ? p.points
                : live
                ? calcLivePoints(p.pred_home, p.pred_away, match.home_score, match.away_score)
                : null,
            }));
            if (live) {
              rows.sort((a, b) => (b.displayPts ?? -1) - (a.displayPts ?? -1) || a.user_name.localeCompare(b.user_name));
            }
            return rows.map((p, i) => {
              const pts = p.displayPts;
              const showPts = true;
              const scoreCls = (finished || live)
                ? pts === 5 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : pts === 3 ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                : pts === 1 ? 'border-amber-700/40 bg-amber-800/10 text-amber-400'
                : 'border-white/10 bg-white/5 text-gray-500'
                : 'border-brand-border/60 bg-white/5 text-gray-300';

              return (
                <div key={p.user_name} className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/5 transition-colors">
                  <span className="text-xs text-gray-600 w-5 shrink-0 text-right tabular-nums">{i + 1}</span>
                  <span className="flex-1 text-sm font-medium text-gray-200 truncate min-w-0">{p.user_name}</span>
                  <span className={`tabular-nums text-sm font-bold rounded-md px-2 py-0.5 w-14 text-center border shrink-0 ${scoreCls}`}>
                    {p.pred_home}–{p.pred_away}
                  </span>
                  {showPts && <PtsPill pts={pts} />}
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>,
    document.body
  );
}
