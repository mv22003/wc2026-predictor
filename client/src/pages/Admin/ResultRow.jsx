import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import Flag from '../../components/Flag';
import { scorersJsonToArray, arrayToScorersJson } from './scorerUtils';

function ScorerInputs({ scorers, setScorers, count }) {
  if (count === 0) return <p className="text-xs text-gray-400 italic">No goals</p>;
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
  const [liveMinute, setLiveMinute] = useState(match.live_minute ?? '');
  const [outcome,  setOutcome] = useState(match.outcome ?? null);   // null | 'et' | 'pen'
  const [penHs, setPenHs] = useState(match.pen_home ?? '');
  const [penAs, setPenAs] = useState(match.pen_away ?? '');
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [resetting, setResetting] = useState(false);
  const hasScore = match.status === 'finished' || match.status === 'live';
  const [homeScorers, setHomeScorers]   = useState(() => hasScore ? scorersJsonToArray(match.home_scorers) : []);
  const [awayScorers, setAwayScorers]   = useState(() => hasScore ? scorersJsonToArray(match.away_scorers) : []);
  const [scorerSaving, setScorerSaving] = useState(false);
  const [scorerSaved,  setScorerSaved]  = useState(false);

  const isFinished = match.status === 'finished';
  const isLive     = match.status === 'live';
  const isLocked   = !!match.manual_lock;
  const isKO       = match.phase !== 'group';
  const isDraw     = isKO && hs !== '' && as_ !== '' && Number(hs) === Number(as_);
  // KO draws must be resolved by penalties — block save if pen data is incomplete or tied
  const drawBlocked = isDraw && (
    outcome !== 'pen' ||
    penHs === '' || penAs === '' ||
    Number(penHs) === Number(penAs)
  );
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
      setLiveMinute('');
      setOutcome(null);
      setPenHs('');
      setPenAs('');
      onSaved?.();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setResetting(false);
    }
  }

  // upcoming → live (keeps status as 'live')
  async function goLive() {
    setSaving(true);
    try {
      await api.setMatchLive(adminKey, match.id, 0, 0, liveMinute || null);
      setHs('0');
      setAs('0');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  // live → update live score/minute (keeps status as 'live')
  async function updateLive() {
    if (hs === '' || as_ === '') return;
    setSaving(true);
    try {
      await api.setMatchLive(adminKey, match.id, parseInt(hs, 10), parseInt(as_, 10), liveMinute || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  function effectiveOutcome() {
    if (!isKO) return null;
    if (outcome === 'pen' && !isDraw) return null;  // Penalties only on draws
    return outcome || null;
  }

  function penScores() {
    if (effectiveOutcome() !== 'pen') return [null, null];
    return [penHs === '' ? null : parseInt(penHs, 10), penAs === '' ? null : parseInt(penAs, 10)];
  }

  // live → finished
  async function finishLive() {
    if (hs === '' || as_ === '') return;
    setSaving(true);
    const [ph, pa] = penScores();
    try {
      await api.updateResult(adminKey, match.id, parseInt(hs, 10), parseInt(as_, 10), effectiveOutcome(), ph, pa);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  // upcoming → finished  OR  finished → update finished
  async function save() {
    if (hs === '' || as_ === '') return;
    setSaving(true);
    const [ph, pa] = penScores();
    try {
      if (isFinished) {
        await api.updateResult(adminKey, match.id, parseInt(hs, 10), parseInt(as_, 10), effectiveOutcome(), ph, pa);
      } else {
        await api.submitResult(adminKey, match.id, parseInt(hs, 10), parseInt(as_, 10), effectiveOutcome(), ph, pa);
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
          <div className="flex items-center gap-1 flex-wrap">
            <span className="tag bg-brand-border text-gray-300 text-xs whitespace-nowrap">{match.group_name} · M{match.match_number}</span>
            {isLive && (
              <span className="tag bg-red-500/20 text-red-400 text-[10px] border border-red-500/30 animate-pulse whitespace-nowrap">
                LIVE
              </span>
            )}
            {isLocked && (
              <button
                onClick={() => api.setMatchLock(adminKey, match.id, false).then(onSaved)}
                title="Manually locked — API sync skips this match. Click to unlock."
                className="tag bg-orange-500/20 text-orange-400 text-[10px] border border-orange-500/30
                           hover:bg-orange-500/30 cursor-pointer transition-colors whitespace-nowrap"
              >
                🔒
              </button>
            )}
          </div>
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
              className="w-10 h-9 text-center font-black tabular-nums rounded bg-brand-navy border border-brand-border
                         focus:border-brand-gold focus:outline-none text-base"
              value={hs}
              onChange={e => setHs(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            />
            <span className="text-gray-400">–</span>
            <input
              type="number" min="0" max="99"
              className="w-10 h-9 text-center font-black tabular-nums rounded bg-brand-navy border border-brand-border
                         focus:border-brand-gold focus:outline-none text-base"
              value={as_}
              onChange={e => setAs(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            />
          </div>

          {/* ET / PEN selector — KO matches only */}
          {isKO && (
            <div className="mt-1.5 flex flex-col items-center gap-1">
              <div className="flex gap-1">
                {[['et', 'ET'], ['pen', 'Pen']].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setOutcome(o => o === val ? null : val)}
                    disabled={val === 'pen' && !isDraw}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                      outcome === val
                        ? val === 'pen'
                          ? 'bg-orange-500/20 text-orange-300 border-orange-500/50'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                        : 'bg-brand-border/40 text-gray-400 border-brand-border/60 hover:text-gray-200'
                    } disabled:opacity-40`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {outcome === 'pen' && (
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="number" min="0" max="99"
                    placeholder="0"
                    className="w-8 h-6 text-center text-xs font-bold rounded bg-brand-navy border border-orange-500/40
                               text-orange-300 focus:border-orange-400 focus:outline-none"
                    value={penHs}
                    onChange={e => setPenHs(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  />
                  <span className="text-[10px] text-gray-500">pen</span>
                  <input
                    type="number" min="0" max="99"
                    placeholder="0"
                    className="w-8 h-6 text-center text-xs font-bold rounded bg-brand-navy border border-orange-500/40
                               text-orange-300 focus:border-orange-400 focus:outline-none"
                    value={penAs}
                    onChange={e => setPenAs(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  />
                </div>
              )}
            </div>
          )}

          {drawBlocked && (
            <p className="mt-1 text-[10px] text-orange-400/80 text-center leading-tight">
              {outcome === 'pen' ? 'Enter non-equal pen scores' : 'Select ET or Pen'}
            </p>
          )}

          {isLive && (
            <div className="flex items-center justify-center mt-1 gap-0.5">
              <input
                type="text"
                placeholder="min"
                className="w-14 text-center text-xs bg-brand-navy border border-yellow-500/40 rounded px-1 py-0.5
                           text-yellow-400 focus:border-yellow-400 focus:outline-none"
                value={liveMinute}
                onChange={e => setLiveMinute(e.target.value)}
              />
              <span className="text-xs text-yellow-400">'</span>
            </div>
          )}
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
          {isLive ? (
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={updateLive}
                disabled={saving || resetting || hs === '' || as_ === ''}
                className={`py-2 rounded text-xs font-bold transition-all disabled:opacity-40 ${
                  saved
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/30'
                }`}
              >
                {saved ? '✓' : saving ? '…' : 'Update'}
              </button>
              <button
                onClick={finishLive}
                disabled={saving || resetting || hs === '' || as_ === '' || drawBlocked}
                className="py-2 rounded text-xs font-bold transition-all
                           bg-emerald-500/20 text-emerald-400 border border-emerald-500/40
                           hover:bg-emerald-500/30 disabled:opacity-40"
                title={drawBlocked ? 'KO draw requires Pen result' : 'Mark as finished'}
              >
                End
              </button>
              <button
                onClick={reset}
                disabled={resetting || saving}
                title="Reset to upcoming"
                className="py-2 rounded text-xs font-bold transition-all
                           bg-red-500/10 text-red-400 border border-red-500/30
                           hover:bg-red-500/20 disabled:opacity-40"
              >
                {resetting ? '…' : '✕'}
              </button>
              <button
                onClick={() => setOpenScorerId(o => o === match.id ? null : match.id)}
                title="Edit goalscorers"
                className={`py-2 rounded text-xs font-bold transition-all border ${
                  scorersOpen
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                    : 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20'
                }`}
              >
                ⚽
              </button>
            </div>
          ) : isFinished ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={save}
                disabled={saving || resetting || hs === '' || as_ === '' || drawBlocked}
                title={drawBlocked ? 'KO draw requires Pen result' : undefined}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all disabled:opacity-40 ${
                  saved
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-sky-500/20 text-sky-400 border border-sky-500/40 hover:bg-sky-500/30'
                }`}
              >
                {saved ? '✓' : saving ? '…' : 'Update'}
              </button>
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
            </div>
          ) : (
            // upcoming
            <div className="flex items-center gap-1.5">
              <button
                onClick={save}
                disabled={saving || resetting || hs === '' || as_ === '' || drawBlocked}
                title={drawBlocked ? 'KO draw requires Pen result' : undefined}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all disabled:opacity-40 ${
                  saved
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-brand-gold text-brand-navy hover:brightness-110'
                }`}
              >
                {saved ? '✓' : saving ? '…' : 'Save'}
              </button>
              <button
                onClick={goLive}
                disabled={saving || resetting}
                title="Set match as live"
                className="px-2 py-1.5 rounded text-xs font-bold transition-all
                           bg-red-500/20 text-red-400 border border-red-500/40
                           hover:bg-red-500/30 disabled:opacity-40"
              >
                ⚡
              </button>
            </div>
          )}
        </td>
      </tr>

      {scorersOpen && (isFinished || isLive) && (
        <tr className="border-b border-brand-border/30 bg-brand-navy/20">
          <td colSpan={7} className="px-4 py-3">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{match.home_team}</p>
                <ScorerInputs scorers={homeScorers} setScorers={setHomeScorers} count={homeCount} />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{match.away_team}</p>
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
