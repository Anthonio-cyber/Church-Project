'use client';

import { useState } from 'react';

const CATEGORIES: [string, string][] = [
  ['HARASSMENT', 'Harassment'],
  ['SPAM', 'Spam'],
  ['IMPERSONATION', 'Impersonation'],
  ['INAPPROPRIATE_BEHAVIOUR', 'Inappropriate behaviour'],
  ['MANIPULATION', 'Manipulation'],
  ['FINANCIAL_SOLICITATION', 'Financial solicitation'],
  ['SEXUAL_MISCONDUCT', 'Sexual misconduct'],
  ['THREATS', 'Threats'],
  ['OTHER', 'Other'],
];

/**
 * Reporting a concern.
 *
 * Some categories go straight to safeguarding rather than the moderation
 * queue, and the response says so — the person reporting deserves to know their
 * report was taken seriously enough to be routed differently.
 */
export function ReportForm({ reportedUserId }: { reportedUserId?: string }) {
  const [category, setCategory] = useState('HARASSMENT');
  const [description, setDescription] = useState('');
  const [targetId, setTargetId] = useState(reportedUserId ?? '');
  const [result, setResult] = useState<{
    reference: string;
    message: string;
    safeguardingMessage?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        description,
        reportedUserId: targetId || undefined,
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setError(payload?.error?.message ?? 'We could not submit your report.');
      setBusy(false);
      return;
    }

    setResult({
      reference: payload.data.report.reference,
      message: payload.data.message,
      safeguardingMessage: payload.data.safeguarding?.message,
    });
    setBusy(false);
  }

  if (result) {
    return (
      <div className="space-y-4">
        {result.safeguardingMessage ? (
          <div
            role="alert"
            className="rounded-xl border-2 border-red-400 bg-red-50 p-5 dark:border-red-700 dark:bg-red-950/50"
          >
            <p className="text-sm leading-relaxed text-red-900 dark:text-red-100">
              {result.safeguardingMessage}
            </p>
          </div>
        ) : null}
        <div className="rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900">
          <p className="font-serif text-lg font-semibold">Report submitted</p>
          <p className="mt-2 text-sm text-ink-600 dark:text-parchment-300">{result.message}</p>
          <p className="mt-3 text-sm">
            Your reference is{' '}
            <span className="font-mono font-semibold text-gold-700 dark:text-gold-400">
              {result.reference}
            </span>
            . You will be told when it has been reviewed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div>
        <label htmlFor="reportCategory" className="label">
          What are you reporting?
        </label>
        <select
          id="reportCategory"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
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
        <label htmlFor="reportedUserId" className="label">
          Member ID <span className="font-normal text-ink-500">(if you have it)</span>
        </label>
        <input
          id="reportedUserId"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          className="input font-mono text-sm"
          placeholder="Leave blank if you are reporting something general"
        />
      </div>

      <div>
        <label htmlFor="reportDescription" className="label">
          What happened?
        </label>
        <textarea
          id="reportDescription"
          required
          rows={5}
          minLength={10}
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="input resize-y"
          placeholder="Tell us what happened, and when. The more specific you can be, the better we can act."
        />
      </div>

      <button
        type="submit"
        disabled={busy || description.trim().length < 10}
        className="min-h-[2.75rem] w-full rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
      >
        {busy ? 'Submitting…' : 'Submit report'}
      </button>

      <p className="text-xs leading-relaxed text-ink-500 dark:text-parchment-400">
        Reports of sexual misconduct or threats go directly to a safeguarding lead rather than the
        general moderation queue.
      </p>
    </form>
  );
}
