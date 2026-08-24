'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  startsAt: string;
  mode: string;
  location: string | null;
  speaker: string | null;
  capacity: number | null;
  status: string;
  visibility: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  registrationCount: number;
  ministryCenter: string | null;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Event administration: create, publish, cancel, duplicate and remind. */
export function EventManager({
  events,
  centers,
  canCreate,
  canPublish,
  canCancel,
  canRemind,
}: {
  events: EventRow[];
  centers: { id: string; name: string }[];
  canCreate: boolean;
  canPublish: boolean;
  canCancel: boolean;
  canRemind: boolean;
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    category: 'Gathering',
    startsAt: '',
    mode: 'PHYSICAL',
    location: '',
    onlineUrl: '',
    speaker: '',
    capacity: '',
    visibility: 'PUBLIC',
    ministryCenterId: '',
  });
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        slug: form.slug || slugify(form.title),
        startsAt: new Date(form.startsAt).toISOString(),
        location: form.location || undefined,
        onlineUrl: form.onlineUrl || undefined,
        speaker: form.speaker || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        ministryCenterId: form.ministryCenterId || undefined,
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({ tone: 'error', text: payload?.error?.message ?? 'The event could not be created.' });
      setBusy(false);
      return;
    }

    setStatus({ tone: 'ok', text: payload.data.message });
    setComposing(false);
    setBusy(false);
    router.refresh();
  }

  async function act(eventId: string, action: string, reason?: string) {
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/admin/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, action, reason }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    setStatus(
      response?.ok
        ? { tone: 'ok', text: payload.data.message }
        : { tone: 'error', text: payload?.error?.message ?? 'That action failed.' },
    );
    setCancelId(null);
    setCancelReason('');
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
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

      {canCreate ? (
        <button
          type="button"
          onClick={() => setComposing((open) => !open)}
          className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950"
        >
          {composing ? 'Cancel' : 'New event'}
        </button>
      ) : null}

      {composing ? (
        <form
          onSubmit={create}
          className="space-y-5 rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="eventTitle" className="label">Title</label>
              <input
                id="eventTitle"
                required
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value, slug: f.slug || slugify(e.target.value) }))
                }
                className="input"
              />
            </div>
            <div>
              <label htmlFor="eventSlug" className="label">Web address</label>
              <input
                id="eventSlug"
                required
                pattern="[a-z0-9-]+"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className="input font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="eventDescription" className="label">Description</label>
            <textarea
              id="eventDescription"
              required
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="input resize-y"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="eventStarts" className="label">Date and time</label>
              <input
                id="eventStarts"
                type="datetime-local"
                required
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="eventCategory" className="label">Category</label>
              <input
                id="eventCategory"
                required
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="eventMode" className="label">Mode</label>
              <select
                id="eventMode"
                value={form.mode}
                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
                className="input"
              >
                <option value="PHYSICAL">In person</option>
                <option value="ONLINE">Online</option>
                <option value="HYBRID">Both</option>
              </select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="eventLocation" className="label">Location</label>
              <input
                id="eventLocation"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="eventOnlineUrl" className="label">
                Joining link <span className="font-normal text-ink-500">(released to registrants only)</span>
              </label>
              <input
                id="eventOnlineUrl"
                type="url"
                value={form.onlineUrl}
                onChange={(e) => setForm((f) => ({ ...f, onlineUrl: e.target.value }))}
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-4">
            <div>
              <label htmlFor="eventSpeaker" className="label">Speaker</label>
              <input
                id="eventSpeaker"
                value={form.speaker}
                onChange={(e) => setForm((f) => ({ ...f, speaker: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="eventCapacity" className="label">Capacity</label>
              <input
                id="eventCapacity"
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="eventVisibility" className="label">Visibility</label>
              <select
                id="eventVisibility"
                value={form.visibility}
                onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
                className="input"
              >
                <option value="PUBLIC">Public</option>
                <option value="MEMBERS_ONLY">Members only</option>
                <option value="MINISTRY_CENTER">Ministry centre</option>
              </select>
            </div>
            <div>
              <label htmlFor="eventCenter" className="label">Ministry centre</label>
              <select
                id="eventCenter"
                value={form.ministryCenterId}
                onChange={(e) => setForm((f) => ({ ...f, ministryCenterId: e.target.value }))}
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

          <button
            type="submit"
            disabled={busy}
            className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Create draft event'}
          </button>
        </form>
      ) : null}

      <ul className="space-y-4">
        {events.map((event) => (
          <li
            key={event.id}
            className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      event.cancelledAt
                        ? 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200'
                        : event.status === 'PUBLISHED'
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                          : 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
                    }`}
                  >
                    {event.cancelledAt ? 'cancelled' : event.status.toLowerCase()}
                  </span>
                  <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-900 dark:bg-gold-950/60 dark:text-gold-200">
                    {event.category}
                  </span>
                  <span className="text-xs text-ink-500 dark:text-parchment-400">
                    {event.registrationCount} registration
                    {event.registrationCount === 1 ? '' : 's'}
                    {event.capacity ? ` of ${event.capacity}` : ''}
                  </span>
                </div>

                <h3 className="font-serif text-lg font-semibold">{event.title}</h3>
                <p className="mt-1 text-sm text-ink-600 dark:text-parchment-300">
                  {new Date(event.startsAt).toLocaleString()} ·{' '}
                  {event.mode === 'ONLINE' ? 'Online' : (event.location ?? 'In person')}
                  {event.ministryCenter ? ` · ${event.ministryCenter}` : ''}
                </p>
                {event.cancelReason ? (
                  <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                    Cancelled: {event.cancelReason}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {event.status !== 'PUBLISHED' && !event.cancelledAt && canPublish ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(event.id, 'publish')}
                    className="rounded-lg bg-gold-sheen px-4 py-2 text-xs font-semibold text-ink-950 disabled:opacity-60"
                  >
                    Publish
                  </button>
                ) : null}
                {event.status === 'PUBLISHED' && !event.cancelledAt && canPublish ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(event.id, 'unpublish')}
                    className="rounded-lg border border-ink-300 px-4 py-2 text-xs disabled:opacity-60 dark:border-ink-700"
                  >
                    Unpublish
                  </button>
                ) : null}
                {!event.cancelledAt && canRemind ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(event.id, 'send_reminder')}
                    className="rounded-lg border border-ink-300 px-4 py-2 text-xs disabled:opacity-60 dark:border-ink-700"
                  >
                    Send reminder
                  </button>
                ) : null}
                {canCreate ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(event.id, 'duplicate')}
                    className="rounded-lg border border-ink-300 px-4 py-2 text-xs disabled:opacity-60 dark:border-ink-700"
                  >
                    Duplicate
                  </button>
                ) : null}
                {!event.cancelledAt && canCancel ? (
                  <button
                    type="button"
                    onClick={() => setCancelId(cancelId === event.id ? null : event.id)}
                    className="rounded-lg border border-red-300 px-4 py-2 text-xs text-red-700 dark:border-red-800 dark:text-red-300"
                  >
                    Cancel event
                  </button>
                ) : null}
              </div>
            </div>

            {cancelId === event.id ? (
              <div className="mt-4 space-y-3 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                <label htmlFor={`cancel-${event.id}`} className="label text-red-900 dark:text-red-100">
                  Why is this cancelled? Every registrant is told, in these words.
                </label>
                <textarea
                  id={`cancel-${event.id}`}
                  rows={2}
                  minLength={8}
                  maxLength={500}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="input resize-y"
                />
                <button
                  type="button"
                  disabled={busy || cancelReason.trim().length < 8}
                  onClick={() => act(event.id, 'cancel', cancelReason)}
                  className="min-h-[2.75rem] rounded-lg bg-red-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? 'Cancelling…' : `Cancel and notify ${event.registrationCount} registrant(s)`}
                </button>
              </div>
            ) : null}
          </li>
        ))}

        {events.length === 0 ? (
          <li className="rounded-xl border border-dashed border-ink-300 px-6 py-12 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
            No events yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
