import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { api } from '../services/api';
import { initials } from '../utils/format';

function GlobalSearch() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(false);
  const term = useDebounce(q.trim(), 300);
  const box = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    if (term.length < 2) { setRes(null); return undefined; }
    const calls = [
      can('customers.view') ? api.get('/customers', { q: term, pageSize: 4 }).then((r) => r.data).catch(() => []) : Promise.resolve([]),
      can('orders.view') ? api.get('/orders', { q: term, pageSize: 4 }).then((r) => r.data).catch(() => []) : Promise.resolve([]),
      can('interactions.view') ? api.get('/interactions', { q: term, pageSize: 4 }).then((r) => r.data).catch(() => []) : Promise.resolve([]),
    ];
    Promise.all(calls).then(([customers, orders, interactions]) => { if (alive) { setRes({ customers, orders, interactions }); setOpen(true); } });
    return () => { alive = false; };
  }, [term, can]);

  useEffect(() => {
    const onDoc = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const go = (to) => { setOpen(false); setQ(''); setRes(null); nav(to); };
  const none = res && !res.customers.length && !res.orders.length && !res.interactions.length;

  return (
    <div className="gsearch" ref={box} role="search">
      <Icon name="search" />
      <input type="search" value={q} placeholder="Search customers, orders, interactions…" aria-label="Search everything"
        onChange={(e) => setQ(e.target.value)} onFocus={() => res && setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }} />
      {open && res && (
        <div className="drop">
          {none && <div className="row muted">No matches for “{term}”.</div>}
          {res.customers.length > 0 && <div className="hd">Customers</div>}
          {res.customers.map((c) => (
            <a key={'c' + c.id} href={'/customers/' + c.id} onClick={(e) => { e.preventDefault(); go('/customers/' + c.id); }}>
              {c.firstName} {c.lastName}<small>{c.code} · {c.email || c.phone || 'no contact'}</small>
            </a>
          ))}
          {res.orders.length > 0 && <div className="hd">Orders</div>}
          {res.orders.map((o) => (
            <a key={'o' + o.id} href={'/orders/' + o.id} onClick={(e) => { e.preventDefault(); go('/orders/' + o.id); }}>
              {o.code}<small>{o.customerName} · {o.status}</small>
            </a>
          ))}
          {res.interactions.length > 0 && <div className="hd">Interactions</div>}
          {res.interactions.map((i) => (
            <a key={'i' + i.id} href={'/interactions/' + i.id} onClick={(e) => { e.preventDefault(); go('/interactions/' + i.id); }}>
              {i.subject}<small>{i.customerName} · {i.type}</small>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Topbar({ unread, onMenu }) {
  const { user, logout, settings, can } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <header className="topbar">
      <button className="icon-btn mobile-only" onClick={onMenu} aria-label="Open menu"><Icon name="menu" /></button>
      <div className="crumbs"><b>{settings.companyName}</b></div>
      <nav className="quicknav desk-only" aria-label="Quick links">
        <NavLink to="/" end><Icon name="home" /> Home</NavLink>
        <NavLink to="/dashboard">Dashboard</NavLink>
        {can('customers.view') && <NavLink to="/customers">Customers</NavLink>}
        {can('orders.view') && <NavLink to="/orders">Orders</NavLink>}
      </nav>
      <GlobalSearch />
      <ThemeToggle />
      <Link to="/notifications" className="icon-btn" aria-label={'Notifications' + (unread ? ', ' + unread + ' unread' : '')}>
        <Icon name="bell" />{unread > 0 && <span className="dot-n">{unread > 99 ? '99+' : unread}</span>}
      </Link>
      <div className="menu" ref={ref}>
        <button className="userbtn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
          <span className="desk-only" style={{ textAlign: 'left', lineHeight: 1.2 }}>
            <span style={{ display: 'block', fontWeight: 500 }}>{user.name}</span>
            <small className="muted">{user.roleName}</small>
          </span>
        </button>
        {open && (
          <div className="drop" role="menu">
            <div className="row"><b>{user.name}</b><small>{user.email}</small></div>
            <a href="/" role="menuitem" onClick={(e) => { e.preventDefault(); setOpen(false); nav('/'); }}>Home page</a>
            <a href="/profile" role="menuitem" onClick={(e) => { e.preventDefault(); setOpen(false); nav('/profile'); }}>My profile</a>
            <a href="/login" role="menuitem" onClick={async (e) => { e.preventDefault(); setOpen(false); await logout(); nav('/login'); }}>Sign out</a>
          </div>
        )}
      </div>
    </header>
  );
}
