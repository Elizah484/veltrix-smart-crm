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
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../utils/constants';
import { fmtDate, money } from '../utils/format';

const DEFAULTS = { q: '', status: '', payment: '', from: '', to: '', sort: 'date', dir: 'desc', page: '1' };

export default function OrderList() {
  const { can } = useAuth();
  const [p, update, toggleSort] = useListParams(DEFAULTS);
  const [q, setQ] = useState(p.q);
  const dq = useDebounce(q, 300);
  useEffect(() => { if (dq !== p.q) update({ q: dq }); /* eslint-disable-next-line */ }, [dq]);

  const { data, meta, error, loading, reload } = useFetch(
    () => api.get('/orders', { q: p.q, status: p.status, payment: p.payment, from: p.from, to: p.to, sort: p.sort, dir: p.dir, page: p.page }),
    [p.q, p.status, p.payment, p.from, p.to, p.sort, p.dir, p.page]
  );

  const columns = [
    { key: 'code', label: 'Order', sortKey: 'code', render: (o) => <Link to={'/orders/' + o.id} className="mono"><b>{o.code}</b></Link> },
    { key: 'customer', label: 'Customer', sortKey: 'customer', render: (o) => <Link to={'/customers/' + o.customerId}>{o.customerName}</Link> },
    { key: 'date', label: 'Date', sortKey: 'date', render: (o) => fmtDate(o.orderDate) },
    { key: 'status', label: 'Status', sortKey: 'status', render: (o) => <Badge value={o.status} /> },
    { key: 'pay', label: 'Payment', sortKey: 'pay', render: (o) => <Badge value={o.paymentStatus} /> },
    { key: 'items', label: 'Items', className: 'r num', render: (o) => o.itemCount },
    { key: 'total', label: 'Total', sortKey: 'total', className: 'r num', render: (o) => money(o.total) },
  ];
  const filtered = p.q || p.status || p.payment || p.from || p.to;

  return (
    <>
      <div className="page-head">
        <div><h1>Orders</h1><p>Track orders from pending to delivered.</p></div>
        <div className="actions">{can('orders.create') && <Link className="btn primary" to="/orders/new">Create order</Link>}</div>
      </div>
      <div className="filters" role="search" aria-label="Filter orders">
        <FilterField label="Search" grow><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order ID or customer" /></FilterField>
        <FilterField label="Status"><select value={p.status} onChange={(e) => update({ status: e.target.value })}><option value="">All</option>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></FilterField>
        <FilterField label="Payment"><select value={p.payment} onChange={(e) => update({ payment: e.target.value })}><option value="">All</option>{PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></FilterField>
        <FilterField label="From"><input type="date" value={p.from} onChange={(e) => update({ from: e.target.value })} /></FilterField>
        <FilterField label="To"><input type="date" value={p.to} onChange={(e) => update({ to: e.target.value })} /></FilterField>
        {filtered && <button className="btn ghost" onClick={() => { setQ(''); update({ q: '', status: '', payment: '', from: '', to: '' }); }}>Clear filters</button>}
      </div>
      <ErrorMessage error={error} onRetry={reload} />
      {!error && (
        <>
          <DataTable columns={columns} rows={data} loading={loading} sort={p.sort} dir={p.dir} onSort={toggleSort} caption="Orders"
            empty={<EmptyState title={filtered ? 'No orders match' : 'No orders yet'} message={filtered ? 'Try different filters.' : 'Create the first order for a customer.'} actionLabel={!filtered && can('orders.create') ? 'Create order' : null} to="/orders/new" small={!!filtered} />} />
          <Pager meta={meta} label="orders" onPage={(n) => update({ page: String(n) })} />
        </>
      )}
    </>
  );
}
