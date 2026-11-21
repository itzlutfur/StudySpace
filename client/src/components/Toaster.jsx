import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

let nextId = 1;

/**
 * Toast notifications, rendered into the `.toast-host` region.
 *
 * A toast may carry an action (e.g. "Undo" after removing a course), which
 * renders as a button inside the toast.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message, { type = 'ok', timeout = 4000, action = null } = {}) => {
      const id = nextId++;
      setToasts((list) => [...list, { id, message, type, action }]);
      if (timeout > 0) {
        const timer = setTimeout(() => dismiss(id), timeout);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-host" id="toast-host" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  dismiss(t.id);
                  t.action.onClick?.();
                }}
              >
                {t.action.label}
              </button>
            ) : null}
            <button
              type="button"
              className="btn-icon"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Access the toast helper: `const { toast } = useToast();` */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider');
  return ctx;
}
