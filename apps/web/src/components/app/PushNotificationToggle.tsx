'use client';

import { useEffect, useState } from 'react';

/**
 * Turning browser notifications on, from this device.
 *
 * Notifications are per-device, not per-account: allowing them on a phone says
 * nothing about a shared family computer. So the control reports what *this*
 * browser is currently doing rather than a setting stored on the server.
 *
 * The permission prompt is only ever raised by a deliberate click. A page that
 * asks on load trains people to refuse.
 */

/** VAPID public keys travel as base64url; the browser wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const normalised = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

type State = 'checking' | 'unsupported' | 'blocked' | 'off' | 'on';

export function PushNotificationToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        if (!cancelled) setState('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setState('blocked');
        return;
      }

      const registration = await navigator.serviceWorker.ready.catch(() => null);
      const existing = await registration?.pushManager.getSubscription().catch(() => null);
      if (!cancelled) setState(existing ? 'on' : 'off');
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!vapidPublicKey) return;
    setBusy(true);
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off');
        setBusy(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // Web Push requires this: every message must be visible to the person.
        // The platform intends that anyway — a silent background push would be
        // a poor fit for a service people trust with private matters.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      const raw = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };

      const response = await fetch('/api/notifications/push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: raw.endpoint,
          platform: 'web',
          p256dh: raw.keys?.p256dh,
          auth: raw.keys?.auth,
          deviceName: navigator.userAgent.slice(0, 80),
        }),
      });

      if (!response.ok) {
        // Leaving a browser subscription the server does not know about would
        // look enabled while delivering nothing.
        await subscription.unsubscribe().catch(() => undefined);
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? 'Notifications could not be turned on.');
        setState('off');
        setBusy(false);
        return;
      }

      setState('on');
    } catch {
      setError('Notifications could not be turned on in this browser.');
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/notifications/push-token', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: subscription.endpoint }),
        }).catch(() => undefined);
        await subscription.unsubscribe().catch(() => undefined);
      }
      setState('off');
    } catch {
      setError('Notifications could not be turned off.');
    }
    setBusy(false);
  }

  const body = (() => {
    if (!vapidPublicKey) {
      return 'Browser notifications have not been set up for this platform yet.';
    }
    switch (state) {
      case 'checking':
        return 'Checking this device…';
      case 'unsupported':
        return 'This browser cannot show notifications. Try installing iPastor to your home screen, or use another browser.';
      case 'blocked':
        return 'Notifications are blocked for this site in your browser settings. You would need to allow them there first.';
      case 'on':
        return 'This device will be told when something needs you. Notifications never contain what was said — only that there is something to read.';
      default:
        return 'Be told when a counsellor replies, a session is starting, or someone asks to connect. The notification never says what it is about.';
    }
  })();

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-base font-semibold">Notifications on this device</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
            {body}
          </p>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </div>

        {vapidPublicKey && (state === 'on' || state === 'off') ? (
          <button
            type="button"
            onClick={() => void (state === 'on' ? disable() : enable())}
            disabled={busy}
            className={
              state === 'on'
                ? 'min-h-[2.75rem] shrink-0 rounded-lg border border-ink-300 px-5 text-sm disabled:opacity-50 dark:border-ink-700'
                : 'min-h-[2.75rem] shrink-0 rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50'
            }
          >
            {busy ? 'Working…' : state === 'on' ? 'Turn off' : 'Turn on'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
