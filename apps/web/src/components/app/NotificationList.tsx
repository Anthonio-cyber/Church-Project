'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export type NotificationEntry = {
  id: string;
  category: string;
  title: string;
  body: string;
  link: string | null;
  isCritical: boolean;
  readAt: string | null;
  createdAt: string;
};

export type Preferences = {
  emailEnabled: boolean;
  pushEnabled: boolean;
  counsellingEnabled: boolean;
  connectionEnabled: boolean;
  prayerEnabled: boolean;
  learningEnabled: boolean;
  eventEnabled: boolean;
  announcementEnabled: boolean;
};

const TOGGLES: [keyof Preferences, string, string][] = [
  ['emailEnabled', 'Email', 'Receive notifications by email.'],
  ['pushEnabled', 'Push', 'Receive notifications on your mobile devices.'],
  ['counsellingEnabled', 'Counselling', 'Session confirmations, reminders and updates.'],
  ['connectionEnabled', 'Connections', 'Connection requests and acceptances.'],
  ['prayerEnabled', 'Prayer', 'When someone prays for your request.'],
  ['learningEnabled', 'Discipleship', 'Course updates and new material.'],
  ['eventEnabled', 'Events', 'Event reminders and changes.'],
  ['announcementEnabled', 'Announcements', 'General ministry announcements.'],
];

export function NotificationList({
  notifications,
  preferences,
}: {
  notifications: NotificationEntry[];
  preferences: Preferences;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(preferences);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function markAll() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(() => null);
    router.refresh();
  }

  async function savePrefs(next: Preferences) {
    setPrefs(next);
    setSaving(true);
    setSaved(false);
    const response = await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => null);
    setSaving(false);
    if (response?.ok) setSaved(true);
  }

  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">
            Recent {unread > 0 ? <span className="text-gold-600">({unread} unread)</span> : null}
          </h2>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAll}
              className="text-sm font-medium text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
            >
              Mark all as read
            </button>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-300 p-8 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
            You have no notifications.
          </p>
        ) : (
          <ul className="space-y-3">
            {notifications.map((notification) => {
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-ink-500 dark:text-parchment-400">
                        {notification.category.toLowerCase().replace('_', ' ')}
                        {notification.isCritical ? ' · important' : ''}
                      </p>
                      <p className="mt-1 font-medium">{notification.title}</p>
                      <p className="mt-1 text-sm text-ink-600 dark:text-parchment-300">
                        {notification.body}
                      </p>
                    </div>
                    {!notification.readAt ? (
                      <span
                        aria-label="Unread"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-500"
                      />
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-ink-500 dark:text-parchment-400">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </>
              );

              const className = `block rounded-xl border p-4 transition ${
                notification.isCritical
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                  : 'border-ink-200 bg-white hover:border-gold-400 dark:border-ink-800 dark:bg-ink-900'
              }`;

              return (
                <li key={notification.id}>
                  {notification.link ? (
                    <Link href={notification.link} className={className}>
                      {inner}
                    </Link>
                  ) : (
                    <div className={className}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside>
        <h2 className="mb-5 font-serif text-xl font-semibold">Preferences</h2>
        <div className="space-y-4 rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
          {TOGGLES.map(([key, label, description]) => (
            <label key={key} className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(event) => savePrefs({ ...prefs, [key]: event.target.checked })}
                className="mt-1 h-4 w-4 shrink-0 accent-gold-600"
              />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-ink-500 dark:text-parchment-400">
                  {description}
                </span>
              </span>
            </label>
          ))}

          <p
            role="status"
            className="border-t border-ink-200 pt-4 text-xs text-ink-500 dark:border-ink-800 dark:text-parchment-400"
          >
            {saving ? 'Saving…' : saved ? 'Saved.' : 'Changes save automatically.'}
          </p>

          <p className="text-xs leading-relaxed text-ink-500 dark:text-parchment-400">
            Security and safeguarding notices are always delivered, whatever your settings. Turning
            them off would leave you unable to react to a problem with your own account.
          </p>
        </div>
      </aside>
    </div>
  );
}
