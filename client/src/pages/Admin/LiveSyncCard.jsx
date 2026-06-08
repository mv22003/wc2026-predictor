import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';

export default function LiveSyncCard({ adminKey, onDone }) {
  const [status,   setStatus]   = useState(null);
  const [syncing,  setSyncing]  = useState(false);
  const [toggling, setToggling] = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState('');
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
