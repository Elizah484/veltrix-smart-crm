export default function LoadingSpinner({ label }) {
  return (
    <div className="loading" role="status">
      <div className="spinner" aria-hidden="true" />
      <span>{label || 'Loading…'}</span>
    </div>
  );
}
