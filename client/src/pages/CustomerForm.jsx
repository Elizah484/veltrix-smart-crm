import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ErrorMessage from '../components/ErrorMessage';
import { SelectField, TextArea, TextField } from '../components/Form';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { CATEGORIES } from '../utils/constants';
import { fmtDate, todayLocalYmd } from '../utils/format';

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', company: '', address: '', category: 'Retail', status: 'Active', registeredOn: '', assignedUserId: '', notes: '' };

function Matches({ list, title, tone }) {
  if (!list || !list.length) return null;
  return (
    <div className={'banner' + (tone === 'bad' ? ' bad' : '')} role="alert">
      <div>
        <b>{title}</b>
        <div className="dupgrid">
          {list.map((c) => (
            <div className="card" key={c.id}>
              <Link to={'/customers/' + c.id} target="_blank" rel="noreferrer"><b>{c.firstName} {c.lastName}</b></Link>
              <div className="muted mono">{c.code} · {c.status}</div>
              <div>{c.email || '—'}</div><div className="muted">{c.phone || ''}</div>
              <div className="hint">Registered {fmtDate(c.registeredOn)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CustomerForm() {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const { can } = useAuth();
  const { toast } = useUi();

  const [form, setForm] = useState({ ...EMPTY, registeredOn: todayLocalYmd() });
  const [version, setVersion] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [dups, setDups] = useState({ hard: [], soft: [] });
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const checkSeq = useRef(0);

  const staff = useFetch(() => (can('customers.view_all') ? api.get('/users/directory') : Promise.resolve({ data: [] })), []);
  const existing = useFetch(() => (editing ? api.get('/customers/' + id) : Promise.resolve(null)), [id]);

  useEffect(() => {
    const c = existing.data;
    if (!c) return;
    setForm({
      firstName: c.firstName, lastName: c.lastName, email: c.email || '', phone: c.phone || '', company: c.company || '', address: c.address || '',
      category: c.category, status: c.status === 'Archived' ? 'Inactive' : c.status, registeredOn: c.registeredOn,
      assignedUserId: c.assignedUserId ? String(c.assignedUserId) : '', notes: c.notes || '',
    });
    setVersion(c.version);
  }, [existing.data]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); setOverride(false); };

  // Warn about likely duplicates as soon as the person leaves the name, email or phone field
  async function checkNow() {
    const hasName = form.firstName.trim() && form.lastName.trim();
    if (!form.email.trim() && !form.phone.trim() && !hasName) return;
    const seq = ++checkSeq.current;
    try {
      const res = await api.post('/customers/check-duplicates', {
        firstName: form.firstName || 'x', lastName: form.lastName || 'x', email: form.email || undefined, phone: form.phone || undefined,
        excludeId: editing ? Number(id) : undefined,
      });
      if (seq === checkSeq.current) setDups(res.data);
    } catch (e) { /* the real check happens again on save */ }
  }

  function payload(extra) {
    const body = {
      firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, company: form.company, address: form.address,
      category: form.category, status: form.status, registeredOn: form.registeredOn, notes: form.notes, ...extra,
    };
    if (form.assignedUserId) body.assignedUserId = Number(form.assignedUserId);
    if (editing) body.version = version;
    return body;
  }

  async function submit(e) {
    e.preventDefault();
    setError(null); setErrors({}); setBusy(true);
    try {
      const body = payload(override ? { confirmDuplicate: true } : {});
      const res = editing ? await api.put('/customers/' + id, body) : await api.post('/customers', body);
      toast(editing ? 'Customer updated.' : 'Customer added.');
      nav('/customers/' + res.data.id);
    } catch (err) {
      if (err.code === 'POSSIBLE_DUPLICATE') setDups({ hard: [], soft: err.existing || [] });
      else if (err.code === 'DUPLICATE_EMAIL') setDups({ hard: err.existing || [], soft: [] });
      if (err.fields) setErrors(err.fields);
      setError(err);
    } finally { setBusy(false); }
  }

  if (editing && existing.loading && !existing.data) return <LoadingSpinner />;
  if (editing && existing.error) return <ErrorMessage error={existing.error} onRetry={existing.reload} />;
  if (editing && existing.data && existing.data.status === 'Archived') {
    return <div className="banner"><div><b>This customer is archived</b><div className="muted">Restore the customer from the customer list before editing.</div></div><Link className="btn" to={'/customers/' + id}>Back</Link></div>;
  }

  const showError = error && error.code !== 'POSSIBLE_DUPLICATE' && error.code !== 'DUPLICATE_EMAIL' && error.code !== 'VALIDATION_ERROR';
  const possible = error && error.code === 'POSSIBLE_DUPLICATE';

  return (
    <>
      <div className="page-head">
        <div><h1>{editing ? 'Edit customer' : 'Add customer'}</h1><p>Fields marked * are required. Give an email, a phone number, or both.</p></div>
      </div>

      {showError && (
        <ErrorMessage error={error} title={error.code === 'VERSION_CONFLICT' ? 'This customer changed while you were editing' : undefined}
          onRetry={error.code === 'VERSION_CONFLICT' ? () => window.location.reload() : undefined} />
      )}
      <Matches list={dups.hard} tone="bad" title="An active customer already uses this email address. Open that record instead of creating a second one." />
      <Matches list={dups.soft} title="Similar customers already exist. Check they are not the same person." />
      {possible && (
        <div className="banner info" role="status">
          <div><b>Not a duplicate?</b><div className="muted">If this really is a different person, confirm below and save again.</div></div>
          <label className="cb"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Yes, this is a different customer</label>
        </div>
      )}

      <form className="card" onSubmit={submit} noValidate>
        <div className="fgrid">
          <TextField name="firstName" label="First name" value={form.firstName} onChange={set} onBlur={checkNow} error={errors.firstName} required maxLength={60} autoComplete="off" />
          <TextField name="lastName" label="Last name" value={form.lastName} onChange={set} onBlur={checkNow} error={errors.lastName} required maxLength={60} autoComplete="off" />
          <TextField name="email" label="Email" type="email" value={form.email} onChange={set} onBlur={checkNow} error={errors.email} maxLength={190} autoComplete="off" />
          <TextField name="phone" label="Phone" type="tel" value={form.phone} onChange={set} onBlur={checkNow} error={errors.phone} hint="For example 0712 345 678" maxLength={30} autoComplete="off" />
          <TextField name="company" label="Company" value={form.company} onChange={set} error={errors.company} maxLength={120} />
          <SelectField name="category" label="Category" value={form.category} onChange={set} options={CATEGORIES} error={errors.category} />
          <SelectField name="status" label="Status" value={form.status} onChange={set} options={['Active', 'Inactive']} error={errors.status} />
          <TextField name="registeredOn" label="Registration date" type="date" max={todayLocalYmd()} value={form.registeredOn} onChange={set} error={errors.registeredOn} required />
          {can('customers.view_all') && (
            <SelectField name="assignedUserId" label="Assigned to" value={form.assignedUserId} onChange={set} blank="Unassigned" error={errors.assignedUserId}
              options={(staff.data || []).map((u) => ({ value: String(u.id), label: u.name }))} />
          )}
          <TextField name="address" label="Address" value={form.address} onChange={set} error={errors.address} maxLength={255} full />
          <TextArea name="notes" label="Notes" value={form.notes} onChange={set} error={errors.notes} maxLength={5000} full />
        </div>
        <div className="form-foot">
          <button className="btn primary" disabled={busy || (possible && !override)}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add customer'}</button>
          <Link className="btn ghost" to={editing ? '/customers/' + id : '/customers'}>Cancel</Link>
        </div>
      </form>
    </>
  );
}
