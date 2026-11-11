import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';

/**
 * columns: [{ key, label, sortKey?, render?(row), className? }]
 * Sorting is done by the server; clicking a sortable header calls onSort(sortKey).
 */
export default function DataTable({ columns, rows, loading, sort, dir, onSort, empty, rowKey, caption }) {
  if (loading && !rows) return <LoadingSpinner />;
  if (rows && rows.length === 0) {
    return <div className="tablewrap">{empty || <EmptyState title="Nothing to show" message="No records match." small />}</div>;
  }
  return (
    <div className="tablewrap" aria-busy={loading ? 'true' : 'false'} style={loading ? { opacity: 0.6 } : undefined}>
      <table className="data">
        {caption && <caption className="sr">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.className} scope="col"
                  aria-sort={c.sortKey && sort === c.sortKey ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                {c.sortKey && onSort ? (
                  <button onClick={() => onSort(c.sortKey)}>
                    {c.label}
                    {sort === c.sortKey && <span className="sortmark">{dir === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((r, i) => (
            <tr key={rowKey ? rowKey(r) : r.id || i}>
              {columns.map((c) => (
                <td key={c.key} className={c.className}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
