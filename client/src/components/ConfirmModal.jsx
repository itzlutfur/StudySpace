import { createContext, useContext, useRef, useState } from 'react';

import Modal from './Modal.jsx';

const ConfirmContext = createContext(null);

/**
 * Hosts the confirmation dialog so any component can call `useConfirm()`.
 * `confirm({ title, message, detail, confirmLabel, danger })` resolves to
 * `true` when the user confirms and `false` when they cancel or press Escape.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = (options) =>
    new Promise((resolve) => {
      resolver.current = resolve;
      setState({
        title: 'Are you sure?',
        message: '',
        detail: '',
        confirmLabel: 'Confirm',
        danger: false,
        ...options,
      });
    });

  const close = (result) => {
    setState(null);
    resolver.current?.(result);
    resolver.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state ? (
        <Modal title={state.title} onClose={() => close(false)}>
          <p>{state.message}</p>
          {state.detail ? <p className="muted small mt-2 text-xs text-ink-3">{state.detail}</p> : null}
          <div className="row-actions row-actions-end mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-hair-strong px-4 py-2 text-sm text-ink-2 transition hover:bg-white/[0.04]"
              onClick={() => close(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
                state.danger
                  ? 'bg-rose-500 hover:bg-rose-600'
                  : 'bg-accent hover:bg-accent-hover'
              }`}
              onClick={() => close(true)}
              autoFocus
            >
              {state.confirmLabel}
            </button>
          </div>
        </Modal>
      ) : null}
    </ConfirmContext.Provider>
  );
}

/** Access the confirmation helper: `const confirm = useConfirm();` */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside a ConfirmProvider');
  return ctx;
}
