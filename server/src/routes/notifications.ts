import { Router } from 'express';
import { getVapidPublicKey, saveSubscription, removeSubscription } from '../services/push.js';

const router = Router();

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
router.post('/subscribe', (req, res) => {
  const expertId = req.auth?.expertId;
  if (!expertId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const { subscription } = req.body as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  };

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    res.status(400).json({ success: false, error: 'Invalid subscription object' });
    return;
  }

  saveSubscription(expertId, subscription);
  res.json({ success: true });
});

// POST /api/notifications/unsubscribe
router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body as { endpoint: string };

  if (!endpoint) {
    res.status(400).json({ success: false, error: 'Missing endpoint' });
    return;
  }

  removeSubscription(endpoint);
  res.json({ success: true });
});

export default router;
