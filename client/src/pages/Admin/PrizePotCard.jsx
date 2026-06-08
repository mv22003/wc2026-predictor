import { useEffect, useState } from 'react';
import { api } from '../../api';

export default function PrizePotCard({ adminKey }) {
  const [pot,     setPot]     = useState(null);
  const [value,   setValue]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [message, setMessage] = useState('');
  const [error,   setError]   = useState('');
  const [open,    setOpen]    = useState(false);

  useEffect(() => {
    api.getAdminPrizePot(adminKey)
      .then(p => { setPot(p); setValue(String(p.override_total ?? p.total ?? 0)); })
      .catch(e => setError(e.message));
  }, [adminKey]);

  async function saveOverride() {
    setSaving(true); setError(''); setMessage('');
    try {
      const parsed = value.trim() === '' ? null : parseFloat(value);
      if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0))
        throw new Error('Enter a valid non-negative number');
      const res = await api.updatePrizePot(adminKey, parsed);
      setPot(res.prize_pot);
      setMessage(parsed === null ? 'Using auto-calculated pot.' : 'Prize pot updated.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function resetOverride() {
    setSaving(true); setError(''); setMessage('');
    try {
      const res = await api.updatePrizePot(adminKey, null);
      setPot(res.prize_pot);
      setValue(String(res.prize_pot.auto_total ?? 0));
      setMessage('Prize pot reset to auto-calculated total.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (!pot) return error ? (
    <div className="card py-3 px-4 text-sm text-red-400">Prize pot unavailable: {error}</div>
  ) : (
    <div className="card py-3 px-4 text-sm text-gray-500">Loading prize pot…</div>
  );

  return (
    <div className="card p-0 overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/3 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="font-black text-lg shrink-0">Current Prize Pot</h2>
          <span className="text-brand-gold font-black text-lg">
            {'£'}{pot.total % 1 === 0 ? pot.total.toFixed(0) : pot.total.toFixed(2)}
          </span>
          {pot.has_override && <span className="text-xs text-amber-400 font-semibold shrink-0">override</span>}
        </div>
        <span className={`text-gray-500 text-xs transition-transform shrink-0 ${open ? 'rotate-90' : ''}`}>{'▶'}</span>
      </button>

      {open && (
        <div className="border-t border-brand-border px-4 py-4 space-y-3">
          <p className="text-xs text-gray-500">
            {pot.paid_count} paid player{pot.paid_count !== 1 ? 's' : ''} &middot;{' '}
            {pot.has_override ? 'Manual override active' : 'Auto-calculated'}
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="flex-1 bg-brand-navy border-2 border-brand-border rounded-lg px-3 py-2 focus:border-brand-gold focus:outline-none transition-colors text-sm"
              placeholder="Override total (e.g. 215)"
            />
            <button onClick={saveOverride} disabled={saving} className="btn-primary text-sm shrink-0">
              {saving ? 'Saving…' : 'Save'}
            </button>
            {pot.has_override && (
              <button onClick={resetOverride} disabled={saving} className="btn-secondary text-sm shrink-0 disabled:opacity-40">
                Reset to Auto
              </button>
            )}
          </div>

          {error   && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-emerald-400">{message}</p>}
        </div>
      )}
    </div>
  );
}
