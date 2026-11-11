import { Link } from 'react-router-dom';
import Icon from './Icon';
import Logo from './Logo';

/** Two-column frame shared by Sign in and Sign up: story on the left, form on the right. */
export default function AuthShell({ title, subtitle, side, children, footer }) {
  return (
    <div className="authpage">
      <aside className="auth-side">
        <Link to="/" className="logo" style={{ padding: 0 }}><Logo /><b>VELTRIX</b></Link>
        <div className="auth-story">
          <h2>{side.heading}</h2>
          <ul>
            {side.points.map((p) => <li key={p}><span className="tick"><Icon name="check" /></span>{p}</li>)}
          </ul>
        </div>
        <blockquote className="auth-quote">
          <p>“We stopped losing follow-ups the week we switched.”</p>
          <footer>Sample team lead, demo data</footer>
        </blockquote>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-head"><h1>{title}</h1><p className="muted">{subtitle}</p></div>
          {children}
          {footer && <p className="auth-foot">{footer}</p>}
        </div>
      </section>
    </div>
  );
}
