import { Server as SocketServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import type { AuthPayload } from '../types/index.js';
import {
  acceptSession,
  addMessage,
  respondToAddon,
  getSessionById,
  incrementTurnCount,
} from './sessions.js';

let _io: SocketServer | null = null;

// ── Per-socket rate limiter ──

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 events per window

interface RateBucket {
  count: number;
  resetAt: number;
}

const socketRates = new WeakMap<Socket, RateBucket>();

function isRateLimited(socket: Socket): boolean {
  const now = Date.now();
  let bucket = socketRates.get(socket);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    socketRates.set(socket, bucket);
  }
  bucket.count++;
  return bucket.count > RATE_LIMIT_MAX;
}

function parseCookies(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieStr) return cookies;
  for (const pair of cookieStr.split(';')) {
    const [key, ...vals] = pair.trim().split('=');
    if (key) cookies[key] = decodeURIComponent(vals.join('='));
  }
  return cookies;
}

export function getIO(): SocketServer | null {
  return _io;
}

export function initSocketServer(httpServer: HttpServer): SocketServer {
  const origins = getEnv().CORS_ORIGIN.split(',').map(o => o.trim());
  _io = new SocketServer(httpServer, {
    cors: {
      origin: origins,
      credentials: true,
    },
  });

  // Auth middleware — extract JWT from cookie or handshake auth
  _io.use((socket, next) => {
    try {
      let token: string | undefined;

      const cookies = parseCookies(socket.handshake.headers.cookie || '');
      token = cookies.token;

      if (!token) {
        token = socket.handshake.auth?.token as string | undefined;
      }

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const env = getEnv();
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      (socket as any).auth = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  _io.on('connection', handleConnection);

  console.log('[Socket.io] Initialized');
  return _io;
}

function handleConnection(socket: Socket) {
  const auth = (socket as any).auth as AuthPayload;

  // Join personal room
  socket.join(`expert:${auth.expertId}`);
  console.log(`[Socket.io] Expert ${auth.expertId} connected`);

  // Join a session room
  socket.on('session:join', (sessionId: string) => {
    if (typeof sessionId !== 'string' || !sessionId) return;
    const session = getSessionById(sessionId);
    if (session && (session.expertId === auth.expertId || auth.role === 'admin')) {
      socket.join(`session:${sessionId}`);
      socket.emit('session:joined', { sessionId });
    } else {
      console.warn(`[Socket.io] Unauthorized session:join attempt by ${auth.expertId} for ${sessionId}`);
    }
  });

  // Leave a session room
  socket.on('session:leave', (sessionId: string) => {
    socket.leave(`session:${sessionId}`);
  });

  // Accept a session
  socket.on('session:accept', (sessionId: string) => {
    if (isRateLimited(socket)) return;
    if (typeof sessionId !== 'string' || !sessionId) return;
    const session = acceptSession(sessionId, auth.expertId);
    if (session) {
      socket.join(`session:${sessionId}`);
      emitToSession(sessionId, 'session:updated', session);
      notifyExpert(auth.expertId, 'session:accepted', session);
    }
  });

  // Send a message
  socket.on('message:send', (data: { sessionId: string; content: string }) => {
    if (isRateLimited(socket)) return;
    // Validate input
    if (!data || typeof data.sessionId !== 'string' || typeof data.content !== 'string') return;
    if (data.content.length === 0 || data.content.length > 5000) return;

    const session = getSessionById(data.sessionId);
    if (!session || session.expertId !== auth.expertId) return;
    if (session.status !== 'active' && session.status !== 'accepted' && session.status !== 'wrapping_up') return;

    // Block messages if grace period is exhausted
    if (session.turnCount >= session.maxTurns + 5) return;

    const message = addMessage(data.sessionId, 'expert', auth.expertId, data.content);
    const turnInfo = incrementTurnCount(data.sessionId, 'expert');
    emitToSession(data.sessionId, 'message:new', message);

    // Relay expert message to buyer agent via ACP memo (non-blocking)
    if (session.acpJobId) {
      import('./acp.js').then(({ relayExpertMessageToAcp }) => {
        relayExpertMessageToAcp(data.sessionId, data.content).catch(() => {});
      }).catch(() => {});
    }

    // Always emit updated session so dashboard gets fresh turn count + status
    const updated = getSessionById(data.sessionId);
    emitToSession(data.sessionId, 'session:updated', updated);

    if (turnInfo.limitReached) {
      emitToSession(data.sessionId, 'session:turn_limit', turnInfo);
    }
  });

  // Respond to addon
  socket.on('addon:respond', (data: { addonId: string; accepted: boolean }) => {
    if (isRateLimited(socket)) return;
    if (!data || typeof data.addonId !== 'string' || typeof data.accepted !== 'boolean') return;
    const addon = respondToAddon(data.addonId, data.accepted, auth.expertId);
    if (addon) {
      emitToSession(addon.sessionId, 'addon:updated', addon);
      const session = getSessionById(addon.sessionId);
      if (session) {
        emitToSession(addon.sessionId, 'session:updated', session);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Expert ${auth.expertId} disconnected`);
  });
}

// ── Utility Exports ──

export function emitToSession(sessionId: string, event: string, data: unknown): void {
  if (_io) {
    _io.to(`session:${sessionId}`).emit(event, data);
  }
}

export function notifyExpert(expertId: string, event: string, data: unknown): void {
  if (_io) {
    _io.to(`expert:${expertId}`).emit(event, data);
  }
}
