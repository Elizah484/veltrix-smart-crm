import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';

/** Navbar shown on the public pages (Home, Sign in, Sign up). */
function PublicNavbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const nav = useNavigate();

  useEffect(() => { setOpen(false); }, [location.pathname, location.hash]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={'pubnav' + (scrolled ? ' scrolled' : '') + (open ? ' open' : '')}>
      <div className="pubnav-in">
        <Link to="/" className="logo" aria-label="Veltrix home"><Logo /><b>VELTRIX</b></Link>

        <nav className="pubnav-links" aria-label="Site">
          <NavLink to="/" end>Home</NavLink>
          <a href="/#features">Features</a>
          <a href="/#how">How it works</a>
          <a href="/#roles">Roles</a>
          {user && <NavLink to="/dashboard">Dashboard</NavLink>}
        </nav>

        <div className="pubnav-actions">
          <ThemeToggle />
          {user ? (
            <>
              <Link className="btn primary sm" to="/dashboard">Open app <Icon name="arrow" /></Link>
              <button className="btn ghost sm desk-only" onClick={async () => { await logout(); nav('/login'); }}>Sign out</button>
            </>
          ) : (
            <>
              <Link className="btn ghost sm" to="/login">Sign in</Link>
              <Link className="btn primary sm" to="/signup">Sign up</Link>
            </>
          )}
          <button className="icon-btn pubnav-burger" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}>
            <Icon name="menu" />
          </button>
        </div>
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="pubfoot">
      <div className="pubfoot-in">
        <Link to="/" className="logo" style={{ padding: 0 }}><Logo /><b>VELTRIX</b></Link>
        <span className="muted">Smart CRM for teams that never want to miss a follow-up.</span>
        <nav aria-label="Footer">
          <Link to="/login">Sign in</Link>
          <Link to="/signup">Sign up</Link>
          <a href="/#features">Features</a>
        </nav>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  const location = useLocation();

  // Jump to #features etc. after navigating from another public page
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  return (
    <div className="public">
      <a className="skip" href="#content">Skip to content</a>
      <PublicNavbar />
      <main id="content" tabIndex={-1}><Outlet /></main>
      <PublicFooter />
    </div>
  );
}
