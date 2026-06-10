import { useState, useEffect } from 'react';

const STORAGE_KEY = 'dues_modal_dismissed';

export default function DuesModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-sm bg-brand-card border border-brand-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Gold accent bar */}
        <div className="h-1.5 w-full bg-brand-gold" />

        <div className="px-6 py-6 flex flex-col items-center text-center gap-4">
          <img src="/wc-logos/world-cup-trophy.png" alt="Trophy" className="w-16 h-16 object-contain" />

          <div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Don't forget your £5 entry fee
            </h2>
            <p className="mt-1.5 text-sm text-gray-400">
              Please make sure you've paid your £5 to be eligible for the prize. If you already have, you're all sorted!
            </p>
          </div>

          <button
            onClick={dismiss}
            className="w-full py-2.5 rounded-xl bg-brand-gold text-brand-navy font-bold text-sm
              hover:bg-brand-gold/90 active:scale-95 transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
