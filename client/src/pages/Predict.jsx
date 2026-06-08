import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Flag from '../components/Flag';

const LS_NAME_KEY = 'wc2026_name';

function TeamName({ name, code }) {
  return (
    <>
      <span className="sm:hidden">{code}</span>
      <span className="hidden sm:inline">{name}</span>
    </>
  );
}

function ScoreInput({ value, onChange, disabled, className = 'score-input' }) {
  const handleChange = (e) => {
    const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
    onChange(val);
    // Auto-advance to next enabled score input after a single-digit entry (0-9)
    if (typeof val === 'number' && val >= 0 && val <= 9) {
      const all = Array.from(document.querySelectorAll('[data-score-input]:not(:disabled)'));
      const idx = all.indexOf(e.target);
      if (idx >= 0 && idx < all.length - 1) {
        setTimeout(() => { all[idx + 1].focus(); all[idx + 1].select(); }, 0);
      }
    }
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      pattern="[0-9]*"
      min="0"
      max="99"
      data-score-input
      className={className}
      value={value ?? ''}
      onChange={handleChange}
      onFocus={e => e.target.select()}
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

  const matchStarted = match.status === 'live' || match.status === 'finished';
  const isLocked = locked || matchStarted;
  const filled = predHome !== '' && predHome != null && predAway !== '' && predAway != null;

  let pts = null;
  if (locked && match.status === 'finished' && filled) {
    const ph = parseInt(predHome), pa = parseInt(predAway);
    const ah = match.home_score, aa = match.away_score;
    if (ph === ah && pa === aa) pts = 5;
    else if (Math.sign(ph - pa) === Math.sign(ah - aa) && (ph - pa) === (ah - aa)) pts = 3;
    else if (Math.sign(ph - pa) === Math.sign(ah - aa)) pts = 1;
    else pts = 0;
  }

  return (
    <div className={`card !p-2.5 transition-all ${matchStarted ? 'opacity-60 border-brand-border/40' : filled ? 'border-brand-border' : 'border-yellow-600/30 bg-yellow-900/5'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-gray-500 truncate">
          {dateStr}{match.venue && ` · ${match.venue}`}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {match.status === 'live' && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          )}
          {match.status === 'finished' && (
            <span className="text-[11px] text-gray-500 font-semibold">FT · {match.home_score}–{match.away_score}</span>
          )}
          {pts !== null && (
            <span className={`tag font-bold px-1.5 py-0.5 text-[11px] ${pts === 5 ? 'pts-exact' : pts === 3 ? 'pts-correct' : pts === 1 ? 'bg-amber-800/30 text-amber-500 border border-amber-700/30' : 'pts-zero'}`}>
              {pts === 5 ? '+5' : pts === 3 ? '+3' : pts === 1 ? '+1' : '0 pts'}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 justify-between">
        {/* Home team */}
        <div className="flex-1 min-w-0 flex items-center gap-2 justify-end">
          <span className="text-sm font-semibold truncate text-right"><TeamName name={match.home_team} code={match.home_code} /></span>
          <Flag code={match.home_code} name={match.home_team} className="w-8 h-8 shrink-0" />
        </div>

        {/* Score inputs */}
        <div className="flex items-center gap-1 shrink-0">
          <ScoreInput
            value={predHome}
            onChange={v => onUpdate(match.id, 'home', v)}
            disabled={isLocked}
            className="w-8 h-7 text-center font-bold rounded bg-brand-navy border border-brand-border focus:border-brand-gold focus:outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-gray-500 text-xs font-bold">vs</span>
          <ScoreInput
            value={predAway}
            onChange={v => onUpdate(match.id, 'away', v)}
            disabled={isLocked}
            className="w-8 h-7 text-center font-bold rounded bg-brand-navy border border-brand-border focus:border-brand-gold focus:outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Away team */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Flag code={match.away_code} name={match.away_team} className="w-8 h-8 shrink-0" />
          <span className="text-sm font-semibold truncate"><TeamName name={match.away_team} code={match.away_code} /></span>
        </div>
      </div>
    </div>
  );
}

// ── Predicted standings ───────────────────────────────────────────────────────
function calcPredictedStandings(groupMatches, preds) {
  const table = {};
  for (const m of groupMatches) {
    for (const side of ['home', 'away']) {
      const name = m[`${side}_team`];
      if (!table[name]) table[name] = {
        name, code: m[`${side}_code`],
        played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, gd: 0, pts: 0,
      };
    }
  }
  for (const m of groupMatches) {
    let hs, as_;
    if (m.status === 'finished' || m.status === 'live') {
      // Use actual scores for started/finished matches
      if (m.home_score == null || m.away_score == null) continue;
      hs = m.home_score; as_ = m.away_score;
    } else {
      // Use user's prediction for upcoming matches
      const p = preds[m.id];
      if (!p || p.home === '' || p.home == null || p.away === '' || p.away == null) continue;
      hs = parseInt(p.home); as_ = parseInt(p.away);
    }
    const h = table[m.home_team], a = table[m.away_team];
    h.played++; h.gf += hs; h.ga += as_; h.gd = h.gf - h.ga;
    a.played++; a.gf += as_; a.ga += hs; a.gd = a.gf - a.ga;
    if (hs > as_)      { h.won++;   h.pts += 3; a.lost++; }
    else if (hs < as_) { a.won++;   a.pts += 3; h.lost++; }
    else               { h.drawn++; h.pts++;     a.drawn++; a.pts++; }
  }
  return Object.values(table).sort((a, b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
  );
}

function getPredicted3rds(matches, groups, preds) {
  const thirds = [];
  for (const g of groups) {
    const gm = matches.filter(m => m.group_name === g);
    const standings = calcPredictedStandings(gm, preds);
    if (standings.length >= 3 && standings[2].played > 0) thirds.push(standings[2]);
  }
  thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));
  return new Set(thirds.slice(0, 8).map(t => t.name));
}

function PredictedStandingsTable({ groupName, groupMatches, preds, qualifying3rd }) {
  const standings = calcPredictedStandings(groupMatches, preds);
  const upcomingGroupMatches = groupMatches.filter(m => m.status !== 'live' && m.status !== 'finished');
  const filledCount = upcomingGroupMatches.filter(m => {
    const p = preds[m.id];
    return p && p.home !== '' && p.home != null && p.away !== '' && p.away != null;
  }).length;

  return (
    <div className="card p-0 overflow-hidden flex flex-col flex-1">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border bg-brand-navy/60 shrink-0">
        <h3 className="font-black text-base">Group {groupName}</h3>
        <span className="text-xs text-gray-500">{filledCount}/{upcomingGroupMatches.length} predicted</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-brand-border/50">
            <th className="px-2 py-2 text-left w-5">#</th>
            <th className="px-2 py-2 text-left">Team</th>
            <th className="px-1.5 py-2 text-center w-6">P</th>
            <th className="px-1.5 py-2 text-center w-6">W</th>
            <th className="px-1.5 py-2 text-center w-6">D</th>
            <th className="px-1.5 py-2 text-center w-6">L</th>
            <th className="px-1.5 py-2 text-center w-8">GD</th>
            <th className="px-2 py-2 text-center w-8 font-bold text-brand-gold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr key={row.name}
              className={`border-b border-brand-border/30 last:border-0 transition-colors
                ${i < 2
                  ? 'bg-emerald-900/10 hover:bg-emerald-900/20'
                  : i === 2 && qualifying3rd?.has(row.name)
                  ? 'bg-amber-900/10 hover:bg-amber-900/20'
                  : 'hover:bg-white/5'}`}
            >
              <td className="px-2 py-2">
                <span className={`text-[11px] font-bold
                  ${i < 2 ? 'text-emerald-400'
                    : i === 2 && qualifying3rd?.has(row.name) ? 'text-amber-400'
                    : 'text-gray-600'}`}>
                  {i + 1}
                </span>
              </td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-1.5">
                  <Flag code={row.code} name={row.name} className="w-4 h-4 shrink-0" />
                  <span className="font-semibold text-xs text-gray-200">{row.code || row.name.slice(0,3).toUpperCase()}</span>
                </div>
              </td>
              <td className="px-1.5 py-2 text-center text-gray-400">{row.played}</td>
              <td className="px-1.5 py-2 text-center text-gray-300">{row.won}</td>
              <td className="px-1.5 py-2 text-center text-gray-300">{row.drawn}</td>
              <td className="px-1.5 py-2 text-center text-gray-300">{row.lost}</td>
              <td className="px-1.5 py-2 text-center text-gray-400">
                {row.gd > 0 ? `+${row.gd}` : row.gd}
              </td>
              <td className="px-2 py-2 text-center font-black text-brand-gold">{row.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const [matchesLoading, setMatchesLoading] = useState(true);
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

  // Load matches on mount and refresh every 30s so started matches lock in real time
  useEffect(() => {
    function loadMatches() {
      api.getMatches({ phase: 'group' })
        .then(mts => { setMatches(mts); setMatchesLoading(false); })
        .catch(() => setMatchesLoading(false));
    }
    loadMatches();
    const t = setInterval(loadMatches, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
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
      if (data.locked) {
        // Already submitted — clear stored name so next visit starts fresh
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

  const finishedCount = matches.filter(m => m.status === 'finished' || m.status === 'live').length;
  const predictionsDisabled = finishedCount >= 24;

  const groupMatches = matches.filter(m => m.group_name === activeGroup);
  const predictableMatches = matches.filter(m => m.status !== 'live' && m.status !== 'finished');
  const predictableGroupMatches = groupMatches.filter(m => m.status !== 'live' && m.status !== 'finished');

  // Group is "done" if there are no predictable matches left, or all predictable ones are filled
  const groupAllFilled = predictableGroupMatches.length === 0 || predictableGroupMatches.every(m => {
    const p = preds[m.id];
    return p && p.home !== '' && p.home != null && p.away !== '' && p.away != null;
  });
  const nextGroup = (() => {
    const idx = groups.indexOf(activeGroup);
    return idx !== -1 && idx < groups.length - 1 ? groups[idx + 1] : null;
  })();

  const filledCount = predictableMatches.filter(m => {
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
      localStorage.removeItem(LS_NAME_KEY);
      setStatus({ type: 'success', msg: `Predictions submitted for ${name}! Good luck! 🎉` });
      setTimeout(() => {
        setName('');
        setNameInput('');
        setLocked(false);
        setPreds({});
        setStatus(null);
      }, 3000);
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  }

  // ── Wait for matches to load before showing anything ──────────────────────
  if (matchesLoading) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>;
  }

  // ── Predictions closed screen ─────────────────────────────────────────────
  if (predictionsDisabled) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="card text-center space-y-4">
          <h1 className="text-2xl font-black">Predictions Closed</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            24 or more group matches have been played.<br />
            Predictions are no longer accepted.
          </p>
        </div>
      </div>
    );
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
            {' '}· {filledCount}/{predictableMatches.length} predictions
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
                className={`py-1.5 rounded-lg text-sm font-bold transition-all w-full ${
                  activeGroup === g
                    ? 'bg-brand-gold text-brand-navy'
                    : 'bg-brand-card border border-brand-border text-gray-300 hover:border-brand-gold/50'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* ── Cards + standings side by side ──────────────────────────────── */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">
            <div className="flex-1 grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5 content-start">
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
            <div className="w-full lg:w-72 shrink-0 flex flex-col">
              <PredictedStandingsTable
                groupName={activeGroup}
                groupMatches={groupMatches}
                preds={preds}
                qualifying3rd={getPredicted3rds(matches, groups, preds)}
              />
            </div>
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
                  {filledCount < predictableMatches.length
                    ? `${predictableMatches.length - filledCount} prediction${predictableMatches.length - filledCount !== 1 ? 's' : ''} missing — fill all ${predictableMatches.length} available matches to submit.`
                    : 'All predictions filled! Submit to lock them in.'}
                </p>
              </div>
              <button
                className="btn-primary whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setShowConfirm(true)}
                disabled={loading || predictableMatches.length === 0 || filledCount < predictableMatches.length}
              >
                {loading ? 'Submitting…' : `Submit All ${predictableMatches.length} Predictions`}
              </button>
            </div>
          )}
        </>
      )}

      {showConfirm && (
        <ConfirmModal
          title="Submit Predictions"
          message={`You're about to lock in all ${predictableMatches.length} predictions as ${name}. This cannot be undone — are you sure?`}
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
