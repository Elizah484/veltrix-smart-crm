import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const UiContext = createContext(null);
export const useUi = () => useContext(UiContext);

/** Toast messages and a promise-based confirmation dialog. */
export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((message, kind) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, kind: kind || 'ok' }]);
    setTimeout(() => dismiss(id), kind === 'bad' ? 7000 : 4000);
  }, [dismiss]);

  const confirm = useCallback((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);
  const close = (answer) => { dialog.resolve(answer); setDialog(null); };

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      <div id="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + (t.kind === 'ok' ? '' : t.kind)}>
            <button className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>×</button>
            {t.message}
          </div>
        ))}
      </div>
      {dialog && <ConfirmDialog {...dialog} onAnswer={close} />}
    </UiContext.Provider>
  );
}

function ConfirmDialog({ title, message, confirmLabel, danger, onAnswer, children }) {
  const btn = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    if (btn.current) btn.current.focus();
    const onKey = (e) => { if (e.key === 'Escape') onAnswer(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); };
  }, [onAnswer]);

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onAnswer(false); }}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg">
        <h2 id="dlg-title">{title || 'Are you sure?'}</h2>
        <p id="dlg-msg" className="muted">{message}</p>
        {children}
        <div className="foot">
          <button className="btn ghost" onClick={() => onAnswer(false)}>Cancel</button>
          <button ref={btn} className={'btn ' + (danger ? 'danger' : 'primary')} onClick={() => onAnswer(true)}>{confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}
