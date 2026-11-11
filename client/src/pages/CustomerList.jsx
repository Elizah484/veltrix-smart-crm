import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/Badge';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import { FilterField } from '../components/Form';
import Pager from '../components/Pager';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useDebounce } from '../hooks/useDebounce';
import { useFetch } from '../hooks/useFetch';
import { useListParams } from '../hooks/useListParams';
import { api } from '../services/api';
import { CATEGORIES, CUSTOMER_STATUSES } from '../utils/constants';
import { fmtDate } from '../utils/format';

const DEFAULTS = { q: '', category: '', status: '', from: '', to: '', sort: 'code', dir: 'desc', page: '1' };

export default function CustomerList() {
  const { can } = useAuth();
  const { confirm, toast } = useUi();
  const [p, update, toggleSort] = useListParams(DEFAULTS);
  const [q, setQ] = useState(p.q);
  const dq = useDebounce(q, 300);

  useEffect(() => { if (dq !== p.q) update({ q: dq }); /* eslint-disable-next-line */ }, [dq]);

  const { data, meta, error, loading, reload } = useFetch(
    () => api.get('/customers', { q: p.q, category: p.category, status: p.status, from: p.from, to: p.to, sort: p.sort, dir: p.dir, page: p.page }),
    [p.q, p.category, p.status, p.from, p.to, p.sort, p.dir, p.page]
  );

  async function setStatus(c, status) {
    const ok = await confirm({
      title: status === 'Archived' ? 'Archive this customer?' : 'Restore this customer?',
      message: status === 'Archived'
        ? c.firstName + ' ' + c.lastName + ' will be hidden from normal lists. Their orders and history are kept, and you can restore them later.'
        : c.firstName + ' ' + c.lastName + ' will become active again.',
      confirmLabel: status === 'Archived' ? 'Archive' : 'Restore',
      danger: status === 'Archived',
    });
    if (!ok) return;
    try { await api.patch('/customers/' + c.id + '/status', { status }); toast(status === 'Archived' ? 'Customer archived.' : 'Customer restored.'); reload(); } catch (e) { toast(e.message, 'bad'); }
  }

  const columns = [
    { key: 'code', label: 'ID', sortKey: 'code', render: (c) => <span className="mono">{c.code}</span> },
    { key: 'name', label: 'Customer', sortKey: 'name', render: (c) => (<><Link to={'/customers/' + c.id}><b>{c.firstName} {c.lastName}</b></Link>{c.company && <div className="muted" style={{ fontSize: 13 }}>{c.company}</div>}</>) },
    { key: 'contact', label: 'Contact', sortKey: 'email', render: (c) => (<>{c.email || <span className="muted">—</span>}<div className="muted mono">{c.phone || ''}</div></>) },
    { key: 'category', label: 'Category', sortKey: 'category', render: (c) => c.category },
    { key: 'status', label: 'Status', sortKey: 'status', render: (c) => <Badge value={c.status} /> },
    { key: 'registered', label: 'Registered', sortKey: 'registered', render: (c) => fmtDate(c.registeredOn) },
    { key: 'assigned', label: 'Assigned to', sortKey: 'assigned', render: (c) => c.assignedName || <span className="muted">Unassigned</span> },
    { key: 'actions', label: '', className: 'r', render: (c) => (
      <div className="actions" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
        <Link className="btn sm" to={'/customers/' + c.id}>View</Link>
        {can('customers.edit') && c.status !== 'Archived' && <Link className="btn sm" to={'/customers/' + c.id + '/edit'}>Edit</Link>}
        {can('customers.archive') && (c.status === 'Archived'
          ? <button className="btn sm" onClick={() => setStatus(c, 'Active')}>Restore</button>
          : <button className="btn sm danger" onClick={() => setStatus(c, 'Archived')}>Archive</button>)}
      </div>
    ) },
  ];

  const filtered = p.q || p.category || p.status || p.from || p.to;

  return (
    <>
      <div className="page-head">
        <div><h1>Customers</h1><p>Search, filter and manage customer records.</p></div>
        <div className="actions">
          {can('customers.merge') && <Link className="btn" to="/customers/duplicates">Review duplicates</Link>}
          {can('customers.create') && <Link className="btn primary" to="/customers/new">Add customer</Link>}
        </div>
      </div>

      <div className="filters" role="search" aria-label="Filter customers">
        <FilterField label="Search" grow><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone, company or ID" /></FilterField>
        <FilterField label="Category"><select value={p.category} onChange={(e) => update({ category: e.target.value })}><option value="">All</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></FilterField>
        <FilterField label="Status"><select value={p.status} onChange={(e) => update({ status: e.target.value })}><option value="">Active and inactive</option>{CUSTOMER_STATUSES.map((c) => <option key={c}>{c}</option>)}</select></FilterField>
        <FilterField label="Registered from"><input type="date" value={p.from} onChange={(e) => update({ from: e.target.value })} /></FilterField>
        <FilterField label="Registered to"><input type="date" value={p.to} onChange={(e) => update({ to: e.target.value })} /></FilterField>
        {filtered && <button className="btn ghost" onClick={() => { setQ(''); update({ q: '', category: '', status: '', from: '', to: '' }); }}>Clear filters</button>}
      </div>

      <ErrorMessage error={error} onRetry={reload} title="Customers could not load" />
      {!error && (
        <>
          <DataTable columns={columns} rows={data} loading={loading} sort={p.sort} dir={p.dir} onSort={toggleSort} caption="Customers"
            empty={filtered
              ? <EmptyState title="No customers match" message="Try a different search or clear the filters." small />
              : <EmptyState title="No customers yet" message="Add your first customer to get started." actionLabel={can('customers.create') ? 'Add customer' : null} to="/customers/new" />} />
          <Pager meta={meta} label="customers" onPage={(n) => update({ page: String(n) })} />
        </>
      )}
    </>
  );
}
