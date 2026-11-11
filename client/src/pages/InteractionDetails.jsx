import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Badge from '../components/Badge';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { fmtDate, fmtDateTime } from '../utils/format';

export default function InteractionDetails() {
  const { id } = useParams();
  const { can } = useAuth();
  const { toast } = useUi();
  const [assignee, setAssignee] = useState('');
  const { data: i, error, loading, reload } = useFetch(() => api.get('/interactions/' + id), [id]);
  const staff = useFetch(() => (can('interactions.assign') ? api.get('/users/directory') : Promise.resolve({ data: [] })), []);

  if (loading && !i) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={reload} title={error.status === 404 ? 'Interaction not found' : undefined} />;
  if (!i) return null;

  async function complete() {
    try { await api.patch('/interactions/' + id + '/complete'); toast('Follow-up marked as done.'); reload(); } catch (e) { toast(e.message, 'bad'); }
  }
  async function assign() {
    if (!assignee) return;
    try { await api.patch('/interactions/' + id + '/assign', { assigneeId: Number(assignee) }); toast('Follow-up reassigned.'); setAssignee(''); reload(); } catch (e) { toast(e.message, 'bad'); }
  }

  const openFollowUp = i.followUpDate && !i.followUpDone;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{i.subject}</h1>
          <p><Badge value={i.type} /> <Badge value={i.status} /> · <Link to={'/customers/' + i.customerId}>{i.customerName}</Link> <span className="mono muted">{i.customerCode}</span></p>
        </div>
        <div className="actions">
          {i.canEdit && can('interactions.edit') && <Link className="btn" to={'/interactions/' + id + '/edit'}>Edit</Link>}
          {i.canComplete && <button className="btn primary" onClick={complete}>Mark follow-up done</button>}
        </div>
      </div>

      <div className="detail-grid">
        <section className="card">
          <header><h2>Details</h2></header>
          <dl className="dl">
            <dt>When</dt><dd>{fmtDateTime(i.occurredAt)}</dd>
            <dt>Logged by</dt><dd>{i.userName}</dd>
            <dt>Outcome</dt><dd>{i.outcome || '—'}</dd>
            <dt>Follow-up</dt>
            <dd>{i.followUpDate ? <>{fmtDate(i.followUpDate)} {i.followUpDone ? <Badge value="Completed" label="Done" /> : i.overdue ? <Badge value="Overdue" /> : <Badge value="Due soon" label="Upcoming" />}</> : 'None'}</dd>
            {i.followUpDate && <><dt>Follow-up owner</dt><dd>{i.assigneeName || i.userName}</dd></>}
          </dl>
          {openFollowUp && can('interactions.assign') && (
            <div className="inline-form" style={{ marginTop: 16 }}>
              <div className="field"><label htmlFor="reassign">Reassign follow-up</label>
                <select id="reassign" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Choose a person…</option>
                  {(staff.data || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <button className="btn" disabled={!assignee} onClick={assign}>Reassign</button>
            </div>
          )}
        </section>
        <div className="stack">
          <section className="card"><header><h2>Notes</h2></header><p style={{ whiteSpace: 'pre-wrap' }}>{i.notes || 'No notes.'}</p></section>
          <section className="card">
            <header><h2>Change history</h2></header>
            {i.history.length === 0 ? <p className="muted">No changes since this was logged.</p> : (
              <ul className="list">{i.history.map((h) => <li key={h.id}><div>{h.summary}<div className="sub">{h.userName}</div></div><span className="muted mono">{fmtDateTime(h.at)}</span></li>)}</ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
