import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/client.js';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useNotifications() {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return 'unsupported';
    }
    return Notification.permission as PermissionState;
  });
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Check existing subscription on mount — re-sync with server in case DB was reset
  useEffect(() => {
    if (permission === 'unsupported') return;

    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Re-send to server on every mount (idempotent upsert)
        api.subscribePush(subscription.toJSON()).catch(() => {});
      }
      setIsSubscribed(!!subscription);
    }).catch(() => {
      // SW not ready yet
    });
  }, [permission]);

  const subscribe = useCallback(async () => {
    if (permission === 'unsupported') return;

    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      if (result !== 'granted') return;

      const vapidRes = await api.getVapidPublicKey();
      if (!vapidRes.success || !vapidRes.data) return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidRes.data as string),
      });

      await api.subscribePush(subscription.toJSON());
      setIsSubscribed(true);
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
    }
  }, [permission]);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
        setIsSubscribed(false);
      }
    } catch (err) {
      console.error('Failed to unsubscribe from push notifications:', err);
    }
  }, []);

  const canSubscribe = permission !== 'unsupported' && permission !== 'denied';
  const shouldPrompt = canSubscribe && !isSubscribed && permission === 'default';

  return { permission, isSubscribed, canSubscribe, shouldPrompt, subscribe, unsubscribe };
}
