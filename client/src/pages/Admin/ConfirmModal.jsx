import { createPortal } from 'react-dom';

export default function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) {
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
            className={`px-4 py-2 rounded text-sm font-bold transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-brand-gold text-brand-navy hover:brightness-110'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
