import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket.js';
import * as api from '../api/client.js';
import type { Session } from '../types/index.js';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const { on } = useSocket();

  const refresh = useCallback(async () => {
    const res = await api.getSessions();
    if (res.success && res.data) {
      setSessions(res.data as Session[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const unsub1 = on('session:new', (session: Session) => {
      setSessions(prev => [session, ...prev]);
    });
    const unsub2 = on('session:updated', (session: Session) => {
      setSessions(prev => prev.map(s => s.id === session.id ? session : s));
    });
    const unsub3 = on('session:completed', (session: Session) => {
      setSessions(prev => prev.map(s => s.id === session.id ? session : s));
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [on]);

  const pending = sessions.filter(s => s.status === 'pending' || s.status === 'matching');
  const active = sessions.filter(s => s.status === 'active' || s.status === 'accepted' || s.status === 'wrapping_up');
  const completed = sessions.filter(s => s.status === 'completed' || s.status === 'cancelled' || s.status === 'timeout');

  return { sessions, pending, active, completed, loading, refresh };
}
