import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import ErrorMessage from '../components/ErrorMessage';
import { Checkbox, PasswordField, TextField } from '../components/Form';
import { useAuth } from '../context/AuthContext';

const DEMO = [
  { email: 'admin@veltrix.test', label: 'Administrator', note: 'everything' },
  { email: 'manager@veltrix.test', label: 'Manager', note: 'customers, orders, reports' },
  { email: 'employee@veltrix.test', label: 'Employee', note: 'own customers only' },
];

export default function Login() {
  const { login, expired } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const registeredEmail = location.state && location.state.registeredEmail;
  const [form, setForm] = useState({ email: registeredEmail || '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(form.email.trim(), form.password);
      nav((location.state && location.state.from) || '/dashboard', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const fe = (error && error.fields) || {};

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      side={{ heading: 'Know every customer. Miss no follow-up.', points: [
        'One record per customer, with duplicate detection before it is saved.',
        'Every call, email and complaint on a timeline, with follow-up reminders.',
        'Orders with totals worked out for you, and an audit trail of every change.',
      ] }}
      footer={<>New to Veltrix? <Link to="/signup">Create an account</Link></>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        {registeredEmail && (
          <div className="banner info reg-ok" role="status">
            <Checkbox checked readOnly>
              <b>Registration complete.</b> <span className="muted">Terms accepted. Sign in with your new password.</span>
            </Checkbox>
          </div>
        )}
        {expired && !error && <div className="banner info" role="status"><div>Your session ended. Please sign in again.</div></div>}
        <ErrorMessage error={error} title="Could not sign in" />
        <TextField name="email" label="Email" type="email" autoComplete="username" placeholder="you@company.com" value={form.email} onChange={set} error={fe.email} required />
        <PasswordField name="password" label="Password" autoComplete="current-password" placeholder="Your password" value={form.password} onChange={set} error={fe.password} required />
        <button className="btn primary lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>

        <div className="demo-accts">
          <span className="hint">Development demo accounts (synthetic data). Click to fill the email; the password is the DEMO_PASSWORD from server/.env.</span>
          {DEMO.map((d) => (
            <button type="button" key={d.email} onClick={() => setForm({ email: d.email, password: '' })}>
              <span><b>{d.label}</b><br /><small className="muted">{d.note}</small></span>
              <span className="mono">{d.email}</span>
            </button>
          ))}
        </div>
      </form>
    </AuthShell>
  );
}
