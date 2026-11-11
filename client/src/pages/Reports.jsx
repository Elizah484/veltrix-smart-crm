import { useState } from 'react';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import Icon from '../components/Icon';
import { useFetch } from '../hooks/useFetch';
import { api, downloadCsv } from '../services/api';
import { REPORTS } from '../utils/constants';

export default function Reports() {
  const { can } = useAuth();
  const { toast } = useUi();
  const available = REPORTS.filter((r) => !r.permission || can(r.permission));
  const [type, setType] = useState(available[0].type);
  const [range, setRange] = useState({ from: '', to: '' });
  const { data, error, loading, reload } = useFetch(() => api.get('/reports/' + type, range), [type, range.from, range.to]);

  async function exportCsv() {
    try { await downloadCsv(type, range); toast('Report downloaded.'); } catch (e) { toast(e.message, 'bad'); }
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Reports</h1><p>View a report on screen, or download it as a CSV file for Excel.</p></div>
        {can('reports.export') && <div className="actions"><button className="btn primary" onClick={exportCsv}><Icon name="download" /> Download CSV</button></div>}
      </div>

      <div className="filters">
        <div className="f grow"><label htmlFor="rtype">Report</label>
          <select id="rtype" value={type} onChange={(e) => setType(e.target.value)}>{available.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}</select>
        </div>
        <div className="f"><label htmlFor="rfrom">From</label><input id="rfrom" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></div>
        <div className="f"><label htmlFor="rto">To</label><input id="rto" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></div>
      </div>
      <p className="muted">{(available.find((r) => r.type === type) || {}).about}</p>

      <ErrorMessage error={error} onRetry={reload} />
      {loading && !data && <LoadingSpinner />}
      {data && (
        <>
          {data.note && <div className="banner info"><div>{data.note}</div></div>}
          {data.rows.length === 0 ? <div className="card"><div className="empty sm"><b>No data for this report</b>Try a wider date range.</div></div> : (
            <div className="tablewrap" style={loading ? { opacity: 0.6 } : undefined}>
              <table className="data">
                <caption className="sr">{data.title}</caption>
                <thead><tr>{data.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
                <tbody>{data.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v === null || v === undefined || v === '' ? <span className="muted">—</span> : String(v)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
          {data.totalRows > data.rows.length && <p className="hint">Showing the first {data.rows.length} of {data.totalRows} rows. Download the CSV for everything.</p>}
        </>
      )}
    </>
  );
}
