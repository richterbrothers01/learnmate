'use client';

/**
 * usePushSubscription — Web Push subscription for test reminders (D5).
 *
 * Flow: register the service worker (public/learnmate-sw.js, served from
 * the site root) -> subscribe via PushManager with the VAPID public key ->
 * POST the subscription JSON to /api/push/subscribe (the ONLY endpoint
 * this hook talks to). The integrator must implement that API route: it
 * stores the subscription in the push_subscriptions table (one row per
 * user + endpoint) and nothing else.
 *
 * The VAPID public key comes ONLY from
 * process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY. It is never hardcoded here.
 * If the variable is missing, subscribe() reports that plainly instead
 * of failing silently.
 *
 * unsubscribe() removes the browser subscription locally. It does NOT
 * call any server endpoint (none is specified for removal); stale server
 * rows are pruned by the reminder sender when a push endpoint returns
 * 404/410. See supabase/functions/send-reminders/index.ts.
 *
 * Honest status: this hook, the service worker, and the sender are
 * UNTESTED against real devices. Push delivery is NOT working until
 * VAPID keys, the service worker, and a scheduled sender are configured
 * and tested (see README.md).
 */

import { useCallback, useEffect, useState } from 'react';

export interface UsePushSubscriptionResult {
  subscribed: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  // Built over a fresh ArrayBuffer (not ArrayBufferLike) so the result is
  // assignable to PushManager's BufferSource applicationServerKey type.
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function usePushSubscription(): UsePushSubscriptionResult {
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount, reflect an existing subscription (no server call here).
  useEffect(() => {
    if (!pushSupported()) {
      setError('Push notifications are not supported in this browser.');
      return;
    }
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) setSubscribed(subscription !== null && subscription !== undefined);
      })
      .catch(() => {
        /* Leave subscribed=false; subscribe() will surface real errors. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    setError(null);
    try {
      if (!pushSupported()) {
        throw new Error('Push notifications are not supported in this browser.');
      }
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error(
          'Push notifications are not configured (missing NEXT_PUBLIC_VAPID_PUBLIC_KEY).',
        );
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission was not granted.');
      }
      const registration = await navigator.serviceWorker.register('/learnmate-sw.js');
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        throw new Error('Could not save the push subscription on the server.');
      }
      setSubscribed(true);
    } catch (err) {
      setSubscribed(false);
      setError(err instanceof Error ? err.message : 'Could not enable push notifications.');
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn off push notifications.');
    }
  }, []);

  return { subscribed, error, subscribe, unsubscribe };
}
