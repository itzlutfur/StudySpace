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
          {state.detail ? <p className="muted small">{state.detail}</p> : null}
          <div className="row-actions row-actions-end" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn" onClick={() => close(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`}
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
