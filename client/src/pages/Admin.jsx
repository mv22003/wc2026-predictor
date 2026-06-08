import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import Flag from '../components/Flag';
import { R32_SLOTS, LATE_SLOTS, calcStandings, resolveTeam, resolveBest3rdSlots } from '../bracketUtils';

const LS_KEY = 'wc2026_admin_key';

// ── KO round definitions ──────────────────────────────────────────────────────
const KO_ROUNDS = [
  { phase: 'r32',   label: 'Round of 32',    nums: [73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88], prereq: null    },
  { phase: 'r16',   label: 'Round of 16',    nums: [89,90,91,92,93,94,95,96],                          prereq: 'r32'   },
  { phase: 'qf',    label: 'Quarter-finals', nums: [97,98,99,100],                                     prereq: 'r16'   },
  { phase: 'sf',    label: 'Semi-finals',    nums: [101,102],                                           prereq: 'qf'    },
  { phase: '3rd',   label: 'Third Place',    nums: [103],                                               prereq: 'sf'    },
  { phase: 'final', label: 'Final',          nums: [104],                                               prereq: 'sf'    },
];

// ── KO Management Panel ───────────────────────────────────────────────────────
function KOPanel({ matches, adminKey, onRefresh }) {
  const [creating, setCreating] = useState(null); // phase currently being created
  const [errors,   setErrors]   = useState({});

  const groupMatches = matches.filter(m => m.phase === 'group');
  const allGroupDone = groupMatches.length > 0 && groupMatches.every(m => m.status === 'finished');

  if (!allGroupDone) return null;

  // Build standings and lookup helpers
  const groups = [...new Set(groupMatches.map(m => m.group_name).filter(Boolean))].sort();
  const byGroup = {};
  for (const g of groups) byGroup[g] = calcStandings(groupMatches.filter(m => m.group_name === g));

  const dbByNum = {};
  for (const m of matches) dbByNum[m.match_number] = m;

  const best3rdMap = resolveBest3rdSlots(byGroup) || {};

  // Resolve projected teams for a match number
  function projectedTeams(num) {
    const slots = { ...R32_SLOTS, ...LATE_SLOTS }[num];
    if (!slots) return { home: null, away: null };
    function forSide(slot, side) {
      if (slot.type === 'best3rd') return best3rdMap[num]?.[side] ?? null;
      return resolveTeam(slot, byGroup, dbByNum);
    }
    return { home: forSide(slots.home, 'home'), away: forSide(slots.away, 'away') };
  }

  // Check prerequisites: all matches of a given phase are finished
  function phaseComplete(phase) {
    if (!phase) return true;
    const round = KO_ROUNDS.find(r => r.phase === phase);
    if (!round) return false;
    return round.nums.every(n => dbByNum[n]?.status === 'finished');
  }

  async function createRound(round) {
    setCreating(round.phase);
    setErrors(e => ({ ...e, [round.phase]: null }));

    const toCreate = round.nums.filter(n => !dbByNum[n]);
    if (toCreate.length === 0) { setCreating(null); return; }

    const payload = toCreate.map(num => {
      const { home, away } = projectedTeams(num);
      return {
        match_number: num,
        phase: round.phase,
        group_name: round.phase.toUpperCase(),
        home_code: home?.code ?? null,
        away_code: away?.code ?? null,
        match_date: null,
        venue: null,
      };
    }).filter(m => m.home_code && m.away_code);

    if (payload.length === 0) {
      setErrors(e => ({ ...e, [round.phase]: 'Some teams are still TBD — wait for more results.' }));
      setCreating(null);
      return;
    }

    try {
      await api.bulkMatches(adminKey, payload);
      onRefresh();
    } catch (err) {
      setErrors(e => ({ ...e, [round.phase]: err.message }));
    } finally {
      setCreating(null);
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-black">Knockout Management</h2>
      <p className="text-xs text-gray-500 -mt-1">
        Create match records for each KO round. Once created, enter scores in the Match Results table above.
      </p>

      {KO_ROUNDS.map(round => {
        const created  = round.nums.filter(n => dbByNum[n]);
        const finished = created.filter(n => dbByNum[n]?.status === 'finished');
        const allCreated  = created.length === round.nums.length;
        const prereqDone  = phaseComplete(round.prereq);
        const canCreate   = prereqDone && !allCreated;

        return (
          <div key={round.phase}
            className={`card p-0 overflow-hidden border ${allCreated ? 'border-brand-border' : prereqDone ? 'border-sky-700/40' : 'border-brand-border/30 opacity-50'}`}>

            {/* Round header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-brand-navy/40">
              <div className="flex items-center gap-3">
                <span className="font-black text-sm">{round.label}</span>
                <span className="text-xs text-gray-500">
                  {allCreated
                    ? `${finished.length}/${round.nums.length} finished`
                    : `${created.length}/${round.nums.length} created`}
                </span>
                {allCreated && finished.length === round.nums.length && (
                  <span className="text-xs text-emerald-400 font-bold">✓ complete</span>
                )}
                {!prereqDone && (
                  <span className="text-xs text-gray-600">locked — waiting for {round.prereq?.toUpperCase()} to finish</span>
                )}
              </div>

              {canCreate && (
                <button
                  onClick={() => createRound(round)}
                  disabled={creating === round.phase}
                  className="shrink-0 px-3 py-1.5 rounded text-xs font-bold bg-sky-500/20 text-sky-400
                             border border-sky-500/40 hover:bg-sky-500/30 disabled:opacity-50 transition-all"
                >
                  {creating === round.phase ? 'Creating…' : `Create ${round.label} →`}
                </button>
              )}
            </div>

            {errors[round.phase] && (
              <p className="px-4 py-2 text-xs text-red-400 bg-red-900/10 border-t border-red-900/30">
                ⚠ {errors[round.phase]}
              </p>
            )}

            {/* Match preview (only for uncreated rounds that are unlocked) */}
            {canCreate && prereqDone && (
              <div className="divide-y divide-brand-border/30">
                {round.nums.filter(n => !dbByNum[n]).map(num => {
                  const { home, away } = projectedTeams(num);
                  return (
                    <div key={num} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span className="text-[11px] text-gray-600 w-8 shrink-0">M{num}</span>
                      <TeamChip team={home} />
                      <span className="text-gray-600 text-xs">vs</span>
                      <TeamChip team={away} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TeamChip({ team }) {
  if (!team) return <span className="text-xs text-gray-600 italic">TBD</span>;
  return (
    <span className="flex items-center gap-1.5">
      <Flag code={team.code} name={team.name} className="w-4 h-4 shrink-0" />
      <span className="text-xs font-bold text-gray-300 uppercase">{team.code || team.name?.slice(0, 3)}</span>
    </span>
  );
}

function LiveSyncCard({ adminKey, onDone }) {
  const [status, setStatus]   = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');
  const timerRef              = useRef(null);

  async function loadStatus() {
    try { setStatus(await api.syncStatus(adminKey)); } catch {}
  }

  useEffect(() => {
    loadStatus();
    timerRef.current = setInterval(loadStatus, 30_000);
    return () => clearInterval(timerRef.current);
  }, []); // eslint-disable-line

  async function sync() {
    setSyncing(true); setError(''); setResult(null);
    try {
      const r = await api.syncNow(adminKey);
      setResult(r);
      onDone?.();
      loadStatus();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function toggleAuto() {
    setToggling(true);
    try {
      if (autoSyncRunning) {
        await api.stopSync(adminKey);
      } else {
        await api.startSync(adminKey, 5);
      }
      await loadStatus();
    } catch (e) {
      setError(e.message);
    } finally {
      setToggling(false);
    }
  }

  const configured      = status?.configured;
  const autoSyncRunning = status?.autoSyncRunning ?? false;
  const lastSync        = status?.lastSyncAt ? new Date(status.lastSyncAt) : null;
  const autoMin         = status?.autoInterval || 0;

  return (
    <div className={`card border ${configured ? 'border-brand-border' : 'border-yellow-700/40 bg-yellow-900/5'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 ${
              !configured     ? 'rounded-full bg-yellow-500' :
              autoSyncRunning ? 'rounded-full bg-emerald-400' :
                                'rounded-sm bg-red-500'
            }`} />
            <h3 className="font-black text-base">Live Score Sync</h3>
            <span className="text-xs text-gray-500">worldcup26.ir</span>
          </div>

          {!configured ? (
            <div className="text-sm space-y-2 text-gray-400 mt-2">
              <p>Connect the live scores API to auto-update results:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-gray-500">
                <li>Register at <a href="https://worldcup26.ir/api-docs/" target="_blank" rel="noreferrer" className="text-brand-gold hover:underline">worldcup26.ir/api-docs</a></li>
                <li>Authenticate and copy your JWT token</li>
                <li>Add to <code className="bg-black/30 px-1 rounded">.env</code>: <code className="bg-black/30 px-1 rounded">WORLDCUP_API_TOKEN=your_token</code></li>
                <li>Restart the server</li>
              </ol>
            </div>
          ) : (
            <div className="text-sm text-gray-400 mt-1 space-y-0.5">
              {lastSync ? (
                <p>Last sync: <span className="text-white">{lastSync.toLocaleTimeString()}</span>
                  {status?.lastResult && (
                    <span className="ml-2 text-xs">
                      {status.lastResult.updated > 0
                        ? <span className="text-emerald-400">↑ {status.lastResult.updated} updated</span>
                        : <span className="text-gray-500">no changes</span>}
                    </span>
                  )}
                </p>
              ) : <p className="text-gray-500">Never synced</p>}
              {autoSyncRunning
                ? <p className="text-xs text-sky-400">
                    ⏱ Auto-sync every {autoMin || 5} min
                    {status?.nextSyncAt && (
                      <span className="ml-1 text-gray-500">
                        · next at {new Date(status.nextSyncAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </p>
                : <p className="text-xs text-red-400">Auto-sync stopped</p>
              }
            </div>
          )}

          {result && (
            <p className="text-xs mt-2 text-emerald-400">
              {result.updated} match{result.updated !== 1 ? 'es' : ''} updated · {result.skipped} already up to date
              {result.errors?.length > 0 && <span className="text-yellow-500 ml-1">· {result.errors.length} warning{result.errors.length !== 1 ? 's' : ''}</span>}
            </p>
          )}
          {error && <p className="text-xs mt-2 text-red-400">{error}</p>}
        </div>

        {configured && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleAuto}
              disabled={toggling}
              className={`text-sm whitespace-nowrap disabled:opacity-50 px-3 py-2 rounded-lg font-bold border transition-all ${
                autoSyncRunning
                  ? 'border-red-500/40 text-red-400 hover:bg-red-500/10'
                  : 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              {toggling ? '…' : autoSyncRunning ? 'Stop Auto-sync' : 'Start Auto-sync'}
            </button>
            <button
              onClick={sync}
              disabled={syncing || status?.inProgress}
              className="btn-primary text-sm whitespace-nowrap disabled:opacity-50"
            >
              {syncing || status?.inProgress ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-brand-card border border-brand-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
        <h3 className="text-base font-bold text-white">{title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded text-sm font-semibold bg-brand-border/60 text-gray-300 hover:bg-brand-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-brand-gold text-brand-navy hover:brightness-110'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function RecalculateButton({ adminKey, onDone }) {
  const [state, setState] = useState('idle'); // idle | running | done | error
  const [result, setResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  async function run() {
    setShowConfirm(false);
    setState('running');
    try {
      const data = await api.recalculateAll(adminKey);
      setResult(data);
      setState('done');
      onDone?.();
      setTimeout(() => setState('idle'), 5000);
    } catch (e) {
      setState('error');
      setResult({ error: e.message });
      setTimeout(() => setState('idle'), 5000);
    }
  }

  return (
    <>
      {showConfirm && (
        <ConfirmModal
          title="Recalculate All Scores"
          message="Apply current scoring rules to every finished match? This will overwrite all existing point values."
          confirmLabel="Recalculate"
          onConfirm={run}
          onCancel={() => setShowConfirm(false)}
        />
      )}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={state === 'running'}
        className="card relative flex flex-col items-center justify-center gap-2 px-8 py-4 text-center flex-1
                   hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
      >
        {state === 'done' && (
          <span className="absolute inset-0 flex items-center justify-center text-2xl text-green-400 bg-[#0d1117]/80 rounded-xl">✓</span>
        )}
        {state === 'error' && (
          <span className="absolute inset-0 flex items-center justify-center text-2xl text-red-400 bg-[#0d1117]/80 rounded-xl">✗</span>
        )}
        <span className="text-sm font-bold text-gray-300 whitespace-nowrap">
          {state === 'running' ? 'Recalculating…' : 'Recalculate User Scores'}
        </span>
        <span className="text-[10px] text-gray-500 leading-tight">Recompute all player scores using the current scoring rules</span>
      </button>
    </>
  );
}

function StatCard({ label, value, color = 'text-brand-gold' }) {
  return (
    <div className="card text-center">
      <p className={`text-3xl font-black ${color}`}>{value ?? '—'}</p>
      <p className="text-gray-400 text-sm">{label}</p>
    </div>
  );
}

// JSON scorer array ↔ [{name, minute}] (minute stored as string to support "45+3")
function scorersJsonToArray(raw) {
  if (!raw || raw === 'null') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(s => ({
        name:   String(s.name ?? s.player ?? s.scorer ?? s),
        minute: s.minute != null ? String(s.minute) : '',
      }));
    }
  } catch {}
  return raw ? [{ name: raw, minute: '' }] : [];
}

function arrayToScorersJson(arr) {
  const entries = arr
    .filter(s => s.name.trim())
    .map(s => {
      const entry = { name: s.name.trim() };
      if (s.minute.trim()) entry.minute = s.minute.trim();
      return entry;
    });
  return entries.length > 0 ? JSON.stringify(entries) : null;
}

function ResultRow({ match, adminKey, onSaved, openScorerId, setOpenScorerId }) {
  const [hs, setHs] = useState(match.home_score ?? '');
  const [as_, setAs] = useState(match.away_score ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [homeScorers, setHomeScorers]   = useState(() => scorersJsonToArray(match.home_scorers));
  const [awayScorers, setAwayScorers]   = useState(() => scorersJsonToArray(match.away_scorers));
  const [scorerSaving, setScorerSaving] = useState(false);
  const [scorerSaved,  setScorerSaved]  = useState(false);
  const isFinished  = match.status === 'finished';
  const isLive      = match.status === 'live';
  const scorersOpen = openScorerId === match.id;
  const homeCount   = (Number.isInteger(+hs) && +hs >= 0) ? +hs : 0;
  const awayCount   = (Number.isInteger(+as_) && +as_ >= 0) ? +as_ : 0;

  // Refs so the close-effect always sees the latest scorer values
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

  // Auto-save when panel closes if data changed
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
              onClick={() => setShowResetConfirm(true)}
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
              {homeCount === 0
                ? <p className="text-xs text-gray-600 italic">No home goals</p>
                : Array.from({ length: homeCount }, (_, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder=""
                        className="flex-1 min-w-0 bg-brand-navy border border-brand-border rounded px-2 py-1.5 text-xs text-gray-300
                                   focus:border-brand-gold focus:outline-none"
                        value={homeScorers[i]?.name ?? ''}
                        onChange={e => setHomeScorers(prev => {
                          const next = [...prev];
                          while (next.length <= i) next.push({ name: '', minute: '' });
                          next[i] = { ...next[i], name: e.target.value };
                          return next;
                        })}
                      />
                      <input
                        type="text"
                        placeholder=""
                        className="w-16 shrink-0 bg-brand-navy border border-brand-border rounded px-2 py-1.5 text-xs text-gray-300
                                   focus:border-brand-gold focus:outline-none text-center"
                        value={homeScorers[i]?.minute ?? ''}
                        onChange={e => setHomeScorers(prev => {
                          const next = [...prev];
                          while (next.length <= i) next.push({ name: '', minute: '' });
                          next[i] = { ...next[i], minute: e.target.value };
                          return next;
                        })}
                      />
                    </div>
                  ))
              }
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{match.away_team}</p>
              {awayCount === 0
                ? <p className="text-xs text-gray-600 italic">No away goals</p>
                : Array.from({ length: awayCount }, (_, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder=""
                        className="flex-1 min-w-0 bg-brand-navy border border-brand-border rounded px-2 py-1.5 text-xs text-gray-300
                                   focus:border-brand-gold focus:outline-none"
                        value={awayScorers[i]?.name ?? ''}
                        onChange={e => setAwayScorers(prev => {
                          const next = [...prev];
                          while (next.length <= i) next.push({ name: '', minute: '' });
                          next[i] = { ...next[i], name: e.target.value };
                          return next;
                        })}
                      />
                      <input
                        type="text"
                        placeholder=""
                        className="w-16 shrink-0 bg-brand-navy border border-brand-border rounded px-2 py-1.5 text-xs text-gray-300
                                   focus:border-brand-gold focus:outline-none text-center"
                        value={awayScorers[i]?.minute ?? ''}
                        onChange={e => setAwayScorers(prev => {
                          const next = [...prev];
                          while (next.length <= i) next.push({ name: '', minute: '' });
                          next[i] = { ...next[i], minute: e.target.value };
                          return next;
                        })}
                      />
                    </div>
                  ))
              }
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
    {showResetConfirm && (
      <ConfirmModal
        title="Reset Match Result"
        message="This will clear the score and set all predictions for this match back to 0 points."
        confirmLabel="Reset"
        danger
        onConfirm={async () => {
          setShowResetConfirm(false);
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
        }}
        onCancel={() => setShowResetConfirm(false)}
      />
    )}
  </>
  );
}

// ── User Predictions Panel ────────────────────────────────────────────────────
function PredictionRow({ pred, adminKey, matchFinished, onSaved, onDelete }) {
  const [ph, setPh] = useState(pred.pred_home);
  const [pa, setPa] = useState(pred.pred_away);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = ph !== pred.pred_home || pa !== pred.pred_away;

  async function save() {
    setSaving(true);
    try {
      await api.updatePrediction(adminKey, pred.id, ph, pa);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr className="border-b border-brand-border/30 last:border-0 hover:bg-white/3 transition-colors">
        <td className="px-3 py-2">
          <span className="tag bg-brand-border text-gray-300 text-[11px]">{pred.group_name ?? pred.phase}</span>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-end gap-1.5 text-xs font-semibold">
            <span className="hidden sm:inline text-gray-300">{pred.home_team}</span>
            <Flag code={pred.home_code} name={pred.home_team} className="w-4 h-4" />
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-center gap-1">
            <input
              type="number" min="0" max="99"
              className="w-9 h-7 text-center font-bold rounded bg-brand-navy border border-brand-border
                         focus:border-brand-gold focus:outline-none text-xs"
              value={ph}
              onChange={e => setPh(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            />
            <span className="text-gray-600 text-xs">–</span>
            <input
              type="number" min="0" max="99"
              className="w-9 h-7 text-center font-bold rounded bg-brand-navy border border-brand-border
                         focus:border-brand-gold focus:outline-none text-xs"
              value={pa}
              onChange={e => setPa(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            />
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Flag code={pred.away_code} name={pred.away_team} className="w-4 h-4" />
            <span className="hidden sm:inline text-gray-300">{pred.away_team}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-xs text-center">
          {matchFinished
            ? <span className="text-gray-400">{pred.home_score}–{pred.away_score}</span>
            : <span className="text-gray-600 italic">pending</span>}
        </td>
        <td className="px-3 py-2 text-xs text-center font-bold">
          {matchFinished
            ? <span className={pred.points > 0 ? 'text-emerald-400' : 'text-gray-500'}>{pred.points} pts</span>
            : <span className="text-gray-600">—</span>}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <button
              onClick={save}
              disabled={saving || !dirty || ph === '' || pa === ''}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all disabled:opacity-40 ${
                saved
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/40 hover:bg-sky-500/30'
              }`}
            >
              {saved ? '✓' : saving ? '…' : 'Save'}
            </button>
            <button
              onClick={() => setShowDel(true)}
              disabled={deleting}
              className="px-2 py-1 rounded text-[11px] font-bold transition-all
                         bg-red-500/10 text-red-400 border border-red-500/30
                         hover:bg-red-500/20 disabled:opacity-40"
            >
              {deleting ? '…' : '✕'}
            </button>
          </div>
        </td>
      </tr>
      {showDel && (
        <ConfirmModal
          title="Delete Prediction"
          message={`Remove this prediction (${pred.home_team} vs ${pred.away_team}) for this user?`}
          confirmLabel="Delete"
          danger
          onConfirm={async () => {
            setShowDel(false);
            setDeleting(true);
            try {
              await api.deletePrediction(adminKey, pred.id);
              onDelete();
            } catch (e) {
              alert('Error: ' + e.message);
            } finally {
              setDeleting(false);
            }
          }}
          onCancel={() => setShowDel(false)}
        />
      )}
    </>
  );
}

function UserRow({ user, adminKey, onUserDeleted }) {
  const [open, setOpen]         = useState(false);
  const [preds, setPreds]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [showDel, setShowDel]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [paid, setPaid]             = useState(!!user.paid);
  const [paidAmount, setPaidAmount] = useState(user.paid_amount ?? '');
  const [paymentType, setPaymentType] = useState(user.payment_type ?? '');
  const [paidSaving, setPaidSaving]   = useState(false);

  async function loadPreds() {
    setLoading(true);
    try {
      const data = await api.getUserPredictions(adminKey, user.id);
      setPreds(data);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (!open && preds.length === 0) loadPreds();
    setOpen(o => !o);
  }

  function refresh() { loadPreds(); }

  async function togglePaid(e) {
    e.stopPropagation();
    const next = !paid;
    setPaid(next);
    setPaidSaving(true);
    try {
      await api.setUserPaid(adminKey, user.id, next, paidAmount !== '' ? parseFloat(paidAmount) : null, paymentType || null);
    } catch (err) {
      setPaid(!next);
      alert('Error: ' + err.message);
    } finally {
      setPaidSaving(false);
    }
  }

  async function savePaidDetails(e) {
    e.stopPropagation();
    setPaidSaving(true);
    try {
      await api.setUserPaid(adminKey, user.id, paid, paidAmount !== '' ? parseFloat(paidAmount) : null, paymentType || null);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setPaidSaving(false);
    }
  }

  return (
    <>
      <div className="border-b border-brand-border/40 last:border-0">
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/3 transition-colors cursor-pointer"
          onClick={toggle}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className={`text-gray-500 transition-transform text-xs ${open ? 'rotate-90' : ''}`}>▶</span>
            <span className="font-bold text-sm truncate">{user.name}</span>
            <span className="text-xs text-gray-500 shrink-0">{user.predictions} preds</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <span className="text-sm font-bold text-brand-gold">{user.total_points} pts</span>
            <label
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold border cursor-pointer transition-all select-none ${
                paid
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-brand-border/60 text-gray-500 border-brand-border hover:border-gray-500'
              } ${paidSaving ? 'opacity-50' : ''}`}
              onClick={togglePaid}
            >
              <input
                type="checkbox"
                checked={paid}
                onChange={() => {}}
                className="accent-emerald-400 w-3.5 h-3.5"
              />
              Paid
            </label>
            {paid && (
              <>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={paidAmount}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setPaidAmount(e.target.value)}
                  onBlur={savePaidDetails}
                  className="w-20 bg-brand-navy border border-brand-border rounded px-2 py-1 text-xs text-gray-300
                             focus:border-emerald-500/60 focus:outline-none"
                />
                <select
                  value={paymentType}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { setPaymentType(e.target.value); }}
                  onBlur={savePaidDetails}
                  className="bg-brand-navy border border-brand-border rounded px-2 py-1 text-xs text-gray-300
                             focus:border-emerald-500/60 focus:outline-none"
                >
                  <option value="">Type…</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Venmo">Venmo</option>
                  <option value="Other">Other</option>
                </select>
              </>
            )}
            <button
              onClick={e => { e.stopPropagation(); setShowDel(true); }}
              disabled={deleting}
              className="px-2 py-1 rounded text-xs font-bold transition-all
                         bg-red-500/10 text-red-400 border border-red-500/30
                         hover:bg-red-500/20 disabled:opacity-40"
            >
              {deleting ? '…' : 'Delete user'}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-brand-border/30 bg-brand-navy/30 overflow-x-auto">
            {loading ? (
              <p className="text-center text-gray-500 text-sm py-4">Loading…</p>
            ) : preds.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-4">No predictions.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-[11px] uppercase tracking-wider border-b border-brand-border/30">
                    <th className="px-3 py-1.5 text-left">Grp</th>
                    <th className="px-3 py-1.5 text-right">Home</th>
                    <th className="px-3 py-1.5 text-center">Prediction</th>
                    <th className="px-3 py-1.5 text-left">Away</th>
                    <th className="px-3 py-1.5 text-center">Result</th>
                    <th className="px-3 py-1.5 text-center">Pts</th>
                    <th className="px-3 py-1.5 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {preds.map(p => (
                    <PredictionRow
                      key={p.id}
                      pred={p}
                      adminKey={adminKey}
                      matchFinished={p.status === 'finished'}
                      onSaved={refresh}
                      onDelete={() => {
                        setPreds(ps => ps.filter(x => x.id !== p.id));
                      }}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showDel && (
        <ConfirmModal
          title="Delete User"
          message={`Delete "${user.name}" and all their predictions? This cannot be undone.`}
          confirmLabel="Delete User"
          danger
          onConfirm={async () => {
            setShowDel(false);
            setDeleting(true);
            try {
              await api.deleteUser(adminKey, user.id);
              onUserDeleted(user.id);
            } catch (e) {
              alert('Error: ' + e.message);
              setDeleting(false);
            }
          }}
          onCancel={() => setShowDel(false)}
        />
      )}
    </>
  );
}

function UserPredictionsPanel({ adminKey }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.adminUsers(adminKey);
      setUsers(data);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (!open && users.length === 0) load();
    setOpen(o => !o);
  }

  return (
    <div className="card p-0 overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-brand-border hover:bg-white/3 transition-colors"
        onClick={toggle}
      >
        <h2 className="font-black text-lg">User Predictions</h2>
        <div className="flex items-center gap-2">
          {users.length > 0 && <span className="text-xs text-gray-500">{users.length} players</span>}
          <span className={`text-gray-500 text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        </div>
      </button>

      {open && (
        loading ? (
          <p className="text-center text-gray-500 text-sm py-6">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-6">No users yet.</p>
        ) : (
          <div>
            {users.map(u => (
              <UserRow
                key={u.id}
                user={u}
                adminKey={adminKey}
                onUserDeleted={id => setUsers(us => us.filter(x => x.id !== id))}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function PrizePotCard({ adminKey, stats, onUpdated }) {
  const pot = stats?.prize_pot;
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pot) return;
    setValue(String(pot.override_total ?? pot.total ?? 0));
  }, [pot?.override_total, pot?.total]);

  async function saveOverride() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const parsed = value.trim() === '' ? null : parseFloat(value);
      if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
        throw new Error('Enter a valid non-negative number');
      }
      const res = await api.updatePrizePot(adminKey, parsed);
      onUpdated?.(res.prize_pot);
      setMessage(parsed === null ? 'Using auto-calculated pot.' : 'Prize pot updated.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetOverride() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await api.updatePrizePot(adminKey, null);
      onUpdated?.(res.prize_pot);
      setValue(String(res.prize_pot.auto_total ?? 0));
      setMessage('Prize pot reset to auto-calculated total.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!pot) return null;

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-400">Current Prize Pot</p>
          <p className="text-3xl font-black text-brand-gold">{"\u00A3"}{pot.total % 1 === 0 ? pot.total.toFixed(0) : pot.total.toFixed(2)}</p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>{pot.paid_count} paid player{pot.paid_count !== 1 ? 's' : ''}</p>
          <p>{pot.has_override ? 'Manual override active' : 'Auto-calculated from paid users'}</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold">Assign Current Pot</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="w-full bg-brand-navy border-2 border-brand-border rounded-lg px-4 py-3 focus:border-brand-gold focus:outline-none transition-colors"
          placeholder="Enter current pot total"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={saveOverride} disabled={saving} className="btn-primary text-sm">
          {saving ? 'Saving...' : 'Save Pot'}
        </button>
        <button onClick={resetOverride} disabled={saving || !pot.has_override} className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed">
          Use Auto Total
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}
    </div>
  );
}

export default function Admin() {
  const [key, setKey]       = useState(() => localStorage.getItem(LS_KEY) || '');
  const [keyInput, setKeyInput] = useState('');
  const [authed, setAuthed] = useState(false);
  const [stats, setStats]   = useState(null);
  const [matches, setMatches] = useState([]);
  const [filter, setFilter] = useState('all');
  const [resultsOpen, setResultsOpen] = useState(false);
  const [openScorerId, setOpenScorerId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const load = useCallback(async (k) => {
    setLoading(true);
    setError('');
    try {
      const [s, mts] = await Promise.all([api.adminStats(k), api.adminMatches(k)]);
      setStats(s);
      setMatches(mts);
      setAuthed(true);
    } catch (e) {
      setAuthed(false);
      setError(e.message === 'Invalid admin key' ? 'Wrong admin key.' : e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (key) load(key);
  }, []);  // eslint-disable-line

  function handleKeySubmit(e) {
    e.preventDefault();
    const k = keyInput.trim();
    if (!k) return;
    setKey(k);
    localStorage.setItem(LS_KEY, k);
    load(k);
  }

  const visibleMatches = filter === 'all'
    ? matches
    : filter === 'pending'
    ? matches.filter(m => m.status !== 'finished')
    : matches.filter(m => m.status === 'finished');

  function handlePrizePotUpdated(prize_pot) {
    setStats(prev => prev ? { ...prev, prize_pot } : prev);
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-16">
        <div className="card text-center space-y-5">
          <div>
            <h1 className="text-2xl font-black">Admin Panel</h1>
            <p className="text-gray-400 text-sm mt-1">Enter your admin key to continue</p>
          </div>
          <form onSubmit={handleKeySubmit} className="space-y-3">
            <input
              type="password"
              placeholder="Admin key…"
              className="w-full bg-brand-navy border-2 border-brand-border rounded-lg px-4 py-3
                         text-center text-lg focus:border-brand-gold focus:outline-none transition-colors"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              autoFocus
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading || !keyInput.trim()}>
              {loading ? 'Checking…' : 'Unlock →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Admin Panel</h1>
        <button
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          onClick={() => { setAuthed(false); setKey(''); localStorage.removeItem(LS_KEY); }}
        >
          Log out
        </button>
      </div>

      {/* Live sync + recalculate */}
      <div className="flex gap-4 items-stretch">
        <div className="flex-[2] min-w-0">
          <LiveSyncCard adminKey={key} onDone={() => load(key)} />
        </div>
        {stats?.finished > 0 && (
          <RecalculateButton adminKey={key} onDone={() => load(key)} />
        )}
      </div>

      {/* Stats */}
      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Players"         value={stats.total_users}   />
            <StatCard label="Matches Total"   value={stats.total_matches} color="text-sky-400" />
            <StatCard label="Results Entered" value={stats.finished}      color="text-emerald-400" />
            <StatCard label="Predictions"     value={stats.total_preds}   color="text-purple-400" />
          </div>
          <PrizePotCard adminKey={key} stats={stats} onUpdated={handlePrizePotUpdated} />
        </>
      )}

      {/* Match results entry */}
      <div className="card p-0 overflow-hidden">
        <button
          className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-brand-border hover:bg-white/3 transition-colors"
          onClick={() => setResultsOpen(o => !o)}
        >
          <h2 className="font-black text-lg">Match Results</h2>
          <span className={`text-gray-500 text-xs transition-transform ${resultsOpen ? 'rotate-90' : ''}`}>▶</span>
        </button>

        {resultsOpen && (
          <>
          <div className="flex gap-1.5 px-4 py-3 border-b border-brand-border">
            {['all', 'pending', 'done'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                  filter === f
                    ? 'bg-brand-gold text-brand-navy'
                    : 'bg-brand-border text-gray-300 hover:text-white'
                }`}
              >
                {f === 'all' ? `All (${matches.length})` : f === 'pending' ? `Pending (${matches.filter(m => m.status !== 'finished').length})` : `Done (${matches.filter(m => m.status === 'finished').length})`}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-gray-500 text-xs uppercase tracking-wider bg-brand-navy/50">
                  <th className="px-3 py-2 text-left">Grp</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">Date</th>
                  <th className="px-3 py-2 text-right">Home</th>
                  <th className="px-3 py-2 text-center">Score</th>
                  <th className="px-3 py-2 text-left">Away</th>
                  <th className="px-3 py-2 hidden lg:table-cell"></th>
                  <th className="px-3 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleMatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      No matches to show.
                    </td>
                  </tr>
                ) : (
                  visibleMatches.map(m => (
                    <ResultRow
                      key={m.id}
                      match={m}
                      adminKey={key}
                      onSaved={() => load(key)}
                      openScorerId={openScorerId}
                      setOpenScorerId={setOpenScorerId}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* KO Management */}
      <KOPanel matches={matches} adminKey={key} onRefresh={() => load(key)} />

      {/* User Predictions */}
      <UserPredictionsPanel adminKey={key} />

    </div>
  );
}

