import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { api } from '../services/api';

/** Signed-in shell: sidebar, top bar and the page. Also keeps the unread-notification count fresh. */
export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  const refreshUnread = useCallback(() => {
    api.get('/notifications', { limit: 1 }).then((r) => setUnread(r.data.unread)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnread();
    const t = setInterval(refreshUnread, 60000);
    return () => clearInterval(t);
  }, [refreshUnread]);

  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [location.pathname]);

  return (
    <div className={'shell' + (collapsed ? ' collapsed' : '') + (drawer ? ' drawer' : '')}>
      <a className="skip" href="#main">Skip to content</a>
      <Sidebar unread={unread} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} onNavigate={() => setDrawer(false)} />
      <div className="main">
        <Topbar unread={unread} onMenu={() => setDrawer((d) => !d)} />
        <main id="main" className="page" tabIndex={-1}>
          <Outlet context={{ refreshUnread }} />
        </main>
      </div>
    </div>
  );
}
