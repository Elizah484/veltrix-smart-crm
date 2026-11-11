import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import { useUi } from '../context/UiContext';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { fmtDate } from '../utils/format';

function Side({ c, role }) {
  return (
    <div className="card">
      <div className="hint">{role}</div>
      <Link to={'/customers/' + c.id}><b>{c.firstName} {c.lastName}</b></Link>
      <div className="mono muted">{c.code} · {c.status}</div>
      <div>{c.email || '—'}</div>
      <div className="muted">{c.phone || ''}</div>
      <div className="hint">Registered {fmtDate(c.registeredOn)} · {c.orderCount} orders</div>
    </div>
  );
}

export default function DuplicateReview() {
  const { confirm, toast } = useUi();
  const { data, error, loading, reload } = useFetch(() => api.get('/customers/duplicates'), []);

  async function dismiss(pair) {
    try { await api.post('/customers/duplicates/dismiss', { customerAId: pair.a.id, customerBId: pair.b.id }); toast('Marked as different people.'); reload(); } catch (e) { toast(e.message, 'bad'); }
  }
  async function merge(keep, drop) {
    const ok = await confirm({
      title: 'Merge these customers?',
      message: 'All orders and interactions of ' + drop.firstName + ' ' + drop.lastName + ' (' + drop.code + ') move to ' + keep.firstName + ' ' + keep.lastName + ' (' + keep.code + '). The duplicate is archived, not deleted. This is recorded in the audit log.',
      confirmLabel: 'Merge',
    });
    if (!ok) return;
    try {
      const res = await api.post('/customers/merge', { keepId: keep.id, mergeId: drop.id });
      toast('Merged. ' + res.data.ordersMoved + ' orders and ' + res.data.interactionsMoved + ' interactions moved.');
      reload();
    } catch (e) { toast(e.message, 'bad'); }
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Duplicate review</h1><p>Customers that look like the same person. Merge them, or confirm they are different.</p></div>
        <Link className="btn" to="/customers">Back to customers</Link>
      </div>
      <ErrorMessage error={error} onRetry={reload} />
      {loading && !data && <LoadingSpinner />}
      {data && data.length === 0 && <div className="card"><EmptyState title="No possible duplicates" message="Every active customer looks unique." small /></div>}
      <div className="stack">
        {(data || []).map((p) => (
          <section className="card" key={p.a.id + '-' + p.b.id}>
            <header><h2>{p.reason}</h2></header>
            <div className="dupgrid">
              <Side c={p.a} role="Customer A" />
              <Side c={p.b} role="Customer B" />
            </div>
            <div className="form-foot">
              <button className="btn" onClick={() => merge(p.a, p.b)}><Icon name="merge" /> Keep A, merge B into it</button>
              <button className="btn" onClick={() => merge(p.b, p.a)}><Icon name="merge" /> Keep B, merge A into it</button>
              <button className="btn ghost" onClick={() => dismiss(p)}>They are different people</button>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
