import helmet from 'helmet';
import cors from 'cors';
import type { RequestHandler } from 'express';
import { getEnv } from '../config/env.js';

export function createHelmet(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  });
}

export function createCors(): RequestHandler {
  const env = getEnv();

  // In production, strictly validate origin against allowlist
  const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim());
  const isProduction = env.NODE_ENV === 'production';

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., server-to-server, curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (isProduction) {
        return callback(new Error('CORS: origin not allowed'));
      }

      // In development, allow localhost origins
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }

      return callback(new Error('CORS: origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}
