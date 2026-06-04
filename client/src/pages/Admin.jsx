import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api';
import Flag from '../components/Flag';

const LS_KEY = 'wc2026_admin_key';

function LiveSyncCard({ adminKey, onDone }) {
  const [status, setStatus]   = useState(null);
  const [syncing, setSyncing] = useState(false);
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

  const configured = status?.configured;
  const lastSync   = status?.lastSyncAt ? new Date(status.lastSyncAt) : null;
  const autoMin    = status?.autoInterval || 0;

  return (
    <div className={`card border ${configured ? 'border-brand-border' : 'border-yellow-700/40 bg-yellow-900/5'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${configured ? 'bg-emerald-400' : 'bg-yellow-500'}`} />
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
                <li>Optionally add <code className="bg-black/30 px-1 rounded">WORLDCUP_SYNC_INTERVAL=5</code> for auto-sync every 5 min</li>
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
              {autoMin > 0 && <p className="text-xs text-sky-400">Auto-sync every {autoMin} min</p>}
            </div>
          )}

          {result && (
            <p className="text-xs mt-2 text-emerald-400">
              ✅ {result.updated} match{result.updated !== 1 ? 'es' : ''} updated · {result.skipped} already up to date
              {result.errors?.length > 0 && <span className="text-yellow-500 ml-1">· {result.errors.length} warning{result.errors.length !== 1 ? 's' : ''}</span>}
            </p>
          )}
          {error && <p className="text-xs mt-2 text-red-400">❌ {error}</p>}
        </div>

        {configured && (
          <button
            onClick={sync}
            disabled={syncing || status?.inProgress}
            className="btn-primary text-sm whitespace-nowrap disabled:opacity-50"
          >
            {syncing || status?.inProgress ? '⏳ Syncing…' : '⚡ Sync Now'}
          </button>
        )}
      </div>
    </div>
  );
}

function RecalculateButton({ adminKey, onDone }) {
  const [state, setState] = useState('idle'); // idle | running | done | error
  const [result, setResult] = useState(null);

  async function run() {
    if (!confirm('Recalculate all prediction points using the current scoring rules?\n\nThis will overwrite all existing point values.')) return;
    setState('running');
    try {
      const data = await api.recalculateAll(adminKey);
      setResult(data);
      setState('done');
      onDone?.();
      setTimeout(() => setState('idle'), 4000);
    } catch (e) {
      setState('error');
      setResult({ error: e.message });
      setTimeout(() => setState('idle'), 4000);
    }
  }

  return (
    <div className="flex items-center gap-3 bg-brand-card border border-brand-border rounded-xl px-4 py-3">
      <div className="flex-1">
        <p className="font-semibold text-sm">Recalculate All Scores</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {state === 'done' && result
            ? `✅ Updated ${result.predictions_updated} predictions across ${result.matches_processed} matches`
            : state === 'error'
            ? `❌ ${result?.error}`
            : 'Apply current scoring rules to every finished match'}
        </p>
      </div>
      <button
        onClick={run}
        disabled={state === 'running'}
        className="shrink-0 btn-secondary text-sm disabled:opacity-50"
      >
        {state === 'running' ? 'Recalculating…' : state === 'done' ? '✓ Done' : 'Recalculate'}
      </button>
    </div>
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

function ResultRow({ match, adminKey, onSaved }) {
  const [hs, setHs] = useState(match.home_score ?? '');
  const [as_, setAs] = useState(match.away_score ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [resetting, setResetting] = useState(false);

  const isFinished = match.status === 'finished';

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

  const d = match.match_date ? new Date(match.match_date) : null;
  const dateStr = d
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'TBD';

  return (
    <tr className="border-b border-brand-border/50 last:border-0 hover:bg-white/3 transition-colors">
      <td className="px-3 py-3">
        <span className="tag bg-brand-border text-gray-300 text-xs">{match.group_name}</span>
      </td>
      <td className="px-3 py-3 text-sm hidden md:table-cell text-gray-400">{dateStr}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Flag code={match.home_code} name={match.home_team} className="w-6 h-6" />
          <span className="hidden sm:inline">{match.home_team}</span>
          <span className="sm:hidden">{match.home_code}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
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
          <span className="hidden sm:inline">{match.away_team}</span>
          <span className="sm:hidden">{match.away_code}</span>
          <Flag code={match.away_code} name={match.away_team} className="w-6 h-6" />
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
              onClick={async () => {
                if (!confirm(`Reset result for this match? This will clear the score and set all predictions back to 0 points.`)) return;
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
              disabled={resetting || saving}
              title="Reset result"
              className="px-2 py-1.5 rounded text-xs font-bold transition-all
                         bg-red-500/10 text-red-400 border border-red-500/30
                         hover:bg-red-500/20 disabled:opacity-40"
            >
              {resetting ? '…' : '✕'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function Admin() {
  const [key, setKey]       = useState(() => localStorage.getItem(LS_KEY) || '');
  const [keyInput, setKeyInput] = useState('');
  const [authed, setAuthed] = useState(false);
  const [stats, setStats]   = useState(null);
  const [matches, setMatches] = useState([]);
  const [filter, setFilter] = useState('all');
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

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-16">
        <div className="card text-center space-y-5">
          <div>
            <p className="text-4xl mb-3">🔐</p>
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
          <p className="text-xs text-gray-600">
            Key is set via ADMIN_KEY environment variable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">🔐 Admin Panel</h1>
        <button
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          onClick={() => { setAuthed(false); setKey(''); localStorage.removeItem(LS_KEY); }}
        >
          Log out
        </button>
      </div>

      {/* Live sync */}
      <LiveSyncCard adminKey={key} onDone={() => load(key)} />

      {/* Stats */}
      {stats && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Players"         value={stats.total_users}   />
            <StatCard label="Matches Total"   value={stats.total_matches} color="text-sky-400" />
            <StatCard label="Results Entered" value={stats.finished}      color="text-emerald-400" />
            <StatCard label="Predictions"     value={stats.total_preds}   color="text-purple-400" />
          </div>
          {stats.finished > 0 && (
            <RecalculateButton adminKey={key} onDone={() => load(key)} />
          )}
        </div>
      )}

      {/* Match results entry */}
      <div className="card p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-brand-border">
          <h2 className="font-black text-lg">Match Results</h2>
          <div className="flex gap-1.5">
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-gray-500 text-xs uppercase tracking-wider bg-brand-navy/50">
                <th className="px-3 py-2 text-left">Grp</th>
                <th className="px-3 py-2 text-left hidden md:table-cell">Date</th>
                <th className="px-3 py-2 text-left">Home</th>
                <th className="px-3 py-2 text-left">Score</th>
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
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Danger zone */}
      <details className="card border-red-900/40 cursor-pointer">
        <summary className="font-bold text-red-400 select-none">⚠️ Danger Zone</summary>
        <div className="mt-4 space-y-2 text-sm text-gray-400">
          <p>These actions are irreversible. Use with extreme caution.</p>
          <p className="text-xs">
            To reset all user data via API:<br />
            <code className="text-red-300 bg-black/30 px-2 py-0.5 rounded">
              POST /api/admin/reset  body: {'{"confirm":"RESET_ALL_DATA"}'} header: x-admin-key
            </code>
          </p>
        </div>
      </details>
    </div>
  );
}
