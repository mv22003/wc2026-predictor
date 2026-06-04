import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import Flag from '../components/Flag';

const LS_KEY = 'wc2026_admin_key';

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

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Players"        value={stats.total_users}   />
          <StatCard label="Matches Total"  value={stats.total_matches} color="text-sky-400" />
          <StatCard label="Results Entered" value={stats.finished}     color="text-emerald-400" />
          <StatCard label="Predictions"    value={stats.total_preds}   color="text-purple-400" />
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
