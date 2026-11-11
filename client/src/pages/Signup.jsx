import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import ErrorMessage from '../components/ErrorMessage';
import { Checkbox, PasswordField, TextField } from '../components/Form';
import { useAuth } from '../context/AuthContext';

/** Mirrors the server rule (10+ characters, a letter and a number) so people see the problem before submitting. */
function passwordChecks(pw) {
  return [
    { ok: pw.length >= 10, text: 'At least 10 characters' },
    { ok: /[A-Za-z]/.test(pw), text: 'A letter' },
    { ok: /\d/.test(pw), text: 'A number' },
  ];
}

function Strength({ password }) {
  const checks = passwordChecks(password);
  const score = checks.filter((c) => c.ok).length + (password.length >= 14 && /[^A-Za-z0-9]/.test(password) ? 1 : 0);
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div className="strength" aria-live="polite">
      <div className={'meter s' + score} aria-hidden="true"><i /><i /><i /><i /></div>
      <ul>{checks.map((c) => <li key={c.text} className={c.ok ? 'ok' : ''}>{c.ok ? '✓' : '○'} {c.text}</li>)}</ul>
      <span className="sr">Password strength: {password ? labels[score] : 'empty'}</span>
    </div>
  );
}

export default function Signup() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', acceptTerms: false });
  const [local, setLocal] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // the registered email, once the account exists
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // After registering, show the ticked confirmation for a moment, then go to Sign in
  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => nav('/login', { replace: true, state: { registeredEmail: done } }), 2600);
    return () => clearTimeout(t);
  }, [done, nav]);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const problems = {};
    if (form.name.trim().length < 2) problems.name = 'Enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) problems.email = 'Enter a valid email address, such as name@example.com.';
    if (passwordChecks(form.password).some((c) => !c.ok)) problems.password = 'Use at least 10 characters, with a letter and a number.';
    if (form.confirm !== form.password) problems.confirm = 'The passwords do not match.';
    if (!form.acceptTerms) problems.acceptTerms = 'Tick the box to accept the terms and continue.';
    setLocal(problems);
    if (Object.keys(problems).length) return;

    setBusy(true);
    try {
      const res = await register(form.name.trim(), form.email.trim(), form.password, form.acceptTerms);
      setDone(res.user.email);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const fe = { ...((error && error.fields) || {}), ...local };

  if (done) {
    return (
      <AuthShell
        title="You're registered"
        subtitle="Your account is ready. Taking you to sign in…"
        side={{ heading: 'Welcome to Veltrix.', points: ['Your account starts as Employee.', 'An administrator can change your role later.', 'Every sign-in is recorded for your security.'] }}
      >
        <div className="done" role="status">
          <Checkbox checked readOnly>Account created for <b>{done}</b></Checkbox>
          <Checkbox checked readOnly>Terms accepted</Checkbox>
          <Checkbox checked readOnly>Ready to sign in</Checkbox>
          <button className="btn primary lg" onClick={() => nav('/login', { replace: true, state: { registeredEmail: done } })}>Continue to sign in</button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free to start. It takes less than a minute."
      side={{ heading: 'Your customers, finally in one place.', points: [
        'Register customers and see duplicates before they are saved.',
        'Log every interaction and never miss a follow-up.',
        'Create orders and watch the dashboard update.',
      ] }}
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <ErrorMessage error={error && !error.fields ? error : null} title="Could not create the account" />
        <TextField name="name" label="Full name" autoComplete="name" placeholder="Amina Mwangi" value={form.name} onChange={set} error={fe.name} required />
        <TextField name="email" label="Work email" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={set} error={fe.email} required />
        <PasswordField name="password" label="Password" autoComplete="new-password" placeholder="Create a password" value={form.password} onChange={set} error={fe.password} required>
          <Strength password={form.password} />
        </PasswordField>
        <PasswordField name="confirm" label="Confirm password" autoComplete="new-password" placeholder="Repeat the password" value={form.confirm} onChange={set} error={fe.confirm} required />
        <Checkbox name="acceptTerms" checked={form.acceptTerms} onChange={set} error={fe.acceptTerms}>
          I agree to the <a href="#terms" onClick={(e) => e.preventDefault()}>terms of use</a> and understand my activity is recorded in the audit log.
        </Checkbox>
        <button className="btn primary lg" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
