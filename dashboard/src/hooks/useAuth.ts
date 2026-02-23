import { useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '../types/index.js';
import * as api from '../api/client.js';

// Dev auto-login: only in Vite dev mode, disabled in production builds
const DEV_AUTO_LOGIN = import.meta.env.DEV;

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await api.getMe();
      if (res.success && res.data) {
        setUser(res.data as AuthUser);
        return true;
      }
      setUser(null);
      return false;
    } catch {
      setUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const authed = await checkAuth();
      if (!authed && DEV_AUTO_LOGIN) {
        // Auto-login with dev credentials from env vars (not bundled in production)
        const devEmail = import.meta.env.VITE_DEV_EMAIL;
        const devPassword = import.meta.env.VITE_DEV_PASSWORD;
        if (devEmail && devPassword) {
          const res = await api.login(devEmail, devPassword);
          if (res.success) {
            await checkAuth();
          }
        }
      }
    })();
  }, [checkAuth]);

  const loginFn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const res = await api.login(email, password);
    if (res.success) {
      await checkAuth();
      return null;
    }
    return res.error ?? 'Login failed';
  }, [checkAuth]);

  const logoutFn = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return { user, loading, login: loginFn, logout: logoutFn, refresh: checkAuth };
}
