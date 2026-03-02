import { Router } from 'express';
import { z } from 'zod';
import { getVapidPublicKey, saveSubscription, removeSubscription } from '../services/push.js';
import { validate } from '../middleware/validation.js';

const router = Router();

// ── Schemas ──

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().refine(u => u.startsWith('https://'), 'Push endpoint must use HTTPS'),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// GET /api/notifications/vapid-public-key
router.get('/vapid-public-key', (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    res.json({ success: false, error: 'Push notifications not configured' });
    return;
  }
  res.json({ success: true, data: key });
});

// POST /api/notifications/subscribe
router.post('/subscribe', validate(subscribeSchema), (req, res) => {
  const expertId = req.auth?.expertId;
  if (!expertId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const { subscription } = req.body;

  saveSubscription(expertId, subscription);
  res.json({ success: true });
});

// POST /api/notifications/unsubscribe
router.post('/unsubscribe', validate(unsubscribeSchema), (req, res) => {
  const expertId = req.auth?.expertId;
  if (!expertId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const { endpoint } = req.body;

  removeSubscription(endpoint, expertId);
  res.json({ success: true });
});

export default router;
