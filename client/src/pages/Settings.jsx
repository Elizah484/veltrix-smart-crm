import { useEffect, useState } from 'react';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import { SelectField, TextField } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { CURRENCIES } from '../utils/constants';
import { fmtDateTime } from '../utils/format';

export default function Settings() {
  const { settings, loadSettings } = useAuth();
  const { toast } = useUi();
  const [form, setForm] = useState(settings);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const health = useFetch(() => api.get('/system/health'), []);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { setForm(settings); }, [settings]);

  async function save(e) {
    e.preventDefault();
    setError(null); setFields({}); setBusy(true);
    try {
      await api.put('/settings', { companyName: form.companyName, currency: form.currency, reminderDays: Number(form.reminderDays) });
      await loadSettings();
      toast('Settings saved.');
    } catch (err) { setError(err); setFields(err.fields || {}); } finally { setBusy(false); }
  }

  const h = health.data;
  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><p>Business preferences and system health.</p></div></div>
      <div className="grid g2">
        <form className="card" onSubmit={save} noValidate>
          <header><h2>Preferences</h2></header>
          <ErrorMessage error={error && !error.fields ? error : null} />
          <div className="stack">
            <TextField name="companyName" label="Business name" value={form.companyName} onChange={set} error={fields.companyName} required />
            <SelectField name="currency" label="Currency" value={form.currency} onChange={set} options={CURRENCIES} error={fields.currency} required />
            <TextField name="reminderDays" label="Remind me this many days before a follow-up" type="number" min="1" max="14" value={form.reminderDays} onChange={set} error={fields.reminderDays} required />
          </div>
          <div className="form-foot"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>
        </form>

        <section className="card">
          <header><h2>System health</h2><button className="btn sm" onClick={health.reload}>Refresh</button></header>
          <ErrorMessage error={health.error} />
          {health.loading && !h && <LoadingSpinner />}
          {h && (
            <>
              <dl className="dl">
                <dt>Database</dt><dd>Reachable · {h.database.responseMs} ms · MySQL {h.database.version}</dd>
                <dt>Server</dt><dd>Node {h.server.node} · up {Math.round(h.server.uptimeSeconds / 60)} min · {h.server.memoryMb} MB</dd>
                <dt>Customers</dt><dd>{h.counts.customers}</dd>
                <dt>Interactions</dt><dd>{h.counts.interactions}</dd>
                <dt>Orders</dt><dd>{h.counts.orders}</dd>
                <dt>Audit entries</dt><dd>{h.counts.auditEntries}</dd>
                <dt>Active users</dt><dd>{h.counts.activeUsers}</dd>
                <dt>Overdue follow-ups</dt><dd>{h.counts.overdueFollowUps}</dd>
              </dl>
              <h3 style={{ margin: '16px 0 8px' }}>Recent errors</h3>
              {h.recentErrors.length === 0 ? <p className="muted">No errors recorded.</p> : (
                <ul className="list">
                  {h.recentErrors.map((e, i) => (
                    <li key={i}><div>{e.status} {e.method} {e.path}<div className="sub">{e.message}</div></div><span className="muted mono">{fmtDateTime(e.at)}</span></li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section className="card" style={{ gridColumn: '1 / -1' }}>
          <header><h2>Backup and restore</h2></header>
          <p className="muted">Backups are made from the database folder with PowerShell, not from this page, so that a browser can never overwrite your data. See README.md, section “Backup and restore”.</p>
          <pre className="diff">{`# Backup (from the project root)
powershell -ExecutionPolicy Bypass -File database\\backup.ps1

# Restore (replaces current data - it asks you to confirm)
powershell -ExecutionPolicy Bypass -File database\\restore.ps1 -File backups\\veltrix-YYYYMMDD-HHMM.sql`}</pre>
        </section>
      </div>
    </>
  );
}
