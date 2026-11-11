export default function Pager({ meta, onPage, label }) {
  if (!meta) return null;
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.total, meta.page * meta.pageSize);
  return (
    <nav className="pager" aria-label="Pagination">
      <span>{from}–{to} of {meta.total} {label || 'results'}</span>
      <div className="btns">
        <button className="btn sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</button>
        <span style={{ alignSelf: 'center' }}>Page {meta.page} of {meta.totalPages}</span>
        <button className="btn sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next</button>
      </div>
    </nav>
  );
}
