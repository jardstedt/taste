import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import { getExpertById } from '../services/experts.js';
import type { AuthPayload, ExpertRole } from '../types/index.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined;

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  try {
    const env = getEnv();
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as AuthPayload & { iat?: number };

    // Check if user has been deactivated since token was issued
    const expert = getExpertById(payload.expertId);
    if (!expert || expert.deactivatedAt) {
      res.status(401).json({ success: false, error: 'Account deactivated' });
      return;
    }

    // Check if password was changed after token was issued
    if (expert.passwordChangedAt && payload.iat) {
      const changedAtSec = new Date(expert.passwordChangedAt).getTime() / 1000;
      if (payload.iat < changedAtSec) {
        res.status(401).json({ success: false, error: 'Token invalidated by password change' });
        return;
      }
    }

    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: ExpertRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export function signToken(payload: AuthPayload): string {
  const env = getEnv();
  return jwt.sign(payload, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '2h' });
}
