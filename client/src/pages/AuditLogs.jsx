import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import { FilterField } from '../components/Form';
import Pager from '../components/Pager';
import { useDebounce } from '../hooks/useDebounce';
import { useFetch } from '../hooks/useFetch';
import { useListParams } from '../hooks/useListParams';
import { api } from '../services/api';
import { fmtDateTime } from '../utils/format';

const DEFAULTS = { q: '', userId: '', entityType: '', from: '', to: '', sort: 'at', dir: 'desc', page: '1' };
const ENTITIES = ['customer', 'interaction', 'order', 'user', 'settings', 'auth', 'report'];

function Details({ row }) {
  const [open, setOpen] = useState(false);
  if (!row.before && !row.after) return null;
  return (
    <div>
      <button className="link-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Hide details' : 'Show details'}</button>
      {open && <pre className="diff">{JSON.stringify({ before: row.before, after: row.after }, null, 2)}</pre>}
    </div>
  );
}

export default function AuditLogs() {
  const [p, update, toggleSort] = useListParams(DEFAULTS);
  const [q, setQ] = useState(p.q);
  const dq = useDebounce(q, 300);
  useEffect(() => { if (dq !== p.q) update({ q: dq }); /* eslint-disable-next-line */ }, [dq]);
  const users = useFetch(() => api.get('/users/directory'), []);
  const { data, meta, error, loading, reload } = useFetch(
    () => api.get('/audit-logs', { q: p.q, userId: p.userId, entityType: p.entityType, from: p.from, to: p.to, sort: p.sort, dir: p.dir, page: p.page }),
    [p.q, p.userId, p.entityType, p.from, p.to, p.sort, p.dir, p.page]
  );

  const columns = [
    { key: 'at', label: 'When', sortKey: 'at', render: (a) => <span className="mono">{fmtDateTime(a.at)}</span> },
    { key: 'user', label: 'User', sortKey: 'user', render: (a) => a.userName || <span className="muted">System</span> },
    { key: 'action', label: 'Action', sortKey: 'action', render: (a) => <span className="mono">{a.action}</span> },
    { key: 'summary', label: 'What happened', render: (a) => (<>{a.summary}<Details row={a} /><div className="hint mono">{a.entityType}{a.entityId ? ' #' + a.entityId : ''}{a.requestId ? ' · ' + a.requestId : ''}</div></>) },
  ];
  const filtered = p.q || p.userId || p.entityType || p.from || p.to;

  return (
    <>
      <div className="page-head"><div><h1>Audit logs</h1><p>A permanent record of who changed what. Entries cannot be edited or deleted from the app.</p></div></div>
      <div className="filters" role="search">
        <FilterField label="Search" grow><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Summary, record id or request reference" /></FilterField>
        <FilterField label="User"><select value={p.userId} onChange={(e) => update({ userId: e.target.value })}><option value="">Everyone</option>{(users.data || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></FilterField>
        <FilterField label="Record type"><select value={p.entityType} onChange={(e) => update({ entityType: e.target.value })}><option value="">All</option>{ENTITIES.map((u) => <option key={u}>{u}</option>)}</select></FilterField>
        <FilterField label="From"><input type="date" value={p.from} onChange={(e) => update({ from: e.target.value })} /></FilterField>
        <FilterField label="To"><input type="date" value={p.to} onChange={(e) => update({ to: e.target.value })} /></FilterField>
        {filtered && <button className="btn ghost" onClick={() => { setQ(''); update({ q: '', userId: '', entityType: '', from: '', to: '' }); }}>Clear filters</button>}
      </div>
      <ErrorMessage error={error} onRetry={reload} />
      {!error && (
        <>
          <DataTable columns={columns} rows={data} loading={loading} sort={p.sort} dir={p.dir} onSort={toggleSort} caption="Audit log"
            empty={<EmptyState small title="No entries" message="No audit entries match these filters." />} />
          <Pager meta={meta} label="entries" onPage={(n) => update({ page: String(n) })} />
        </>
      )}
    </>
  );
}
