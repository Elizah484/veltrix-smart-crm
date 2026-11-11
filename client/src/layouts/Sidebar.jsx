import { NavLink } from 'react-router-dom';
import Icon from '../components/Icon';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';

const ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/customers', label: 'Customers', icon: 'users', perm: 'customers.view' },
  { to: '/interactions', label: 'Interactions', icon: 'chat', perm: 'interactions.view' },
  { to: '/follow-ups', label: 'Follow-ups', icon: 'clock', perm: 'interactions.view' },
  { to: '/orders', label: 'Orders', icon: 'cart', perm: 'orders.view' },
  { to: '/notifications', label: 'Notifications', icon: 'bell', badge: true },
  { to: '/reports', label: 'Reports', icon: 'chart', perm: 'reports.view' },
  { to: '/audit-logs', label: 'Audit logs', icon: 'shield', perm: 'audit.view' },
  { to: '/users', label: 'Users', icon: 'user', perm: 'users.manage' },
  { to: '/settings', label: 'Settings', icon: 'settings', perm: 'settings.manage' },
];

export default function Sidebar({ unread, collapsed, onToggle, onNavigate }) {
  const { can, settings } = useAuth();
  return (
    <aside className="sidebar" aria-label="Main">
      <NavLink to="/dashboard" className="logo" onClick={onNavigate}>
        <Logo /><b>{String(settings.companyName || 'VELTRIX').toUpperCase().slice(0, 10)}</b>
      </NavLink>
      <nav className="nav" aria-label="Primary">
        {ITEMS.filter((i) => !i.perm || can(i.perm)).map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate} title={collapsed ? i.label : undefined}>
            <Icon name={i.icon} />
            <span className="l">{i.label}</span>
            {i.badge && unread > 0 && <span className="badge-n" aria-label={unread + ' unread'}>{unread > 99 ? '99+' : unread}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="side-foot">
        <button className="btn ghost sm desk-only" onClick={onToggle} aria-pressed={collapsed}>
          <Icon name="collapse" /><span>{collapsed ? 'Expand' : 'Collapse'}</span>
        </button>
        <div className="demo-tag">Local development build</div>
      </div>
    </aside>
  );
}
