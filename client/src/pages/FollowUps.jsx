import { useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import { useUi } from '../context/UiContext';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { fmtDate } from '../utils/format';

const TABS = [['overdue', 'Overdue'], ['upcoming', 'Upcoming'], ['done', 'Completed']];

export default function FollowUps() {
  const { toast } = useUi();
  const [tab, setTab] = useState('overdue');
  const { data, error, loading, reload } = useFetch(() => api.get('/interactions/follow-ups', { state: tab }), [tab]);

  async function complete(id) {
    try { await api.patch('/interactions/' + id + '/complete'); toast('Follow-up marked as done.'); reload(); } catch (e) { toast(e.message, 'bad'); }
  }

  const counts = data ? data.counts : null;
  return (
    <>
      <div className="page-head"><div><h1>Follow-ups</h1><p>Promises to customers that still need action.</p></div></div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{counts ? ' (' + counts[k] + ')' : ''}</button>
        ))}
      </div>
      <ErrorMessage error={error} onRetry={reload} />
      {loading && !data && <LoadingSpinner />}
      {data && data.items.length === 0 && (
        <div className="card"><EmptyState small title={tab === 'overdue' ? 'Nothing overdue' : tab === 'upcoming' ? 'Nothing coming up' : 'Nothing completed yet'} message="Follow-ups you add to interactions will be listed here." /></div>
      )}
      {data && data.items.length > 0 && (
        <section className="card" style={{ padding: 0 }}>
          <ul className="list">
            {data.items.map((f) => (
              <li key={f.id} style={{ padding: '12px 16px' }}>
                <div>
                  <Link to={'/interactions/' + f.id}><b>{f.subject}</b></Link>
                  <div className="sub"><Link to={'/customers/' + f.customerId}>{f.customerName}</Link> · {f.type} · owner {f.assigneeName || f.userName}</div>
                </div>
                <div className="actions" style={{ alignItems: 'center', flexWrap: 'nowrap' }}>
                  <span>{fmtDate(f.followUpDate)}</span>
                  {tab === 'overdue' && <Badge value="Overdue" />}
                  {tab !== 'done' && <button className="btn sm" onClick={() => complete(f.id)}>Mark done</button>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
