import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Badge from '../components/Badge';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { ago, fmtDate, fmtDateTime, money } from '../utils/format';

export function InteractionTimeline({ items }) {
  if (!items.length) return <EmptyState small title="No interactions yet" message="Calls, emails and meetings will appear here." />;
  return (
    <ol className="timeline">
      {items.map((i) => (
        <li key={i.id} className={i.type === 'Complaint' ? 'complaint' : ''}>
          <div className="t">
            <Link to={'/interactions/' + i.id}><b>{i.subject}</b></Link>
            <Badge value={i.type} />
            <Badge value={i.status} />
            {i.followUpDate && !i.followUpDone && <Badge value={i.overdue ? 'Overdue' : 'Due soon'} label={'Follow-up ' + fmtDate(i.followUpDate)} />}
            <span className="when">{fmtDateTime(i.occurredAt)} · {i.userName}</span>
          </div>
          {i.notes && <p>{i.notes}</p>}
          {i.outcome && <p><b>Outcome:</b> {i.outcome}</p>}
        </li>
      ))}
    </ol>
  );
}

function InteractionsTab({ id }) {
  const { data, error, loading, reload } = useFetch(() => api.get('/customers/' + id + '/interactions'), [id]);
  if (loading && !data) return <LoadingSpinner />;
  return <><ErrorMessage error={error} onRetry={reload} />{data && <InteractionTimeline items={data} />}</>;
}

function OrdersTab({ id }) {
  const { data, error, loading, reload } = useFetch(() => api.get('/customers/' + id + '/orders'), [id]);
  const columns = [
    { key: 'code', label: 'Order', render: (o) => <Link to={'/orders/' + o.id} className="mono">{o.code}</Link> },
    { key: 'date', label: 'Date', render: (o) => fmtDate(o.orderDate) },
    { key: 'status', label: 'Status', render: (o) => <Badge value={o.status} /> },
    { key: 'pay', label: 'Payment', render: (o) => <Badge value={o.paymentStatus} /> },
    { key: 'total', label: 'Total', className: 'r num', render: (o) => money(o.total) },
  ];
  return (
    <>
      <ErrorMessage error={error} onRetry={reload} />
      {!error && <DataTable columns={columns} rows={data} loading={loading} empty={<EmptyState small title="No orders yet" message="Orders for this customer will appear here." />} />}
    </>
  );
}

function HistoryTab({ id }) {
  const { data, error, loading, reload } = useFetch(() => api.get('/customers/' + id + '/history'), [id]);
  if (loading && !data) return <LoadingSpinner />;
  return (
    <>
      <ErrorMessage error={error} onRetry={reload} />
      {data && data.length === 0 && <EmptyState small title="No changes recorded" message="Edits to this profile will be listed here." />}
      {data && data.length > 0 && (
        <ul className="list">
          {data.map((a) => (
            <li key={a.id}><div>{a.summary}<div className="sub">{a.userName || 'System'}</div></div><span className="muted mono">{fmtDateTime(a.at)}</span></li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function CustomerDetails() {
  const { id } = useParams();
  const { can } = useAuth();
  const { confirm, toast } = useUi();
  const [tab, setTab] = useState('interactions');
  const { data: c, error, loading, reload } = useFetch(() => api.get('/customers/' + id).then((r) => r), [id]);

  if (loading && !c) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={reload} title={error.status === 404 ? 'Customer not found' : undefined} />;
  if (!c) return null;

  async function setStatus(status) {
    const ok = await confirm({
      title: status === 'Archived' ? 'Archive this customer?' : 'Restore this customer?',
      message: status === 'Archived' ? 'They will be hidden from normal lists. Orders and history are kept.' : 'They will become active again.',
      confirmLabel: status === 'Archived' ? 'Archive' : 'Restore', danger: status === 'Archived',
    });
    if (!ok) return;
    try { await api.patch('/customers/' + id + '/status', { status }); toast(status === 'Archived' ? 'Customer archived.' : 'Customer restored.'); reload(); } catch (e) { toast(e.message, 'bad'); }
  }

  const archived = c.status === 'Archived';
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{c.firstName} {c.lastName}</h1>
          <p><span className="mono">{c.code}</span> · <Badge value={c.status} /> · {c.category}{c.company ? ' · ' + c.company : ''}</p>
        </div>
        <div className="actions">
          {c.canEdit && !archived && can('customers.edit') && <Link className="btn" to={'/customers/' + id + '/edit'}>Edit</Link>}
          {!archived && can('interactions.create') && <Link className="btn" to={'/interactions/new?customerId=' + id}>Log interaction</Link>}
          {!archived && can('orders.create') && <Link className="btn primary" to={'/orders/new?customerId=' + id}>Create order</Link>}
          {can('customers.archive') && (archived ? <button className="btn" onClick={() => setStatus('Active')}>Restore</button> : <button className="btn danger" onClick={() => setStatus('Archived')}>Archive</button>)}
        </div>
      </div>

      {archived && <div className="banner"><div><b>This customer is archived.</b><div className="muted">The record is read-only. Restore it to log interactions or create orders.</div></div></div>}

      <div className="kpis">
        <div className="kpi"><span className="k">Orders</span><span className="v">{c.orderCount}</span></div>
        <div className="kpi"><span className="k">Lifetime value</span><span className="v">{money(c.lifetimeValue)}</span><span className="s">Cancelled orders excluded</span></div>
        <div className="kpi"><span className="k">Interactions</span><span className="v">{c.interactionCount}</span></div>
      </div>

      <div className="detail-grid">
        <section className="card">
          <header><h2>Details</h2></header>
          <dl className="dl">
            <dt>Email</dt><dd>{c.email ? <a href={'mailto:' + c.email}>{c.email}</a> : '—'}</dd>
            <dt>Phone</dt><dd>{c.phone || '—'}</dd>
            <dt>Address</dt><dd>{c.address || '—'}</dd>
            <dt>Registered</dt><dd>{fmtDate(c.registeredOn)}</dd>
            <dt>Assigned to</dt><dd>{c.assignedName || 'Unassigned'}</dd>
            <dt>Last updated</dt><dd>{ago(c.updatedAt)}</dd>
            <dt>Notes</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{c.notes || '—'}</dd>
          </dl>
        </section>
        <section className="card">
          <div className="tabs" role="tablist">
            {[['interactions', 'Interactions'], ['orders', 'Orders'], ['history', 'Change history']].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          {tab === 'interactions' && <InteractionsTab id={id} />}
          {tab === 'orders' && <OrdersTab id={id} />}
          {tab === 'history' && <HistoryTab id={id} />}
        </section>
      </div>
    </>
  );
}
