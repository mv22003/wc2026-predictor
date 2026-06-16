import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';

// Scorer-related field names to highlight in the raw API viewer
const SCORER_FIELDS = new Set([
  'home_scorers', 'away_scorers',
  'home_scorers_en', 'away_scorers_en',
  'home_scorers_english', 'away_scorers_english',
  'home_score', 'away_score',
  'status', 'finished', 'live', 'time_elapsed',
]);

function RawApiModal({ data, onClose }) {
  // Filter to only games that are live or finished so we don't drown in noise
  const interesting = (data.games || []).filter(
    g => g.finished === 'TRUE' || g.finished === true || g.finished === 1 ||
         g.live === true || g.live === 1 || g.live === 'TRUE' ||
         g.status === 'live' || g.status === 'in_progress' ||
         g.status === '1H' || g.status === '2H' || g.status === 'HT' ||
         g.status === 'ET' || g.status === 'PEN'
  );
  const display = interesting.length > 0 ? interesting : (data.games || []).slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-brand-border rounded-xl w-full max-w-4xl mt-8 mb-8">
        <div className="flex items-center justify-between p-4 border-b border-brand-border">
          <div>
            <h2 className="font-black text-base">Raw API Response — worldcup26.ir</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {interesting.length > 0
                ? `${interesting.length} live/finished game(s) · scorer fields highlighted`
                : `Showing first ${display.length} of ${data.total} games (none live/finished)`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none px-2">✕</button>
        </div>
        <div className="p-4 space-y-4 overflow-x-auto">
          {display.map((game, i) => (
            <div key={i} className="border border-gray-700 rounded-lg p-3">
              <div className="text-xs font-bold text-brand-gold mb-2">
                Game #{game.id} — {game.home_team ?? game.home} vs {game.away_team ?? game.away}
              </div>
              <table className="text-xs w-full">
                <tbody>
                  {Object.entries(game).map(([k, v]) => (
                    <tr key={k} className={SCORER_FIELDS.has(k) ? 'bg-yellow-900/30' : ''}>
                      <td className={`pr-4 py-0.5 font-mono align-top whitespace-nowrap ${SCORER_FIELDS.has(k) ? 'text-yellow-300' : 'text-gray-400'}`}>{k}</td>
                      <td className={`font-mono break-all ${SCORER_FIELDS.has(k) ? 'text-white' : 'text-gray-300'}`}>
                        {v === null ? <span className="text-gray-600">null</span>
                          : v === '' ? <span className="text-gray-600">(empty string)</span>
                          : typeof v === 'object' ? JSON.stringify(v)
                          : String(v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LiveSyncCard({ adminKey, onDone }) {
  const [status,   setStatus]   = useState(null);
  const [syncing,  setSyncing]  = useState(false);
  const [toggling, setToggling] = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState('');
  const [rawData,  setRawData]  = useState(null);
  const [loadingRaw, setLoadingRaw] = useState(false);
  const timerRef = useRef(null);

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

  async function viewRaw() {
    setLoadingRaw(true); setError('');
    try { setRawData(await api.syncRaw(adminKey)); }
    catch (e) { setError(e.message); }
    finally { setLoadingRaw(false); }
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
    <>
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
            <span className="text-xs text-gray-400">worldcup26.ir</span>
          </div>

          {!configured ? (
            <div className="text-sm space-y-2 text-gray-400 mt-2">
              <p>Connect the live scores API to auto-update results:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-gray-400">
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
                        : <span className="text-gray-400">no changes</span>}
                    </span>
                  )}
                </p>
              ) : <p className="text-gray-400">Never synced</p>}
              {autoSyncRunning
                ? <p className="text-xs text-sky-400">
                    ⏱ Auto-sync every {autoMin || 5} min
                    {status?.nextSyncAt && (
                      <span className="ml-1 text-gray-400">
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
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={viewRaw}
              disabled={loadingRaw}
              className="text-sm whitespace-nowrap disabled:opacity-50 px-3 py-2 rounded-lg font-bold border border-sky-500/40 text-sky-400 hover:bg-sky-500/10 transition-all"
            >
              {loadingRaw ? '…' : 'View Raw API'}
            </button>
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
    {rawData && <RawApiModal data={rawData} onClose={() => setRawData(null)} />}
    </>
  );
}
