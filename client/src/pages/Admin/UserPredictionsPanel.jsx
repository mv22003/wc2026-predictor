import { useEffect, useState } from 'react';
import { api } from '../../api';
import Flag from '../../components/Flag';
import ConfirmModal from './ConfirmModal';

function PredictionRow({ pred, adminKey, matchFinished, onSaved, onDelete }) {
  const [ph, setPh] = useState(pred.pred_home);
  const [pa, setPa] = useState(pred.pred_away);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [showDel,  setShowDel]  = useState(false);
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
            <span className="text-gray-400 text-xs">–</span>
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
            : <span className="text-gray-400 italic">pending</span>}
        </td>
        <td className="px-3 py-2 text-xs text-center font-bold">
          {matchFinished
            ? <span className={pred.points > 0 ? 'text-emerald-400' : 'text-gray-400'}>{pred.points} pts</span>
            : <span className="text-gray-400">—</span>}
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

function UserRow({ user, adminKey, onUserDeleted, onUserUpdated }) {
  const [open,    setOpen]    = useState(false);
  const [preds,   setPreds]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name,    setName]    = useState(user.name);
  const [nameSaving,   setNameSaving]   = useState(false);
  const [paid,         setPaid]         = useState(!!user.paid);
  const [paidAmount,   setPaidAmount]   = useState(user.paid_amount ?? '');
  const [paymentType,  setPaymentType]  = useState(user.payment_type ?? '');
  const [paidSaving,   setPaidSaving]   = useState(false);

  useEffect(() => { setName(user.name); }, [user.name]);

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

  async function saveName(e) {
    e.stopPropagation();
    const next = name.trim();
    if (!next || next === user.name) return;
    setNameSaving(true);
    try {
      const updated = await api.renameAdminUser(adminKey, user.id, next);
      onUserUpdated?.(updated);
    } catch (err) {
      setName(user.name);
      alert('Error: ' + err.message);
    } finally {
      setNameSaving(false);
    }
  }

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
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 hover:bg-white/3 transition-colors cursor-pointer"
          onClick={toggle}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className={`text-gray-400 transition-transform text-xs shrink-0 ${open ? 'rotate-90' : ''}`}>▶</span>
            <input
              type="text"
              value={name}
              onClick={e => e.stopPropagation()}
              onChange={e => setName(e.target.value)}
              onBlur={saveName}
              className="font-bold text-sm bg-transparent border border-transparent rounded px-2 py-1 min-w-0 flex-1
                         focus:bg-brand-navy focus:border-brand-gold/40 focus:outline-none"
            />
            <span className="text-xs text-gray-400 shrink-0">{user.predictions} preds</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap ml-5 sm:ml-0">
            <button
              onClick={saveName}
              disabled={nameSaving || !name.trim() || name.trim() === user.name}
              className="px-2 py-1 rounded text-xs font-bold transition-all disabled:opacity-40
                         bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20"
            >
              {nameSaving ? '...' : 'Rename'}
            </button>
            <span className="text-sm font-bold text-brand-gold">{user.total_points} pts</span>
            <label
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold border cursor-pointer transition-all select-none ${
                paid
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-brand-border/60 text-gray-400 border-brand-border hover:border-gray-400'
              } ${paidSaving ? 'opacity-50' : ''}`}
              onClick={togglePaid}
            >
              <input type="checkbox" checked={paid} onChange={() => {}} className="accent-emerald-400 w-3.5 h-3.5" />
              Paid
            </label>
            {paid && (
              <>
                <input
                  type="number" min="0" step="0.01" placeholder="Amount"
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
                  onChange={e => setPaymentType(e.target.value)}
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
              {deleting ? '…' : 'Delete'}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-brand-border/30 bg-brand-navy/30 overflow-x-auto">
            {loading ? (
              <p className="text-center text-gray-400 text-sm py-4">Loading…</p>
            ) : preds.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-4">No predictions.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-[11px] uppercase tracking-wider border-b border-brand-border/30">
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
                      onSaved={loadPreds}
                      onDelete={() => setPreds(ps => ps.filter(x => x.id !== p.id))}
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

export default function UserPredictionsPanel({ adminKey }) {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [newUserName,   setNewUserName]   = useState('');
  const [creatingUser,  setCreatingUser]  = useState(false);

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

  async function createUser(e) {
    e.preventDefault();
    const name = newUserName.trim();
    if (!name) return;
    setCreatingUser(true);
    try {
      await api.createAdminUser(adminKey, name);
      setNewUserName('');
      await load();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setCreatingUser(false);
    }
  }

  return (
    <div className="card p-0 overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-brand-border hover:bg-white/3 transition-colors"
        onClick={toggle}
      >
        <h2 className="font-black text-lg">User Predictions</h2>
        <div className="flex items-center gap-2">
          {users.length > 0 && <span className="text-xs text-gray-400">{users.length} players</span>}
          <span className={`text-gray-400 text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        </div>
      </button>

      {open && (
        loading ? (
          <p className="text-center text-gray-400 text-sm py-6">Loading…</p>
        ) : (
          <div>
            <form onSubmit={createUser} className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-brand-border/40 bg-brand-navy/20">
              <input
                type="text"
                value={newUserName}
                onChange={e => setNewUserName(e.target.value)}
                placeholder="Add dummy user name"
                className="flex-1 min-w-[220px] bg-brand-navy border border-brand-border rounded px-3 py-2 text-sm text-gray-300
                           focus:border-brand-gold focus:outline-none"
              />
              <button type="submit" disabled={creatingUser || !newUserName.trim()} className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                {creatingUser ? 'Adding...' : 'Add Dummy User'}
              </button>
            </form>
            {users.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">No users yet.</p>
            ) : (
              <div>
                {users.map(u => (
                  <UserRow
                    key={u.id}
                    user={u}
                    adminKey={adminKey}
                    onUserDeleted={id => setUsers(us => us.filter(x => x.id !== id))}
                    onUserUpdated={updated => setUsers(us => us.map(x => x.id === updated.id ? { ...x, ...updated } : x))}
                  />
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
