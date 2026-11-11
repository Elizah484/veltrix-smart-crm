import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: 'users', title: 'One record per customer', text: 'Duplicate detection runs before a customer is saved, and a merge tool cleans up the rest.' },
  { icon: 'chat', title: 'Every conversation on a timeline', text: 'Calls, emails, meetings and complaints in one history, so anyone can pick up where you left off.' },
  { icon: 'clock', title: 'Follow-ups that find you', text: 'Assign a follow-up, set a date, and get reminded before it becomes overdue.' },
  { icon: 'cart', title: 'Orders without the arithmetic', text: 'Line items, discounts and totals are worked out for you, with a status trail on every order.' },
  { icon: 'chart', title: 'Dashboards and reports', text: 'Live charts for customers and sales, and CSV export for the reports your manager asks for.' },
  { icon: 'shield', title: 'An audit trail you can trust', text: 'Every sign-in and every change is recorded, and the log cannot be edited.' },
];

const STEPS = [
  { n: '01', title: 'Create your account', text: 'Sign up in under a minute. New accounts start as Employee, and an administrator can promote them.' },
  { n: '02', title: 'Add your customers', text: 'Register customers, record interactions and set follow-up dates as you work.' },
  { n: '03', title: 'Run the business', text: 'Track orders, watch the dashboard and export reports whenever you need them.' },
];

const ROLES = [
  { name: 'Administrator', text: 'Everything: users, settings, audit logs and system health.', pts: ['Manage staff accounts', 'Change company settings', 'Review audit logs'] },
  { name: 'Manager', text: 'The whole customer and sales picture, without the admin controls.', pts: ['See team-wide dashboards', 'Merge duplicates', 'Export reports'] },
  { name: 'Employee', text: 'Day-to-day work on the customers and orders that are theirs.', pts: ['Register customers', 'Log interactions', 'Create orders'] },
];

function Mock() {
  const bars = [38, 52, 44, 66, 58, 78, 70, 92];
  return (
    <div className="mock" aria-hidden="true">
      <div className="mock-bar"><i /><i /><i /><span>veltrix · dashboard</span></div>
      <div className="mock-body">
        <div className="mock-kpis">
          <div><small>Customers</small><b>1,284</b><em>+12%</em></div>
          <div><small>Open orders</small><b>86</b><em>+4%</em></div>
          <div><small>Follow-ups due</small><b>14</b><em className="warn">3 overdue</em></div>
        </div>
        <div className="mock-chart">
          {bars.map((h, i) => <span key={i} style={{ height: h + '%', animationDelay: i * 70 + 'ms' }} />)}
        </div>
        <ul className="mock-list">
          <li><span className="av">AM</span><div><b>Amina Mwangi</b><small>Call · follow-up tomorrow</small></div><span className="mock-pill">Open</span></li>
          <li><span className="av b">JO</span><div><b>Joel Otieno</b><small>Order VX-0042 shipped</small></div><span className="mock-pill ok">Shipped</span></li>
        </ul>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  return (
    <>
      <section className="hero-home">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><Icon name="bolt" /> Smart CRM for growing teams</span>
            <h1>Know every customer. <span className="grad-text">Miss no follow-up.</span></h1>
            <p className="lead">Veltrix keeps customers, conversations, orders and reminders in one calm place, so your team spends its time selling instead of searching.</p>
            <div className="cta-row">
              {user ? (
                <Link className="btn primary lg" to="/dashboard">Go to your dashboard <Icon name="arrow" /></Link>
              ) : (
                <>
                  <Link className="btn primary lg" to="/signup">Get started free <Icon name="arrow" /></Link>
                  <Link className="btn lg" to="/login">Sign in</Link>
                </>
              )}
            </div>
            <ul className="trust">
              <li><Icon name="check" /> No duplicate customers</li>
              <li><Icon name="check" /> Reminders built in</li>
              <li><Icon name="check" /> Full audit trail</li>
            </ul>
          </div>
          <Mock />
        </div>
      </section>

      <section className="stats">
        <div className="wrap stats-grid">
          <div><b>3</b><span>roles with clear permissions</span></div>
          <div><b>15</b><span>connected data tables</span></div>
          <div><b>100%</b><span>of changes audited</span></div>
          <div><b>2</b><span>themes: light and dark</span></div>
        </div>
      </section>

      <section id="features" className="sect">
        <div className="wrap">
          <header className="sect-head"><span className="eyebrow">Features</span><h2>Everything a customer team needs</h2><p className="muted">Built around the real daily jobs: finding a customer, logging a call, chasing a follow-up, closing an order.</p></header>
          <div className="feat-grid">
            {FEATURES.map((f) => (
              <article className="feat" key={f.title}>
                <span className="feat-ico"><Icon name={f.icon} /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="sect alt">
        <div className="wrap">
          <header className="sect-head"><span className="eyebrow">How it works</span><h2>From sign-up to first follow-up in minutes</h2></header>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.n}><span className="step-n">{s.n}</span><h3>{s.title}</h3><p>{s.text}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section id="roles" className="sect">
        <div className="wrap">
          <header className="sect-head"><span className="eyebrow">Roles</span><h2>The right access for the right person</h2><p className="muted">Permissions are checked on the server for every request, not just hidden in the menu.</p></header>
          <div className="role-grid">
            {ROLES.map((r) => (
              <article className="role" key={r.name}>
                <h3>{r.name}</h3>
                <p className="muted">{r.text}</p>
                <ul>{r.pts.map((p) => <li key={p}><Icon name="check" />{p}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {!user && (
        <section className="sect">
          <div className="wrap">
            <div className="cta-band">
              <div><h2>Ready to keep every customer close?</h2><p>Create your account and start with your first customer today.</p></div>
              <div className="cta-row">
                <Link className="btn primary lg" to="/signup">Create account</Link>
                <Link className="btn lg" to="/login">I already have one</Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
