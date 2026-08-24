'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type NoteView = {
  id: string;
  kind: string;
  content: string;
  createdAt: string;
  lastAccessedAt: string | null;
  lastModifiedById: string | null;
};

/**
 * Counselling notes.
 *
 * The distinction between the two kinds is made unmissable in the interface,
 * because getting it wrong has consequences: an internal note is the
 * counsellor's own pastoral record and the member never sees it, while a
 * follow-up note is written deliberately for the member to read.
 */
export function SessionNotesEditor({
  sessionId,
  notes,
}: {
  sessionId: string;
  notes: NoteView[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<'INTERNAL' | 'SHARED_FOLLOW_UP'>('INTERNAL');
  const [content, setContent] = useState('');
  const [retentionMonths, setRetentionMonths] = useState<number | ''>('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);

    const response = await fetch(`/api/counselling/sessions/${sessionId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        content,
        retentionMonths: retentionMonths === '' ? undefined : Number(retentionMonths),
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({ tone: 'error', text: payload?.error?.message ?? 'The note could not be saved.' });
      setBusy(false);
      return;
    }

    setStatus({ tone: 'ok', text: payload.data.message });
    setContent('');
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">Write a note</h2>

        <form
          onSubmit={submit}
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

          <fieldset>
            <legend className="label">Who is this note for?</legend>
            <div className="space-y-3">
              <label className="flex gap-3 rounded-lg border border-ink-200 p-3 dark:border-ink-800">
                <input
                  type="radio"
                  name="noteKind"
                  checked={kind === 'INTERNAL'}
                  onChange={() => setKind('INTERNAL')}
                  className="mt-1 h-4 w-4 accent-gold-600"
                />
                <span>
                  <span className="block text-sm font-medium">Internal pastoral note</span>
                  <span className="block text-xs text-ink-500 dark:text-parchment-400">
                    Your own record. Encrypted at rest. The member never sees it, and every access
                    to it is recorded — including your own.
                  </span>
                </span>
              </label>

              <label className="flex gap-3 rounded-lg border border-gold-300 bg-gold-50/50 p-3 dark:border-gold-800 dark:bg-gold-950/20">
                <input
                  type="radio"
                  name="noteKind"
                  checked={kind === 'SHARED_FOLLOW_UP'}
                  onChange={() => setKind('SHARED_FOLLOW_UP')}
                  className="mt-1 h-4 w-4 accent-gold-600"
                />
                <span>
                  <span className="block text-sm font-medium">Follow-up note for the member</span>
                  <span className="block text-xs text-ink-500 dark:text-parchment-400">
                    The member will read this. Scripture to reflect on, an encouragement, a next
                    step you agreed.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div>
            <label htmlFor="noteContent" className="label">
              Note
            </label>
            <textarea
              id="noteContent"
              required
              rows={10}
              maxLength={8000}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="input resize-y"
            />
            <p className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
              {content.length}/8000
            </p>
          </div>

          {kind === 'INTERNAL' ? (
            <div>
              <label htmlFor="retention" className="label">
                Retain for <span className="font-normal text-ink-500">(optional)</span>
              </label>
              <select
                id="retention"
                value={retentionMonths}
                onChange={(event) =>
                  setRetentionMonths(event.target.value === '' ? '' : Number(event.target.value))
                }
                className="input"
              >
                <option value="">Follow the ministry’s default retention policy</option>
                <option value={6}>6 months</option>
                <option value={12}>1 year</option>
                <option value={24}>2 years</option>
                <option value={60}>5 years</option>
              </select>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || content.trim().length === 0}
            className="min-h-[2.75rem] w-full rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save note'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">Notes on this session</h2>

        {notes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-300 p-8 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
            No notes yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {notes.map((note) => (
              <li
                key={note.id}
                className={`rounded-xl border p-5 ${
                  note.kind === 'SHARED_FOLLOW_UP'
                    ? 'border-gold-300 bg-gold-50/50 dark:border-gold-800 dark:bg-gold-950/20'
                    : 'border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900'
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-parchment-400">
                  {note.kind === 'SHARED_FOLLOW_UP'
                    ? 'Shared with the member'
                    : 'Internal — not visible to the member'}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
                <dl className="mt-4 space-y-0.5 border-t border-ink-200 pt-3 text-xs text-ink-500 dark:border-ink-800 dark:text-parchment-400">
                  <div>Created at {new Date(note.createdAt).toLocaleString()}</div>
                  {note.lastAccessedAt ? (
                    <div>Last accessed {new Date(note.lastAccessedAt).toLocaleString()}</div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
