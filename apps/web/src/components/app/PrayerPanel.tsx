'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type PrayerEntry = {
  id: string;
  title: string;
  body: string;
  category: string;
  visibility: string;
  prayerCount: number;
  createdAt: string;
  isMine: boolean;
  hasPrayed: boolean;
  authorName: string;
};

const CATEGORIES: [string, string][] = [
  ['SPIRITUAL_LIFE', 'Spiritual Life'],
  ['FAMILY', 'Family'],
  ['WORK_OR_SCHOOL', 'Work or School'],
  ['HEALTH', 'Health'],
  ['RELATIONSHIPS', 'Relationships'],
  ['MINISTRY', 'Ministry'],
  ['THANKSGIVING', 'Thanksgiving'],
  ['OTHER', 'Other'],
];

export function PrayerPanel({ initial, scope }: { initial: PrayerEntry[]; scope: string }) {
  const router = useRouter();
  const [prayers, setPrayers] = useState(initial);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    category: 'OTHER',
    visibility: 'PUBLIC',
    isAnonymous: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch('/api/prayers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setError(payload?.error?.message ?? 'We could not save your prayer request.');
      setBusy(false);
      return;
    }

    setComposing(false);
    setForm({ title: '', body: '', category: 'OTHER', visibility: 'PUBLIC', isAnonymous: false });
    setBusy(false);
    router.refresh();
  }

  async function pray(id: string) {
    // Optimistic: the count moves immediately, because a prayer that feels
    // laggy discourages the very thing we are trying to encourage.
    setPrayers((current) =>
      current.map((prayer) =>
        prayer.id === id
          ? { ...prayer, hasPrayed: true, prayerCount: prayer.prayerCount + 1 }
          : prayer,
      ),
    );

    const response = await fetch(`/api/prayers/${id}/pray`, { method: 'POST' }).catch(() => null);
    if (!response?.ok) {
      setPrayers((current) =>
        current.map((prayer) =>
          prayer.id === id
            ? { ...prayer, hasPrayed: false, prayerCount: Math.max(0, prayer.prayerCount - 1) }
            : prayer,
        ),
      );
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this prayer request? It will be removed, not merely hidden.')) return;
    const response = await fetch(`/api/prayers/${id}`, { method: 'DELETE' }).catch(() => null);
    if (response?.ok) {
      setPrayers((current) => current.filter((prayer) => prayer.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Prayer views" className="flex gap-2">
          {[
            { value: 'public', label: 'Prayer wall' },
            { value: 'mine', label: 'My requests' },
          ].map((tab) => (
            <a
              key={tab.value}
              href={`/app/prayer?scope=${tab.value}`}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                scope === tab.value
                  ? 'bg-gold-sheen text-ink-950'
                  : 'border border-ink-300 text-ink-700 dark:border-ink-700 dark:text-parchment-200'
              }`}
            >
              {tab.label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setComposing((open) => !open)}
          className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950"
        >
          {composing ? 'Cancel' : 'Request Prayer'}
        </button>
      </div>

      {composing ? (
        <form
          onSubmit={submit}
          className="space-y-5 rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900"
        >
          {error ? (
            <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          ) : null}

          <div>
            <label htmlFor="prayerTitle" className="label">
              Title
            </label>
            <input
              id="prayerTitle"
              required
              maxLength={120}
              value={form.title}
              onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="prayerBody" className="label">
              What would you like prayer for?
            </label>
            <textarea
              id="prayerBody"
              required
              rows={4}
              maxLength={2000}
              value={form.body}
              onChange={(event) => setForm((f) => ({ ...f, body: event.target.value }))}
              className="input resize-y"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="prayerCategory" className="label">
                Category
              </label>
              <select
                id="prayerCategory"
                value={form.category}
                onChange={(event) => setForm((f) => ({ ...f, category: event.target.value }))}
                className="input"
              >
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="prayerVisibility" className="label">
                Who should see this?
              </label>
              <select
                id="prayerVisibility"
                value={form.visibility}
                onChange={(event) => setForm((f) => ({ ...f, visibility: event.target.value }))}
                className="input"
              >
                <option value="PUBLIC">The fellowship (prayer wall)</option>
                <option value="MINISTRY_TEAM_ONLY">The ministry team only</option>
                <option value="PRIVATE">Only me</option>
              </select>
            </div>
          </div>

          {form.visibility === 'PUBLIC' ? (
            <label className="flex gap-3 text-sm text-ink-700 dark:text-parchment-200">
              <input
                type="checkbox"
                checked={form.isAnonymous}
                onChange={(event) => setForm((f) => ({ ...f, isAnonymous: event.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-gold-600"
              />
              <span>
                Share anonymously. Your name is withheld by the system itself, not merely hidden in
                the interface.
              </span>
            </label>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="min-h-[2.75rem] w-full rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Share prayer request'}
          </button>
        </form>
      ) : null}

      {prayers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 px-6 py-12 text-center dark:border-ink-700">
          <p aria-hidden className="mb-3 font-serif text-3xl text-gold-500">
            ✧
          </p>
          <h2 className="font-serif text-lg font-semibold">
            {scope === 'mine' ? 'You have no prayer requests' : 'The prayer wall is quiet'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-600 dark:text-parchment-300">
            {scope === 'mine'
              ? 'When you share a request, it appears here — and you can remove it at any time.'
              : 'When members share requests publicly, they appear here for the fellowship to pray over.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {prayers.map((prayer) => (
            <li
              key={prayer.id}
              className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">
                    {CATEGORIES.find(([value]) => value === prayer.category)?.[1] ?? prayer.category}
                  </p>
                  <h3 className="mt-1.5 font-serif text-lg font-semibold">{prayer.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700 dark:text-parchment-200">
                    {prayer.body}
                  </p>
                  <p className="mt-3 text-xs text-ink-500 dark:text-parchment-400">
                    {prayer.authorName} ·{' '}
                    {new Date(prayer.createdAt).toLocaleDateString(undefined, {
                      dateStyle: 'medium',
                    })}
                    {prayer.visibility !== 'PUBLIC'
                      ? ` · ${prayer.visibility === 'PRIVATE' ? 'Private' : 'Ministry team only'}`
                      : ''}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => pray(prayer.id)}
                    disabled={prayer.hasPrayed}
                    className={`min-h-[2.5rem] rounded-lg px-4 text-sm font-semibold transition ${
                      prayer.hasPrayed
                        ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-gold-sheen text-ink-950'
                    }`}
                  >
                    {prayer.hasPrayed ? '✓ Praying' : 'Pray for this'}
                  </button>
                  <span className="text-xs text-ink-500 dark:text-parchment-400">
                    {prayer.prayerCount} {prayer.prayerCount === 1 ? 'person is' : 'people are'}{' '}
                    praying
                  </span>
                  {prayer.isMine ? (
                    <button
                      type="button"
                      onClick={() => remove(prayer.id)}
                      className="text-xs text-red-700 underline underline-offset-4 dark:text-red-400"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
