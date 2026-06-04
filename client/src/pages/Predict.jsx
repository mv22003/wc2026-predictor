import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import Flag from '../components/Flag';

const LS_NAME_KEY = 'wc2026_name';

function ScoreInput({ value, onChange, disabled }) {
  return (
    <input
      type="number"
      min="0"
      max="99"
      className="score-input"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
      disabled={disabled}
      placeholder="–"
    />
  );
}

function MatchCard({ match, predHome, predAway, onUpdate, locked }) {
  const d = match.match_date ? new Date(match.match_date) : null;
  const dateStr = d
    ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Date TBD';

  const filled = predHome !== '' && predHome != null && predAway !== '' && predAway != null;

  let pts = null;
  if (locked && match.status === 'finished' && filled) {
    // Show points earned
    const ph = parseInt(predHome), pa = parseInt(predAway);
    const ah = match.home_score, aa = match.away_score;
    if (ph === ah && pa === aa) pts = 5;
    else if (Math.sign(ph - pa) === Math.sign(ah - aa) && (ph - pa) === (ah - aa)) pts = 3;
    else if (Math.sign(ph - pa) === Math.sign(ah - aa)) pts = 1;
    else pts = 0;
  }

  return (
    <div className={`card transition-all ${filled ? 'border-brand-border' : 'border-yellow-600/30 bg-yellow-900/5'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">{dateStr}</span>
        {pts !== null && (
          <span className={`tag font-bold px-2 py-0.5 ${pts === 5 ? 'pts-exact' : pts === 3 ? 'pts-correct' : pts === 1 ? 'bg-amber-800/30 text-amber-500 border border-amber-700/30' : 'pts-zero'}`}>
            {pts === 5 ? '⭐ +5' : pts === 3 ? '+3' : pts === 1 ? '+1' : '0 pts'}
          </span>
        )}
        {locked && match.status === 'finished' && (
          <span className="text-xs text-gray-400">
            Result: {match.home_score}–{match.away_score}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 justify-between">
        {/* Home team */}
        <div className="flex-1 min-w-0 flex items-center gap-2 justify-end">
          <span className="text-sm font-semibold truncate text-right">{match.home_team}</span>
          <Flag code={match.home_code} name={match.home_team} className="w-9 h-9" />
        </div>

        {/* Score inputs */}
        <div className="flex items-center gap-2 shrink-0">
          <ScoreInput value={predHome} onChange={v => onUpdate(match.id, 'home', v)} disabled={locked} />
          <span className="text-gray-500 font-bold">–</span>
          <ScoreInput value={predAway} onChange={v => onUpdate(match.id, 'away', v)} disabled={locked} />
        </div>

        {/* Away team */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Flag code={match.away_code} name={match.away_team} className="w-9 h-9" />
          <span className="text-sm font-semibold truncate">{match.away_team}</span>
        </div>
      </div>
    </div>
  );
}

export default function Predict() {
  const [name, setName]         = useState(() => localStorage.getItem(LS_NAME_KEY) || '');
  const [nameInput, setNameInput] = useState(() => localStorage.getItem(LS_NAME_KEY) || '');
  const [matches, setMatches]   = useState([]);
  const [groups, setGroups]     = useState([]);
  const [activeGroup, setActiveGroup] = useState('');
  const [preds, setPreds]       = useState({});   // { matchId: { home, away } }
  const [locked, setLocked]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState(null);  // { type: 'success'|'error', msg }
  const [checking, setChecking] = useState(false);

  // Load matches on mount
  useEffect(() => {
    api.getMatches({ phase: 'group' }).then(mts => {
      setMatches(mts);
    }).catch(console.error);
    api.getGroups().then(g => {
      setGroups(g);
      if (g.length) setActiveGroup(g[0]);
    }).catch(console.error);
  }, []);

  // Check existing submission when name is confirmed
  const checkUser = useCallback(async (n) => {
    if (!n.trim()) return;
    setChecking(true);
    try {
      const data = await api.getUser(n.trim());
      if (data.locked) {
        setLocked(true);
        const map = {};
        for (const p of data.predictions) {
          map[p.match_id] = { home: p.pred_home, away: p.pred_away, points: p.points };
        }
        setPreds(map);
        setStatus({ type: 'info', msg: `Welcome back, ${n}! Your predictions are locked. ✅` });
      } else if (data.exists) {
        setStatus({ type: 'info', msg: `Welcome back, ${n}! You can still edit your predictions.` });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  }, []);

  function handleNameSubmit(e) {
    e.preventDefault();
    const n = nameInput.trim();
    if (!n) return;
    setName(n);
    localStorage.setItem(LS_NAME_KEY, n);
    checkUser(n);
  }

  function updatePred(matchId, side, value) {
    setPreds(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side === 'home' ? 'home' : 'away']: value },
    }));
  }

  const groupMatches = matches.filter(m => m.group_name === activeGroup);
  const filledCount  = matches.filter(m => {
    const p = preds[m.id];
    return p && p.home !== '' && p.home != null && p.away !== '' && p.away != null;
  }).length;

  async function handleSubmit() {
    if (!name) return;
    const payload = [];
    for (const m of matches) {
      const p = preds[m.id];
      if (!p || p.home === '' || p.home == null || p.away === '' || p.away == null) continue;
      payload.push({ match_id: m.id, pred_home: p.home, pred_away: p.away });
    }
    if (payload.length === 0) {
      setStatus({ type: 'error', msg: 'Please enter at least one prediction first.' });
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      await api.submitPredictions(name, payload);
      setLocked(true);
      setStatus({ type: 'success', msg: `🎉 Predictions submitted for ${name}! Good luck!` });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  }

  // ── Name entry screen ──────────────────────────────────────────────────────
  if (!name) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="card text-center space-y-6">
          <div>
            <p className="text-4xl mb-3">⚽</p>
            <h1 className="text-2xl font-black">Enter Your Name</h1>
            <p className="text-gray-400 text-sm mt-2">
              This identifies your predictions. You can only submit once — choose wisely!
            </p>
          </div>
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <input
              type="text"
              className="w-full bg-brand-navy border-2 border-brand-border rounded-lg px-4 py-3
                         text-lg font-semibold text-center focus:border-brand-gold focus:outline-none transition-colors"
              placeholder="Your name…"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              maxLength={50}
              autoFocus
            />
            <button type="submit" className="btn-primary w-full text-base" disabled={!nameInput.trim() || checking}>
              {checking ? 'Checking…' : 'Continue →'}
            </button>
          </form>
          <p className="text-xs text-gray-600">No account needed. Just your name.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">
            {locked ? '🔒 Your Predictions' : '📝 Make Your Predictions'}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Playing as: <span className="text-brand-gold font-bold">{name}</span>
            {' '}· {filledCount}/{matches.length} predictions
            {locked && <span className="ml-2 tag pts-exact px-2 py-0.5">Submitted</span>}
          </p>
        </div>
        <button
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          onClick={() => { setName(''); setNameInput(''); setLocked(false); setPreds({}); setStatus(null); localStorage.removeItem(LS_NAME_KEY); }}
        >
          Switch name
        </button>
      </div>

      {/* ── Status banner ───────────────────────────────────────────────────── */}
      {status && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
          status.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
          status.type === 'error'   ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                      'bg-sky-500/20 text-sky-400 border border-sky-500/30'
        }`}>
          {status.msg}
        </div>
      )}

      {matches.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          No matches loaded yet. The admin needs to seed the database first.
        </div>
      ) : (
        <>
          {/* ── Group tabs ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-6 gap-1.5">
            {groups.map(g => (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all w-full ${
                  activeGroup === g
                    ? 'bg-brand-gold text-brand-navy'
                    : 'bg-brand-card border border-brand-border text-gray-300 hover:border-brand-gold/50'
                }`}
              >
                Group {g}
              </button>
            ))}
          </div>

          {/* ── Match cards ─────────────────────────────────────────────────── */}
          <div className="grid sm:grid-cols-2 gap-4">
            {groupMatches.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                predHome={preds[match.id]?.home ?? ''}
                predAway={preds[match.id]?.away ?? ''}
                onUpdate={updatePred}
                locked={locked}
              />
            ))}
          </div>

          {/* ── Submit ──────────────────────────────────────────────────────── */}
          {!locked && (
            <div className="card flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold">Ready to submit?</p>
                <p className="text-sm text-gray-400">
                  {filledCount < matches.length
                    ? `You have ${matches.length - filledCount} predictions missing. You can still submit partial predictions.`
                    : 'All predictions filled! Submit to lock them in.'}
                </p>
              </div>
              <button
                className="btn-primary whitespace-nowrap"
                onClick={handleSubmit}
                disabled={loading || filledCount === 0}
              >
                {loading ? 'Submitting…' : `Submit ${filledCount} Predictions`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
