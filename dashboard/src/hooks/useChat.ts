import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './useSocket.js';
import * as api from '../api/client.js';
import type { Session, ChatMessage, Addon } from '../types/index.js';

export function useChat(sessionId: string | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const { on, emit } = useSocket();
  const joinedRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const res = await api.getSession(sessionId);
    if (res.success && res.data) {
      const data = res.data as { session: Session; messages: ChatMessage[]; addons: Addon[] };
      setSession(data.session);
      setMessages(data.messages);
      setAddons(data.addons);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Join/leave socket room
  useEffect(() => {
    if (!sessionId) return;
    if (joinedRef.current !== sessionId) {
      if (joinedRef.current) emit('session:leave', joinedRef.current);
      emit('session:join', sessionId);
      joinedRef.current = sessionId;
    }
    return () => {
      if (joinedRef.current) {
        emit('session:leave', joinedRef.current);
        joinedRef.current = null;
      }
    };
  }, [sessionId, emit]);

  // Real-time events
  useEffect(() => {
    const unsub1 = on('message:new', (msg: ChatMessage) => {
      if (msg.sessionId === sessionId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });
    const unsub2 = on('session:updated', (s: Session) => {
      if (s.id === sessionId) setSession(s);
    });
    const unsub3 = on('addon:new', (addon: Addon) => {
      if (addon.sessionId === sessionId) {
        setAddons(prev => [...prev, addon]);
      }
    });
    const unsub4 = on('addon:updated', (addon: Addon) => {
      if (addon.sessionId === sessionId) {
        setAddons(prev => prev.map(a => a.id === addon.id ? addon : a));
      }
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [sessionId, on]);

  const sendMessage = useCallback(async (content: string) => {
    if (!sessionId) return;
    await api.sendSessionMessage(sessionId, content);
  }, [sessionId]);

  const acceptAddon = useCallback(async (addonId: string, accepted: boolean) => {
    if (!sessionId) return;
    emit('addon:respond', { addonId, accepted });
  }, [sessionId, emit]);

  return { session, messages, addons, loading, sendMessage, acceptAddon, refresh };
}
