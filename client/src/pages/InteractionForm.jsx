import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CustomerPicker from '../components/CustomerPicker';
import ErrorMessage from '../components/ErrorMessage';
import { SelectField, TextArea, TextField } from '../components/Form';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { INTERACTION_STATUSES, INTERACTION_TYPES } from '../utils/constants';
import { fromLocalInput, toLocalInput } from '../utils/format';

export default function InteractionForm() {
  const { id } = useParams();
  const editing = !!id;
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const { toast } = useUi();

  const [form, setForm] = useState({ customerId: sp.get('customerId') || '', type: 'Phone call', occurredAt: toLocalInput(), subject: '', notes: '', outcome: '', followUpDate: '', followUpAssigneeId: '', status: 'Open' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const staff = useFetch(() => api.get('/users/directory'), []);
  const existing = useFetch(() => (editing ? api.get('/interactions/' + id) : Promise.resolve(null)), [id]);

  useEffect(() => {
    const i = existing.data;
    if (!i) return;
    setForm({
      customerId: String(i.customerId), type: i.type, occurredAt: toLocalInput(i.occurredAt), subject: i.subject, notes: i.notes || '', outcome: i.outcome || '',
      followUpDate: i.followUpDate || '', followUpAssigneeId: i.followUpAssigneeId ? String(i.followUpAssigneeId) : '', status: i.status,
    });
  }, [existing.data]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  async function submit(e) {
    e.preventDefault();
    setError(null); setErrors({}); setBusy(true);
    const body = {
      customerId: form.customerId ? Number(form.customerId) : undefined, type: form.type, occurredAt: fromLocalInput(form.occurredAt), subject: form.subject,
      notes: form.notes, outcome: form.outcome, status: form.status,
    };
    if (form.followUpDate) {
      body.followUpDate = form.followUpDate;
      if (form.followUpAssigneeId) body.followUpAssigneeId = Number(form.followUpAssigneeId);
    }
    try {
      const res = editing ? await api.put('/interactions/' + id, body) : await api.post('/interactions', body);
      toast(editing ? 'Interaction updated.' : 'Interaction saved.');
      nav('/interactions/' + res.data.id);
    } catch (err) { setError(err); setErrors(err.fields || {}); } finally { setBusy(false); }
  }

  if (editing && existing.loading && !existing.data) return <LoadingSpinner />;
  if (editing && existing.error) return <ErrorMessage error={existing.error} onRetry={existing.reload} />;

  return (
    <>
      <div className="page-head"><div><h1>{editing ? 'Edit interaction' : 'Add interaction'}</h1><p>Record what happened and when to follow up.</p></div></div>
      <ErrorMessage error={error && !error.fields ? error : null} />
      <form className="card" onSubmit={submit} noValidate>
        <div className="fgrid">
          <div className="full"><CustomerPicker value={form.customerId} onChange={(cid) => set('customerId', cid ? String(cid) : '')} error={errors.customerId} required disabled={editing} /></div>
          <SelectField name="type" label="Type" value={form.type} onChange={set} options={INTERACTION_TYPES} error={errors.type} required />
          <TextField name="occurredAt" label="Date and time" type="datetime-local" value={form.occurredAt} onChange={set} error={errors.occurredAt} required />
          <TextField name="subject" label="Subject" value={form.subject} onChange={set} error={errors.subject} required maxLength={150} full />
          <TextArea name="notes" label="Notes" value={form.notes} onChange={set} error={errors.notes} maxLength={5000} full />
          <TextField name="outcome" label="Outcome" value={form.outcome} onChange={set} error={errors.outcome} maxLength={255} full />
          <SelectField name="status" label="Status" value={form.status} onChange={set} options={INTERACTION_STATUSES} error={errors.status} />
          <TextField name="followUpDate" label="Follow-up date" type="date" value={form.followUpDate} onChange={set} error={errors.followUpDate} hint="Leave empty if no follow-up is needed" />
          {form.followUpDate && can('interactions.assign') && (
            <SelectField name="followUpAssigneeId" label="Follow-up owner" value={form.followUpAssigneeId} onChange={set} blank="Me" error={errors.followUpAssigneeId}
              options={(staff.data || []).map((u) => ({ value: String(u.id), label: u.name }))} />
          )}
        </div>
        <div className="form-foot">
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save interaction'}</button>
          <Link className="btn ghost" to={editing ? '/interactions/' + id : '/interactions'}>Cancel</Link>
        </div>
      </form>
    </>
  );
}
