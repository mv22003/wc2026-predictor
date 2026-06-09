import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import Flag from '../../components/Flag';
import { scorersJsonToArray, arrayToScorersJson } from './scorerUtils';

function ScorerInputs({ scorers, setScorers, count }) {
  if (count === 0) return <p className="text-xs text-gray-600 italic">No goals</p>;
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="flex gap-1.5">
      <input
        type="text"
        className="flex-1 min-w-0 bg-brand-navy border border-brand-border rounded px-2 py-1.5 text-xs text-gray-300
                   focus:border-brand-gold focus:outline-none"
        value={scorers[i]?.name ?? ''}
        onChange={e => setScorers(prev => {
          const next = [...prev];
          while (next.length <= i) next.push({ name: '', minute: '' });
          next[i] = { ...next[i], name: e.target.value };
          return next;
        })}
      />
      <input
        type="text"
        className="w-16 shrink-0 bg-brand-navy border border-brand-border rounded px-2 py-1.5 text-xs text-gray-300
                   focus:border-brand-gold focus:outline-none text-center"
        value={scorers[i]?.minute ?? ''}
        onChange={e => setScorers(prev => {
          const next = [...prev];
          while (next.length <= i) next.push({ name: '', minute: '' });
          next[i] = { ...next[i], minute: e.target.value };
          return next;
        })}
      />
    </div>
  ));
}

export default function ResultRow({ match, adminKey, onSaved, openScorerId, setOpenScorerId }) {
  const [hs,  setHs]  = useState(match.home_score ?? '');
  const [as_, setAs]  = useState(match.away_score ?? '');
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [resetting, setResetting] = useState(false);
  const [homeScorers, setHomeScorers]   = useState(() => scorersJsonToArray(match.home_scorers));
  const [awayScorers, setAwayScorers]   = useState(() => scorersJsonToArray(match.away_scorers));
  const [scorerSaving, setScorerSaving] = useState(false);
  const [scorerSaved,  setScorerSaved]  = useState(false);

  const isFinished  = match.status === 'finished';
  const isLive      = match.status === 'live';
  const scorersOpen = openScorerId === match.id;
  const homeCount   = (Number.isInteger(+hs)  && +hs  >= 0) ? +hs  : 0;
  const awayCount   = (Number.isInteger(+as_) && +as_ >= 0) ? +as_ : 0;

  const homeRef      = useRef(homeScorers);
  const awayRef      = useRef(awayScorers);
  const homeCountRef = useRef(homeCount);
  const awayCountRef = useRef(awayCount);
  const originalRef  = useRef({
    home: scorersJsonToArray(match.home_scorers),
    away: scorersJsonToArray(match.away_scorers),
  });
  const wasOpenRef = useRef(false);

  useEffect(() => { homeRef.current = homeScorers; },     [homeScorers]);
  useEffect(() => { awayRef.current = awayScorers; },     [awayScorers]);
  useEffect(() => { homeCountRef.current = homeCount; },  [homeCount]);
  useEffect(() => { awayCountRef.current = awayCount; },  [awayCount]);

  useEffect(() => {
    if (wasOpenRef.current && !scorersOpen) {
      const home = homeRef.current.slice(0, homeCountRef.current);
      const away = awayRef.current.slice(0, awayCountRef.current);
      if (
        JSON.stringify(home) !== JSON.stringify(originalRef.current.home) ||
        JSON.stringify(away) !== JSON.stringify(originalRef.current.away)
      ) {
        originalRef.current = { home, away };
        setScorerSaving(true);
        api.updateScorers(adminKey, match.id, arrayToScorersJson(home), arrayToScorersJson(away))
          .then(() => { setScorerSaved(true); setTimeout(() => setScorerSaved(false), 2000); })
          .catch(e => alert('Auto-save error: ' + e.message))
          .finally(() => setScorerSaving(false));
      }
    }
    wasOpenRef.current = scorersOpen;
  }, [scorersOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reset() {
    setResetting(true);
    try {
      await api.resetResult(adminKey, match.id);
      setHs('');
      setAs('');
      onSaved?.();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setResetting(false);
    }
  }

  async function save() {
    if (hs === '' || as_ === '') return;
    setSaving(true);
    try {
      if (isFinished) {
        await api.updateResult(adminKey, match.id, parseInt(hs), parseInt(as_));
      } else {
        await api.submitResult(adminKey, match.id, parseInt(hs), parseInt(as_));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveScorers() {
    setScorerSaving(true);
    try {
      await api.updateScorers(
        adminKey, match.id,
        arrayToScorersJson(homeScorers.slice(0, homeCount)),
        arrayToScorersJson(awayScorers.slice(0, awayCount)),
      );
      setScorerSaved(true);
      setTimeout(() => setScorerSaved(false), 2000);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setScorerSaving(false);
    }
  }

  const d = match.match_date ? new Date(match.match_date) : null;
  const dateStr = d
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'TBD';

  return (
    <>
      <tr className="border-b border-brand-border/50 last:border-0 hover:bg-white/3 transition-colors">
        <td className="px-3 py-3">
          <span className="tag bg-brand-border text-gray-300 text-xs">{match.group_name}</span>
        </td>
        <td className="px-3 py-3 text-sm hidden md:table-cell text-gray-400">{dateStr}</td>
        <td className="px-3 py-3">
          <div className="flex items-center justify-end gap-2 text-sm font-semibold">
            <span className="hidden sm:inline">{match.home_team}</span>
            <span className="sm:hidden">{match.home_code}</span>
            <Flag code={match.home_code} name={match.home_team} className="w-6 h-6" />
          </div>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center justify-center gap-1.5">
            <input
              type="number" min="0" max="99"
              className="w-10 h-9 text-center font-bold rounded bg-brand-navy border border-brand-border
                         focus:border-brand-gold focus:outline-none text-sm"
              value={hs}
              onChange={e => setHs(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            />
            <span className="text-gray-600">–</span>
            <input
              type="number" min="0" max="99"
              className="w-10 h-9 text-center font-bold rounded bg-brand-navy border border-brand-border
                         focus:border-brand-gold focus:outline-none text-sm"
              value={as_}
              onChange={e => setAs(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            />
          </div>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Flag code={match.away_code} name={match.away_team} className="w-6 h-6" />
            <span className="hidden sm:inline">{match.away_team}</span>
            <span className="sm:hidden">{match.away_code}</span>
          </div>
        </td>
        <td className="px-3 py-3 text-xs text-gray-400 hidden lg:table-cell">
          {match.prediction_count} preds
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={save}
              disabled={saving || resetting || hs === '' || as_ === ''}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                saved      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                isFinished ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 hover:bg-sky-500/30' :
                             'bg-brand-gold text-brand-navy hover:brightness-110'
              } disabled:opacity-40`}
            >
              {saved ? '✓' : saving ? '…' : isFinished ? 'Update' : 'Save'}
            </button>

            {isFinished && (
              <button
                onClick={reset}
                disabled={resetting || saving}
                title="Reset result"
                className="px-2 py-1.5 rounded text-xs font-bold transition-all
                           bg-red-500/10 text-red-400 border border-red-500/30
                           hover:bg-red-500/20 disabled:opacity-40"
              >
                {resetting ? '…' : '✕'}
              </button>
            )}

            {(isFinished || isLive) && (
              <button
                onClick={() => setOpenScorerId(o => o === match.id ? null : match.id)}
                title="Edit goalscorers"
                className={`px-2 py-1.5 rounded text-xs font-bold transition-all border ${
                  scorersOpen
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                    : 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20'
                }`}
              >
                ⚽
              </button>
            )}
          </div>
        </td>
      </tr>

      {scorersOpen && (isFinished || isLive) && (
        <tr className="border-b border-brand-border/30 bg-brand-navy/20">
          <td colSpan={7} className="px-4 py-3">
            <div className="flex gap-6">
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{match.home_team}</p>
                <ScorerInputs scorers={homeScorers} setScorers={setHomeScorers} count={homeCount} />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{match.away_team}</p>
                <ScorerInputs scorers={awayScorers} setScorers={setAwayScorers} count={awayCount} />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={saveScorers}
                disabled={scorerSaving}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all shrink-0 disabled:opacity-40 ${
                  scorerSaved
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30'
                }`}
              >
                {scorerSaved ? '✓ Saved' : scorerSaving ? '…' : 'Save scorers'}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
