import { useState } from 'react';
import { api } from '../../api';
import ConfirmModal from './ConfirmModal';

export default function RecalculateButton({ adminKey, onDone }) {
  const [state,       setState]      = useState('idle'); // idle | running | done | error
  const [result,      setResult]     = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  async function run() {
    setShowConfirm(false);
    setState('running');
    try {
      const data = await api.recalculateAll(adminKey);
      setResult(data);
      setState('done');
      onDone?.();
      setTimeout(() => setState('idle'), 5000);
    } catch (e) {
      setState('error');
      setResult({ error: e.message });
      setTimeout(() => setState('idle'), 5000);
    }
  }

  return (
    <>
      {showConfirm && (
        <ConfirmModal
          title="Recalculate All Scores"
          message="Apply current scoring rules to every finished match? This will overwrite all existing point values."
          confirmLabel="Recalculate"
          onConfirm={run}
          onCancel={() => setShowConfirm(false)}
        />
      )}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={state === 'running'}
        className="card relative flex flex-col items-center justify-center gap-2 px-8 py-4 text-center flex-1
                   hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
      >
        {state === 'done' && (
          <span className="absolute inset-0 flex items-center justify-center text-2xl text-green-400 bg-[#0d1117]/80 rounded-xl">✓</span>
        )}
        {state === 'error' && (
          <span className="absolute inset-0 flex items-center justify-center text-2xl text-red-400 bg-[#0d1117]/80 rounded-xl">✗</span>
        )}
        <span className="text-sm font-bold text-gray-300 whitespace-nowrap">
          {state === 'running' ? 'Recalculating…' : 'Recalculate User Scores'}
        </span>
        <span className="text-[10px] text-gray-400 leading-tight">Recompute all player scores using the current scoring rules</span>
      </button>
    </>
  );
}
