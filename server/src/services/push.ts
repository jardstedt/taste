import webPush from 'web-push';
import { getDb, generateId } from '../db/database.js';
import { getEnv } from '../config/env.js';

let initialized = false;

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  data?: {
    url?: string;
    sessionId?: string;
    type?: string;
  };
}

export function initPush(): void {
  const env = getEnv();

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.log('[Push] VAPID keys not configured — push notifications disabled');
    console.log('[Push] Generate keys with: npx web-push generate-vapid-keys');
    return;
  }

  webPush.setVapidDetails(env.VAPID_EMAIL, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  initialized = true;
  console.log('[Push] Web Push initialized with VAPID keys');
}

export function getVapidPublicKey(): string | null {
  const env = getEnv();
  return env.VAPID_PUBLIC_KEY || null;
}

export function saveSubscription(
  expertId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
): void {
  const db = getDb();

  // Upsert: delete existing with same endpoint, then insert
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(subscription.endpoint);
  db.prepare(
    `INSERT INTO push_subscriptions (id, expert_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(generateId(), expertId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
}

export function removeSubscription(endpoint: string, expertId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND expert_id = ?').run(endpoint, expertId);
}

export async function sendPushToExpert(expertId: string, payload: PushPayload): Promise<void> {
  if (!initialized) return;

  const db = getDb();
  const subscriptions = db
    .prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE expert_id = ?')
    .all(expertId) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;

  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  const staleIds: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired or invalid — clean up
          staleIds.push(sub.id);
        } else {
          console.error(`[Push] Failed to send to ${sub.endpoint}:`, err);
        }
      }
    }),
  );

  // Clean up stale subscriptions
  if (staleIds.length > 0) {
    const placeholders = staleIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM push_subscriptions WHERE id IN (${placeholders})`).run(...staleIds);
    console.log(`[Push] Removed ${staleIds.length} stale subscription(s)`);
  }
}
