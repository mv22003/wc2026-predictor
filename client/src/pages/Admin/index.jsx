import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import KOPanel from './KOPanel';
import LiveSyncCard from './LiveSyncCard';
import RecalculateButton from './RecalculateButton';
import ResultRow from './ResultRow';
import UserPredictionsPanel from './UserPredictionsPanel';
import PrizePotCard from './PrizePotCard';

const LS_KEY = 'wc2026_admin_key';

export default function Admin() {
  const [key,      setKey]      = useState(() => localStorage.getItem(LS_KEY) || '');
  const [keyInput, setKeyInput] = useState('');
  const [authed,   setAuthed]   = useState(false);
  const [matches,  setMatches]  = useState([]);
  const [stats,    setStats]    = useState(null);
  const [filter,   setFilter]   = useState('all');
  const [resultsOpen,   setResultsOpen]   = useState(false);
  const [openScorerId,  setOpenScorerId]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showKey,  setShowKey]  = useState(false);

  const logout = useCallback(() => {
    setAuthed(false);
    setKey('');
    localStorage.removeItem(LS_KEY);
  }, []);

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
  }, []); // eslint-disable-line

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

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-16">
        <div className="card text-center space-y-5">
          <div>
            <h1 className="text-2xl font-black">Admin Panel</h1>
            <p className="text-gray-400 text-sm mt-1">Enter your admin key to continue</p>
          </div>
          <form onSubmit={handleKeySubmit} className="space-y-3">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="Admin key…"
                className="w-full bg-brand-navy border-2 border-brand-border rounded-lg px-4 py-3 pr-12
                           text-center text-lg focus:border-brand-gold focus:outline-none transition-colors"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors text-sm"
                tabIndex={-1}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
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

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Admin Panel</h1>
        <button
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          onClick={logout}
        >
          Log out
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-stretch">
        <div className="flex-[2] min-w-0">
          <LiveSyncCard adminKey={key} onDone={() => load(key)} />
        </div>
        {stats?.finished > 0 && (
          <RecalculateButton adminKey={key} onDone={() => load(key)} />
        )}
      </div>

      <PrizePotCard adminKey={key} />

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
                  {f === 'all'
                    ? `All (${matches.length})`
                    : f === 'pending'
                    ? `Pending (${matches.filter(m => m.status !== 'finished').length})`
                    : `Done (${matches.filter(m => m.status === 'finished').length})`}
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
                      <td colSpan={7} className="text-center py-8 text-gray-500">No matches to show.</td>
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

      <KOPanel matches={matches} adminKey={key} onRefresh={() => load(key)} />

      <UserPredictionsPanel adminKey={key} />

    </div>
  );
}
