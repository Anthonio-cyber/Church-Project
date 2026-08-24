'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type QueueItem = {
  id: string;
  categoryLabel: string;
  summary: string;
  urgency: string;
  preferredMethod: string;
  preferredDate: string | null;
  preferredTimeLabel: string | null;
  language: string;
  createdAt: string;
  directlyAssigned: boolean;
  memberIsMinor: boolean;
};

/**
 * The counsellor's queue.
 *
 * Accepting means committing to a time: the counsellor schedules the session in
 * the same action, so a member never sits in an "accepted but unscheduled"
 * limbo wondering when someone will speak to them.
 */
export function CounsellorRequestQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState('');
  const [durationMinutes, setDuration] = useState(45);
  const [method, setMethod] = useState('TEXT');
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function accept(id: string) {
    setBusy(true);
    setStatus(null);

    const response = await fetch(`/api/counsellor/requests/${id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduledFor: new Date(scheduledFor).toISOString(),
        durationMinutes,
        method,
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({ tone: 'error', text: payload?.error?.message ?? 'Could not accept this request.' });
      setBusy(false);
      return;
    }

    setStatus({ tone: 'ok', text: payload.data.message });
    setActiveId(null);
    setScheduledFor('');
    setBusy(false);
    router.refresh();
  }

  async function decline(id: string) {
    setBusy(true);
    const response = await fetch(`/api/counsellor/requests/${id}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: declineReason }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    setStatus(
      response?.ok
        ? { tone: 'ok', text: payload.data.message }
        : { tone: 'error', text: payload?.error?.message ?? 'Could not decline.' },
    );
    setDeclineId(null);
    setDeclineReason('');
    setBusy(false);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-300 px-6 py-12 text-center dark:border-ink-700">
        <p aria-hidden className="mb-3 font-serif text-3xl text-gold-500">
          ✓
        </p>
        <h2 className="font-serif text-lg font-semibold">Your queue is clear</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-600 dark:text-parchment-300">
          Requests matching your areas of service appear here, along with any assigned to you
          directly by a counselling administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      <ul className="space-y-4">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-xl border bg-white p-5 dark:bg-ink-900 ${
              item.directlyAssigned
                ? 'border-gold-400 dark:border-gold-700'
                : 'border-ink-200 dark:border-ink-800'
            }`}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-900 ring-1 ring-inset ring-gold-300 dark:bg-gold-950/60 dark:text-gold-200 dark:ring-gold-800">
                {item.categoryLabel}
              </span>
              {item.urgency === 'URGENT' ? (
                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-800 ring-1 ring-inset ring-red-200 dark:bg-red-950/50 dark:text-red-200">
                  Urgent
                </span>
              ) : null}
              {item.directlyAssigned ? (
                <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200">
                  Assigned to you
                </span>
              ) : null}
              {item.memberIsMinor ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200">
                  Young person — safeguarding protections apply
                </span>
              ) : null}
            </div>

            <p className="text-base leading-relaxed">{item.summary}</p>

            <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm text-ink-600 sm:grid-cols-2 dark:text-parchment-300">
              <div className="flex gap-2">
                <dt className="font-medium text-ink-800 dark:text-parchment-100">Prefers</dt>
                <dd>
                  {item.preferredMethod === 'TEXT'
                    ? 'Written conversation'
                    : item.preferredMethod === 'VIDEO'
                      ? 'Video call'
                      : item.preferredMethod === 'VOICE'
                        ? 'Voice call'
                        : 'In person'}
                </dd>
              </div>
              {item.preferredDate || item.preferredTimeLabel ? (
                <div className="flex gap-2">
                  <dt className="font-medium text-ink-800 dark:text-parchment-100">When</dt>
                  <dd>
                    {[
                      item.preferredDate
                        ? new Date(item.preferredDate).toLocaleDateString()
                        : null,
                      item.preferredTimeLabel,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </dd>
                </div>
              ) : null}
              <div className="flex gap-2">
                <dt className="font-medium text-ink-800 dark:text-parchment-100">Language</dt>
                <dd>{item.language}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-ink-800 dark:text-parchment-100">Waiting since</dt>
                <dd>{new Date(item.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>

            {activeId === item.id ? (
              <div className="mt-5 space-y-4 rounded-lg border border-ink-200 p-4 dark:border-ink-800">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label htmlFor={`when-${item.id}`} className="label">
                      Date and time
                    </label>
                    <input
                      id={`when-${item.id}`}
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(event) => setScheduledFor(event.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor={`duration-${item.id}`} className="label">
                      Minutes
                    </label>
                    <select
                      id={`duration-${item.id}`}
                      value={durationMinutes}
                      onChange={(event) => setDuration(Number(event.target.value))}
                      className="input"
                    >
                      {[30, 45, 60, 90].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor={`method-${item.id}`} className="label">
                    Session type
                  </label>
                  <select
                    id={`method-${item.id}`}
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                    className="input"
                  >
                    <option value="TEXT">Written conversation</option>
                    <option value="VOICE">Voice call</option>
                    <option value="VIDEO">Video call</option>
                    <option value="IN_PERSON">In person</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => accept(item.id)}
                    disabled={busy || !scheduledFor}
                    className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
                  >
                    {busy ? 'Scheduling…' : 'Confirm and notify'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    className="min-h-[2.75rem] rounded-lg border border-ink-300 px-5 text-sm dark:border-ink-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : declineId === item.id ? (
              <div className="mt-5 space-y-3 rounded-lg border border-ink-200 p-4 dark:border-ink-800">
                <label htmlFor={`reason-${item.id}`} className="label">
                  Why are you declining? This returns the request to the queue.
                </label>
                <textarea
                  id={`reason-${item.id}`}
                  rows={2}
                  value={declineReason}
                  onChange={(event) => setDeclineReason(event.target.value)}
                  className="input resize-none"
                  maxLength={300}
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => decline(item.id)}
                    disabled={busy || declineReason.trim().length < 3}
                    className="min-h-[2.75rem] rounded-lg border border-ink-300 px-5 text-sm disabled:opacity-50 dark:border-ink-700"
                  >
                    Return to queue
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeclineId(null)}
                    className="min-h-[2.75rem] rounded-lg px-5 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950"
                >
                  Accept and schedule
                </button>
                <button
                  type="button"
                  onClick={() => setDeclineId(item.id)}
                  className="min-h-[2.75rem] rounded-lg border border-ink-300 px-5 text-sm dark:border-ink-700"
                >
                  Decline
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
