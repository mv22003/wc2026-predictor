import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
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
        <span className="text-xs text-gray-500">
          {dateStr}{match.venue && ` @ ${match.venue}`}
        </span>
        {pts !== null && (
          <span className={`tag font-bold px-2 py-0.5 ${pts === 5 ? 'pts-exact' : pts === 3 ? 'pts-correct' : pts === 1 ? 'bg-amber-800/30 text-amber-500 border border-amber-700/30' : 'pts-zero'}`}>
            {pts === 5 ? '+5' : pts === 3 ? '+3' : pts === 1 ? '+1' : '0 pts'}
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

function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Confirm' }) {
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
            className="px-4 py-2 rounded text-sm font-bold bg-brand-gold text-brand-navy hover:brightness-110 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingNav, setPendingNav] = useState(null);
  const navigate = useNavigate();

  const hasUnsaved = !locked && name && Object.values(preds).some(
    p => p && p.home !== '' && p.home != null && p.away !== '' && p.away != null
  );

  // Warn on tab close / refresh
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsaved]);

  // Intercept in-app nav link clicks while there's unsaved data
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = e => {
      const anchor = e.target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (href && !href.startsWith('/predict')) {
        e.preventDefault();
        setPendingNav(href);
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [hasUnsaved]);

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

  // On mount, if we have a saved name, restore the user's state from the server
  useEffect(() => {
    const saved = localStorage.getItem(LS_NAME_KEY);
    if (!saved) return;
    api.getUser(saved).then(data => {
      if (!data.exists) {
        // Name no longer in DB — clear stale localStorage
        localStorage.removeItem(LS_NAME_KEY);
        setName('');
        setNameInput('');
        return;
      }
      const map = {};
      for (const p of data.predictions ?? []) {
        map[p.match_id] = { home: p.pred_home, away: p.pred_away, points: p.points };
      }
      setPreds(map);
      if (data.locked) setLocked(true);
    }).catch(console.error);
  }, []);

  function handleNameSubmit(e) {
    e.preventDefault();
    const n = nameInput.trim();
    if (!n) return;
    setChecking(true);
    setStatus(null);
    api.getUser(n).then(data => {
      if (data.locked) {
        setStatus({ type: 'error', msg: `"${n}" is already taken. Please choose a different name.` });
      } else {
        // Name is free or belongs to this user (unlocked draft) — proceed
        setName(n);
        localStorage.setItem(LS_NAME_KEY, n);
        if (data.exists) {
          const map = {};
          for (const p of data.predictions ?? []) {
            map[p.match_id] = { home: p.pred_home, away: p.pred_away, points: p.points };
          }
          setPreds(map);
          setStatus({ type: 'info', msg: `Welcome back, ${n}! You can still edit your predictions.` });
        }
      }
    }).catch(console.error).finally(() => setChecking(false));
  }

  function updatePred(matchId, side, value) {
    setPreds(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side === 'home' ? 'home' : 'away']: value },
    }));
  }

  const groupMatches = matches.filter(m => m.group_name === activeGroup);

  const groupAllFilled = groupMatches.length > 0 && groupMatches.every(m => {
    const p = preds[m.id];
    return p && p.home !== '' && p.home != null && p.away !== '' && p.away != null;
  });
  const nextGroup = (() => {
    const idx = groups.indexOf(activeGroup);
    return idx !== -1 && idx < groups.length - 1 ? groups[idx + 1] : null;
  })();

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
      setStatus({ type: 'success', msg: `Predictions submitted for ${name}! Good luck!` });
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
              onChange={e => { setNameInput(e.target.value); setStatus(null); }}
              maxLength={50}
              autoFocus
            />
            {status?.type === 'error' && (
              <p className="text-red-400 text-sm">{status.msg}</p>
            )}
            <button type="submit" className="btn-primary w-full text-base" disabled={!nameInput.trim() || checking}>
              {checking ? 'Checking…' : 'Continue →'}
            </button>
          </form>
          <p className="text-xs text-gray-600">Each name can only be used once.</p>
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
            {locked ? 'Your Predictions' : 'Make Your Predictions'}
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

          {/* ── Next group prompt ───────────────────────────────────────────── */}
          {!locked && groupAllFilled && nextGroup && (
            <div className="flex justify-end">
              <button
                className="btn-primary"
                onClick={() => setActiveGroup(nextGroup)}
              >
                Next: Group {nextGroup} →
              </button>
            </div>
          )}

          {/* ── Submit ──────────────────────────────────────────────────────── */}
          {!locked && (
            <div className="card flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold">Ready to submit?</p>
                <p className="text-sm text-gray-400">
                  {filledCount < matches.length
                    ? `${matches.length - filledCount} prediction${matches.length - filledCount !== 1 ? 's' : ''} missing — fill all ${matches.length} matches to submit.`
                    : 'All predictions filled! Submit to lock them in.'}
                </p>
              </div>
              <button
                className="btn-primary whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setShowConfirm(true)}
                disabled={loading || filledCount < matches.length}
              >
                {loading ? 'Submitting…' : `Submit All ${matches.length} Predictions`}
              </button>
            </div>
          )}
        </>
      )}

      {showConfirm && (
        <ConfirmModal
          title="Submit Predictions"
          message={`You're about to lock in all ${matches.length} predictions as ${name}. This cannot be undone — are you sure?`}
          confirmLabel="Submit"
          onConfirm={() => { setShowConfirm(false); handleSubmit(); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {pendingNav && (
        <ConfirmModal
          title="Leave page?"
          message="You have unsaved predictions. If you leave now your progress will be lost."
          confirmLabel="Leave"
          onConfirm={() => { setPendingNav(null); navigate(pendingNav); }}
          onCancel={() => setPendingNav(null)}
        />
      )}
    </div>
  );
}
