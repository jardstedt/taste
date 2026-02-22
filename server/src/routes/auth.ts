import { Router } from 'express';
import { getExpertByEmail, getExpertById, verifyPassword } from '../services/experts.js';
import { signToken, verifyToken } from '../middleware/auth.js';
import { validate, loginSchema } from '../middleware/validation.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { decryptEmail } from '../db/database.js';

const router = Router();

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  const expert = getExpertByEmail(email);
  if (!expert) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  if (!verifyPassword(expert, password)) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const token = signToken({ expertId: expert.id, role: expert.role });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
  });

  res.json({
    success: true,
    data: {
      expertId: expert.id,
      name: expert.name,
      role: expert.role,
      domains: expert.domains,
    },
  });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  const expert = getExpertById(req.auth!.expertId);
  if (!expert) {
    res.status(404).json({ success: false, error: 'Expert not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      expertId: expert.id,
      name: expert.name,
      email: decryptEmail(expert.emailEncrypted),
      role: expert.role,
      domains: expert.domains,
      credentials: expert.credentials,
      availability: expert.availability,
      consentToPublicProfile: expert.consentToPublicProfile,
      agreementAcceptedAt: expert.agreementAcceptedAt,
      completedJobs: expert.completedJobs,
      earningsUsdc: expert.earningsUsdc,
      walletAddress: expert.walletAddress,
      walletChain: expert.walletChain,
    },
  });
});

export default router;
