import { Link, useOutletContext } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import { useUi } from '../context/UiContext';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { ago } from '../utils/format';

export default function Notifications() {
  const { refreshUnread } = useOutletContext();
  const { toast } = useUi();
  const { data, error, loading, reload } = useFetch(() => api.get('/notifications'), []);

  async function mark(id) {
    try { await api.patch('/notifications/' + id + '/read'); reload(); refreshUnread(); } catch (e) { toast(e.message, 'bad'); }
  }
  async function markAll() {
    try { await api.patch('/notifications/read-all'); reload(); refreshUnread(); toast('All notifications marked as read.'); } catch (e) { toast(e.message, 'bad'); }
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Notifications</h1><p>Follow-up reminders and assignments that need your attention.</p></div>
        <div className="actions"><button className="btn" disabled={!data || data.unread === 0} onClick={markAll}>Mark all as read</button></div>
      </div>
      <ErrorMessage error={error} onRetry={reload} />
      {loading && !data && <LoadingSpinner />}
      {data && data.items.length === 0 && <div className="card"><EmptyState title="You are all caught up" message="New reminders and assignments will appear here." small /></div>}
      {data && data.items.length > 0 && (
        <section className="card" style={{ padding: 0 }}>
          <ul className="list">
            {data.items.map((n) => (
              <li key={n.id} className={n.read ? '' : 'unread'} style={{ padding: '12px 16px' }}>
                <div>
                  {n.link ? <Link to={n.link} onClick={() => !n.read && mark(n.id)}>{n.message}</Link> : n.message}
                  <div className="sub">{ago(n.at)} · {n.type}</div>
                </div>
                {!n.read && <button className="btn sm" onClick={() => mark(n.id)}>Mark read</button>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
