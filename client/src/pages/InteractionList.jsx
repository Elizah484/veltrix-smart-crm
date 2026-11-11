import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/Badge';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import { FilterField } from '../components/Form';
import Pager from '../components/Pager';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { useFetch } from '../hooks/useFetch';
import { useListParams } from '../hooks/useListParams';
import { api } from '../services/api';
import { INTERACTION_STATUSES, INTERACTION_TYPES } from '../utils/constants';
import { fmtDate, fmtDateTime } from '../utils/format';

const DEFAULTS = { q: '', type: '', status: '', from: '', to: '', customerId: '', sort: 'at', dir: 'desc', page: '1' };

export default function InteractionList() {
  const { can } = useAuth();
  const [p, update, toggleSort] = useListParams(DEFAULTS);
  const [q, setQ] = useState(p.q);
  const dq = useDebounce(q, 300);
  useEffect(() => { if (dq !== p.q) update({ q: dq }); /* eslint-disable-next-line */ }, [dq]);

  const { data, meta, error, loading, reload } = useFetch(
    () => api.get('/interactions', { q: p.q, type: p.type, status: p.status, from: p.from, to: p.to, customerId: p.customerId, sort: p.sort, dir: p.dir, page: p.page }),
    [p.q, p.type, p.status, p.from, p.to, p.customerId, p.sort, p.dir, p.page]
  );

  const columns = [
    { key: 'at', label: 'When', sortKey: 'at', render: (i) => <span className="mono">{fmtDateTime(i.occurredAt)}</span> },
    { key: 'customer', label: 'Customer', sortKey: 'customer', render: (i) => <Link to={'/customers/' + i.customerId}>{i.customerName}</Link> },
    { key: 'type', label: 'Type', sortKey: 'type', render: (i) => <Badge value={i.type} /> },
    { key: 'subject', label: 'Subject', sortKey: 'subject', render: (i) => <Link to={'/interactions/' + i.id}><b>{i.subject}</b></Link> },
    { key: 'status', label: 'Status', sortKey: 'status', render: (i) => <Badge value={i.status} /> },
    { key: 'followUp', label: 'Follow-up', sortKey: 'followUp', render: (i) => (i.followUpDate ? <>{fmtDate(i.followUpDate)} {i.followUpDone ? <Badge value="Completed" label="Done" /> : i.overdue ? <Badge value="Overdue" /> : null}</> : <span className="muted">—</span>) },
    { key: 'by', label: 'Logged by', render: (i) => i.userName },
  ];
  const filtered = p.q || p.type || p.status || p.from || p.to || p.customerId;

  return (
    <>
      <div className="page-head">
        <div><h1>Interaction history</h1><p>Every call, email, meeting and complaint, newest first.</p></div>
        <div className="actions">
          <Link className="btn" to="/follow-ups">Follow-ups</Link>
          {can('interactions.create') && <Link className="btn primary" to="/interactions/new">Add interaction</Link>}
        </div>
      </div>

      <div className="filters" role="search" aria-label="Filter interactions">
        <FilterField label="Search" grow><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Subject, notes or customer" /></FilterField>
        <FilterField label="Type"><select value={p.type} onChange={(e) => update({ type: e.target.value })}><option value="">All</option>{INTERACTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select></FilterField>
        <FilterField label="Status"><select value={p.status} onChange={(e) => update({ status: e.target.value })}><option value="">All</option>{INTERACTION_STATUSES.map((t) => <option key={t}>{t}</option>)}</select></FilterField>
        <FilterField label="From"><input type="date" value={p.from} onChange={(e) => update({ from: e.target.value })} /></FilterField>
        <FilterField label="To"><input type="date" value={p.to} onChange={(e) => update({ to: e.target.value })} /></FilterField>
        {filtered && <button className="btn ghost" onClick={() => { setQ(''); update({ q: '', type: '', status: '', from: '', to: '', customerId: '' }); }}>Clear filters</button>}
      </div>

      <ErrorMessage error={error} onRetry={reload} />
      {!error && (
        <>
          <DataTable columns={columns} rows={data} loading={loading} sort={p.sort} dir={p.dir} onSort={toggleSort} caption="Interactions"
            empty={<EmptyState title={filtered ? 'No interactions match' : 'No interactions yet'} message={filtered ? 'Try different filters.' : 'Log the first call or email with a customer.'} actionLabel={!filtered && can('interactions.create') ? 'Add interaction' : null} to="/interactions/new" small={!!filtered} />} />
          <Pager meta={meta} label="interactions" onPage={(n) => update({ page: String(n) })} />
        </>
      )}
    </>
  );
}
