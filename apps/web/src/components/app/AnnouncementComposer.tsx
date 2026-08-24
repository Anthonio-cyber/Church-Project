'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  audienceRole: string | null;
  audienceCountry: string | null;
  ministryCenter: string | null;
  channels: string[];
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
  createdAt: string;
};

const ROLES = [
  'USER',
  'COUNSELLOR',
  'PASTOR',
  'MINISTRY_LEADER',
  'MODERATOR',
  'COUNSELLING_ADMIN',
  'CONTENT_ADMIN',
  'EVENT_ADMIN',
  'SAFEGUARDING_ADMIN',
  'ADMIN',
  'SENIOR_LEADERSHIP_ADMIN',
];

/** Compose and target a ministry announcement, optionally scheduled. */
export function AnnouncementComposer({
  announcements,
  centers,
  countries,
}: {
  announcements: AnnouncementRow[];
  centers: { id: string; name: string }[];
  countries: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    body: '',
    audienceRole: '',
    audienceCountry: '',
    ministryCenterId: '',
    scheduledFor: '',
  });
  const [channels, setChannels] = useState<string[]>(['IN_APP']);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleChannel(channel: string) {
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((entry) => entry !== channel)
        : [...current, channel],
    );
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        body: form.body,
        audienceRole: form.audienceRole || undefined,
        audienceCountry: form.audienceCountry || undefined,
        ministryCenterId: form.ministryCenterId || undefined,
        channels,
        scheduledFor: form.scheduledFor
          ? new Date(form.scheduledFor).toISOString()
          : undefined,
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({ tone: 'error', text: payload?.error?.message ?? 'That could not be sent.' });
      setBusy(false);
      return;
    }

    setStatus({ tone: 'ok', text: payload.data.message });
    setForm({ ...form, title: '', body: '', scheduledFor: '' });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <form
        onSubmit={send}
        className="space-y-5 rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900"
      >
        {status ? (
          <p
            role="status"
            className={`rounded-lg px-4 py-3 text-sm ${
              status.tone === 'ok'
                ? 'border border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'border border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
            }`}
          >
            {status.text}
          </p>
        ) : null}

        <div>
          <label htmlFor="announcementTitle" className="label">Title</label>
          <input
            id="announcementTitle"
            required
            maxLength={160}
            value={form.title}
            onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="announcementBody" className="label">Message</label>
          <textarea
            id="announcementBody"
            required
            rows={6}
            maxLength={4000}
            value={form.body}
            onChange={(event) => setForm((f) => ({ ...f, body: event.target.value }))}
            className="input resize-y"
          />
          <p className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
            {form.body.length}/4000. Never put counselling detail or personal information in an
            announcement.
          </p>
        </div>

        <fieldset>
          <legend className="label">Who should receive this?</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="audienceRole" className="label text-xs">Role</label>
              <select
                id="audienceRole"
                value={form.audienceRole}
                onChange={(event) => setForm((f) => ({ ...f, audienceRole: event.target.value }))}
                className="input"
              >
                <option value="">Everyone</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.toLowerCase().replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="audienceCountry" className="label text-xs">Country</label>
              <select
                id="audienceCountry"
                value={form.audienceCountry}
                onChange={(event) =>
                  setForm((f) => ({ ...f, audienceCountry: event.target.value }))
                }
                className="input"
              >
                <option value="">All countries</option>
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="announcementCenter" className="label text-xs">Ministry centre</label>
              <select
                id="announcementCenter"
                value={form.ministryCenterId}
                onChange={(event) =>
                  setForm((f) => ({ ...f, ministryCenterId: event.target.value }))
                }
                className="input"
              >
                <option value="">All centres</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Channels</legend>
          <div className="flex flex-wrap gap-4">
            {[
              ['IN_APP', 'In the app'],
              ['EMAIL', 'Email'],
              ['PUSH', 'Push notification'],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={channels.includes(value)}
                  onChange={() => toggleChannel(value)}
                  className="h-4 w-4 accent-gold-600"
                />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-500 dark:text-parchment-400">
            Members who have turned announcements off will not receive this, whatever channels you
            select. That is deliberate.
          </p>
        </fieldset>

        <div>
          <label htmlFor="scheduledFor" className="label">
            Schedule <span className="font-normal text-ink-500">(optional)</span>
          </label>
          <input
            id="scheduledFor"
            type="datetime-local"
            value={form.scheduledFor}
            onChange={(event) => setForm((f) => ({ ...f, scheduledFor: event.target.value }))}
            className="input"
          />
        </div>

        <button
          type="submit"
          disabled={busy || channels.length === 0 || form.body.trim().length < 10}
          className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-6 text-sm font-semibold text-ink-950 disabled:opacity-50"
        >
          {busy ? 'Sending…' : form.scheduledFor ? 'Schedule announcement' : 'Send now'}
        </button>
      </form>

      <aside>
        <h2 className="mb-4 font-serif text-lg font-semibold">Recent announcements</h2>
        {announcements.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-300 p-5 text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
            Nothing sent yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {announcements.map((announcement) => (
              <li
                key={announcement.id}
                className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900"
              >
                <p className="font-medium">{announcement.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-ink-600 dark:text-parchment-300">
                  {announcement.body}
                </p>
                <p className="mt-2 text-xs text-ink-500 dark:text-parchment-400">
                  {announcement.sentAt
                    ? `Sent ${new Date(announcement.sentAt).toLocaleString()}`
                    : announcement.scheduledFor
                      ? `Scheduled for ${new Date(announcement.scheduledFor).toLocaleString()}`
                      : 'Draft'}
                  {' · '}
                  {[
                    announcement.audienceRole?.toLowerCase().replace(/_/g, ' '),
                    announcement.audienceCountry,
                    announcement.ministryCenter,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'everyone'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
