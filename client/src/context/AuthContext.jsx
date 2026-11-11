import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setCsrfToken } from '../services/api';
import { setCurrency } from '../utils/format';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ companyName: 'Veltrix', currency: 'KES', reminderDays: 2 });
  const [booting, setBooting] = useState(true);
  const [expired, setExpired] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
      setCurrency(res.data.currency);
    } catch (e) { /* defaults are fine */ }
  }, []);

  const applySession = useCallback((data) => {
    setCsrfToken(data.csrfToken);
    setUser(data.user);
    setExpired(false);
  }, []);

  // On first load, ask the server who is signed in (the cookie decides)
  useEffect(() => {
    let alive = true;
    api.get('/auth/me')
      .then((res) => { if (alive) { applySession(res.data); loadSettings(); } })
      .catch(() => { /* not signed in */ })
      .finally(() => { if (alive) setBooting(false); });
    return () => { alive = false; };
  }, [applySession, loadSettings]);

  // Any request that comes back 401 means the session ended
  useEffect(() => {
    const onExpired = () => { setUser(null); setCsrfToken(null); setExpired(true); };
    window.addEventListener('veltrix:session-expired', onExpired);
    return () => window.removeEventListener('veltrix:session-expired', onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    applySession(res.data);
    await loadSettings();
    return res.data.user;
  }, [applySession, loadSettings]);

  /** Creates an Employee account. Does not sign in; the person signs in next. */
  const register = useCallback(async (name, email, password, acceptTerms) => {
    const res = await api.post('/auth/register', { name, email, password, acceptTerms });
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch (e) { /* cookie is cleared or already invalid */ }
    setUser(null);
    setCsrfToken(null);
    setExpired(false);
  }, []);

  const value = useMemo(() => {
    const perms = new Set(user ? user.permissions : []);
    return {
      user, settings, booting, expired,
      login, register, logout, loadSettings,
      can: (code) => perms.has(code),
      canAny: (codes) => codes.some((c) => perms.has(c)),
    };
  }, [user, settings, booting, expired, login, register, logout, loadSettings]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
