import { useState } from 'react';
import ErrorMessage from '../components/ErrorMessage';
import { TextField } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { api } from '../services/api';
import { fmtDateTime } from '../utils/format';

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useUi();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (form.newPassword !== form.confirm) { setFields({ confirm: 'The two passwords do not match.' }); return; }
    setFields({});
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      toast('Password changed.');
    } catch (err) {
      setError(err);
      setFields(err.fields || {});
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="page-head"><div><h1>My profile</h1><p>Your account details and password.</p></div></div>
      <div className="grid g2">
        <section className="card">
          <header><h2>Account</h2></header>
          <dl className="dl">
            <dt>Name</dt><dd>{user.name}</dd>
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Role</dt><dd>{user.roleName}</dd>
            <dt>Last sign-in</dt><dd>{fmtDateTime(user.lastLoginAt)}</dd>
            <dt>Permissions</dt>
            <dd><ul className="perm-list" style={{ margin: 0, paddingLeft: 18 }}>{user.permissions.map((p) => <li key={p} className="mono">{p}</li>)}</ul></dd>
          </dl>
        </section>
        <form className="card" onSubmit={submit} noValidate>
          <header><div><h2>Change password</h2><p>At least 10 characters, with a letter and a number.</p></div></header>
          <ErrorMessage error={error && !error.fields ? error : null} />
          <div className="stack">
            <TextField name="currentPassword" label="Current password" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set} error={fields.currentPassword} required />
            <TextField name="newPassword" label="New password" type="password" autoComplete="new-password" value={form.newPassword} onChange={set} error={fields.newPassword} required />
            <TextField name="confirm" label="Confirm new password" type="password" autoComplete="new-password" value={form.confirm} onChange={set} error={fields.confirm} required />
          </div>
          <div className="form-foot"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button></div>
        </form>
      </div>
    </>
  );
}
