import { useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/Badge';
import { BarList, LineChart } from '../components/Charts';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { ago, fmtDate, money } from '../utils/format';

function Kpi({ label, value, sub, to, alert }) {
  const body = (<><span className="k">{label}</span><span className="v">{value}</span>{sub && <span className="s">{sub}</span>}</>);
  return to ? <Link to={to} className={'kpi' + (alert ? ' alert' : '')}>{body}</Link> : <div className={'kpi' + (alert ? ' alert' : '')}>{body}</div>;
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const [days, setDays] = useState(30);
  const summary = useFetch(() => api.get('/dashboard/summary', { days }), [days]);
  const cust = useFetch(() => api.get('/dashboard/customer-trends', { days }), [days]);
  const ord = useFetch(() => api.get('/dashboard/order-trends', { days }), [days]);

  const s = summary.data;
  const full = can('dashboard.full');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Welcome back, {user.name.split(' ')[0]}</h1>
          <p>{full ? 'Business overview' : 'Your customers and follow-ups'} for the last {days} days.</p>
        </div>
        <div className="seg" role="group" aria-label="Period">
          {[7, 30, 90].map((d) => (
            <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>{d} days</button>
          ))}
        </div>
      </div>

      <ErrorMessage error={summary.error} onRetry={summary.reload} title="The dashboard could not load" />
      {summary.loading && !s && <LoadingSpinner />}

      {s && (
        <>
          {s.duplicatesToReview > 0 && (
            <div className="banner">
              <div><b>{s.duplicatesToReview} possible duplicate {s.duplicatesToReview === 1 ? 'pair' : 'pairs'}</b><div className="muted">Review them so the same customer is not recorded twice.</div></div>
              <Link className="btn" to="/customers/duplicates">Review duplicates</Link>
            </div>
          )}

          <div className="kpis">
            <Kpi label="Registered customers" value={s.customers.registered} sub={s.customers.archived + ' archived'} to="/customers" />
            <Kpi label={'New in ' + days + ' days'} value={s.customers.newInPeriod} />
            <Kpi label="Total orders" value={s.orders.total} to="/orders" />
            <Kpi label="Pending orders" value={s.orders.pending} to="/orders?status=Pending" />
            <Kpi label="Completed orders" value={s.orders.completed} sub={s.orders.cancelled + ' cancelled'} />
            <Kpi label="Overdue follow-ups" value={s.followUps.counts.overdue} to="/follow-ups" alert={s.followUps.counts.overdue > 0} />
            {full && <Kpi label="Paid sales" value={money(s.orders.paidTotal)} />}
            {full && <Kpi label="Awaiting payment" value={money(s.orders.unpaidTotal)} />}
          </div>

          <div className="grid g2">
            <section className="card">
              <header><div><h2>Customer growth</h2><p>New customers per {days > 31 ? 'week' : 'day'}</p></div></header>
              {cust.data ? <LineChart points={cust.data.points} color="var(--s1)" label="New customers" /> : <LoadingSpinner />}
            </section>
            <section className="card">
              <header><div><h2>Orders placed</h2><p>Orders per {days > 31 ? 'week' : 'day'}</p></div></header>
              {ord.data ? <LineChart points={ord.data.orders} color="var(--s3)" label="Orders placed" /> : <LoadingSpinner />}
            </section>
            {full && (
              <section className="card">
                <header><div><h2>Sales</h2><p>Order value, cancelled orders excluded</p></div></header>
                {ord.data ? <LineChart points={ord.data.sales} color="var(--s4)" format={(n) => Math.round(n).toLocaleString()} label="Sales" /> : <LoadingSpinner />}
              </section>
            )}
            <section className="card">
              <header><div><h2>Orders by status</h2><p>All orders you can see</p></div></header>
              <BarList items={s.ordersByStatus} />
            </section>
            <section className="card">
              <header><div><h2>Interactions by type</h2><p>Last {days} days</p></div></header>
              <BarList items={s.interactionsByType} />
            </section>
          </div>

          <div className="grid g2" style={{ marginTop: 16 }}>
            <section className="card">
              <header><h2>Follow-ups</h2><Link to="/follow-ups" className="btn sm">Manage</Link></header>
              {s.followUps.overdue.length === 0 && s.followUps.upcoming.length === 0 && <EmptyState small title="Nothing due" message="No follow-ups are waiting." />}
              <ul className="list">
                {[...s.followUps.overdue, ...s.followUps.upcoming].slice(0, 6).map((f) => (
                  <li key={f.id}>
                    <div><Link to={'/interactions/' + f.id}>{f.subject}</Link><div className="sub">{f.customerName} · due {fmtDate(f.followUpDate)}</div></div>
                    <Badge value={f.overdue ? 'Overdue' : 'Due soon'} />
                  </li>
                ))}
              </ul>
            </section>
            <section className="card">
              <header><h2>Recent interactions</h2><Link to="/interactions" className="btn sm">All</Link></header>
              {s.recentInteractions.length === 0 && <EmptyState small title="No interactions yet" message="Log a call or email to see it here." />}
              <ul className="list">
                {s.recentInteractions.map((i) => (
                  <li key={i.id}>
                    <div><Link to={'/interactions/' + i.id}>{i.subject}</Link><div className="sub">{i.customerName} · {i.type}</div></div>
                    <span className="muted">{ago(i.occurredAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card" style={{ gridColumn: '1 / -1' }}>
              <header><h2>{can('audit.view') ? 'Recent activity' : 'Your recent activity'}</h2>{can('audit.view') && <Link to="/audit-logs" className="btn sm">Audit logs</Link>}</header>
              <ul className="list">
                {s.recentActivity.map((a) => (
                  <li key={a.id}><div>{a.summary}<div className="sub">{a.userName || 'System'}</div></div><span className="muted">{ago(a.at)}</span></li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </>
  );
}
