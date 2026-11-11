import { useState } from 'react';
import Badge from '../components/Badge';
import DataTable from '../components/DataTable';
import ErrorMessage from '../components/ErrorMessage';
import { SelectField, TextField } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { ROLE_OPTIONS } from '../utils/constants';
import { fmtDateTime } from '../utils/format';

function UserDialog({ user, onClose, onSaved }) {
  const editing = !!user;
  const { toast } = useUi();
  const [form, setForm] = useState({ name: user ? user.name : '', email: user ? user.email : '', role: user ? user.role : 'employee', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setError(null); setErrors({}); setBusy(true);
    try {
      if (editing) {
        const body = { name: form.name, role: form.role };
        if (form.password) body.password = form.password;
        await api.put('/users/' + user.id, body);
      } else {
        await api.post('/users', form);
      }
      toast(editing ? 'User updated.' : 'User created.');
      onSaved();
    } catch (err) { setError(err); setErrors(err.fields || {}); } finally { setBusy(false); }
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="ud-title" onSubmit={submit} noValidate>
        <h2 id="ud-title">{editing ? 'Edit user' : 'Add user'}</h2>
        <ErrorMessage error={error && !error.fields ? error : null} />
        <div className="stack">
          <TextField name="name" label="Name" value={form.name} onChange={set} error={errors.name} required />
          <TextField name="email" label="Email" type="email" value={form.email} onChange={set} error={errors.email} required disabled={editing} />
          <SelectField name="role" label="Role" value={form.role} onChange={set} options={ROLE_OPTIONS} error={errors.role} required />
          <TextField name="password" label={editing ? 'New password (leave empty to keep)' : 'Temporary password'} type="password" autoComplete="new-password" value={form.password} onChange={set} error={errors.password} required={!editing} hint="At least 10 characters, with a letter and a number." />
        </div>
        <div className="foot">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const { confirm, toast } = useUi();
  const { data, error, loading, reload } = useFetch(() => api.get('/users'), []);
  const [dialog, setDialog] = useState(null); // null | 'new' | user

  async function toggle(u) {
    const ok = await confirm({
      title: u.active ? 'Deactivate ' + u.name + '?' : 'Reactivate ' + u.name + '?',
      message: u.active ? 'They can no longer sign in, effective immediately. Their records and history stay.' : 'They will be able to sign in again.',
      confirmLabel: u.active ? 'Deactivate' : 'Reactivate', danger: u.active,
    });
    if (!ok) return;
    try { await api.put('/users/' + u.id, { active: !u.active }); toast(u.active ? 'User deactivated.' : 'User reactivated.'); reload(); } catch (e) { toast(e.message, 'bad'); }
  }

  const columns = [
    { key: 'name', label: 'Name', render: (u) => <b>{u.name}{u.id === me.id ? ' (you)' : ''}</b> },
    { key: 'email', label: 'Email', render: (u) => u.email },
    { key: 'role', label: 'Role', render: (u) => u.roleName },
    { key: 'active', label: 'Status', render: (u) => <Badge value={u.active ? 'Active' : 'Inactive'} /> },
    { key: 'last', label: 'Last sign-in', render: (u) => fmtDateTime(u.lastLoginAt) },
    { key: 'actions', label: '', className: 'r', render: (u) => (
      <div className="actions" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
        <button className="btn sm" onClick={() => setDialog(u)}>Edit</button>
        {u.id !== me.id && <button className={'btn sm' + (u.active ? ' danger' : '')} onClick={() => toggle(u)}>{u.active ? 'Deactivate' : 'Reactivate'}</button>}
      </div>
    ) },
  ];

  return (
    <>
      <div className="page-head">
        <div><h1>User management</h1><p>Create accounts, change roles and switch access off.</p></div>
        <div className="actions"><button className="btn primary" onClick={() => setDialog('new')}>Add user</button></div>
      </div>
      <ErrorMessage error={error} onRetry={reload} />
      {!error && <DataTable columns={columns} rows={data} loading={loading} caption="Users" />}
      {dialog && <UserDialog user={dialog === 'new' ? null : dialog} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload(); }} />}
    </>
  );
}
