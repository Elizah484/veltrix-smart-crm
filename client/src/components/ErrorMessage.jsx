/** Friendly error box. Never shows technical details; the request id helps an administrator find the cause. */
export default function ErrorMessage({ error, onRetry, title }) {
  if (!error) return null;
  return (
    <div className="banner bad" role="alert">
      <div>
        <b>{title || 'That did not work'}</b>
        <div className="muted">{error.message || String(error)}</div>
        {error.requestId && <div className="hint mono">Reference: {error.requestId}</div>}
      </div>
      {onRetry && <button className="btn sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}
