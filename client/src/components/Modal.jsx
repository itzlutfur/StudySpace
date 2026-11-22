import { useEffect } from 'react';

/**
 * A modal dialog shell: backdrop, head, scrollable body.
 * Closes on Escape or a backdrop click.
 */
export default function Modal({ title, onClose, children, size = '' }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[100] grid place-items-center bg-black/70 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`modal flex max-h-[85vh] w-full flex-col rounded-2xl border border-hair-strong bg-card shadow-2xl ${
          size === 'lg' ? 'max-w-[760px]' : 'max-w-[520px]'
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-head flex items-center justify-between border-b border-hair px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            className="btn-icon rounded-lg px-2 py-1 text-lg leading-none text-ink-3 transition hover:bg-white/[0.05] hover:text-ink"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="modal-body scroll-thin overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
