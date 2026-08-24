'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const CATEGORIES: [string, string][] = [
  ['SPIRITUAL_GROWTH', 'Spiritual Growth'],
  ['PRAYER_AND_FAITH', 'Prayer and Faith'],
  ['FAMILY', 'Family'],
  ['MARRIAGE', 'Marriage'],
  ['RELATIONSHIPS', 'Relationships'],
  ['PURPOSE_AND_CALLING', 'Purpose and Calling'],
  ['DISCIPLESHIP', 'Discipleship'],
  ['PERSONAL_STRUGGLES', 'Personal Struggles'],
  ['YOUTH_GUIDANCE', 'Youth and Young Adult Guidance'],
  ['MINISTRY', 'Ministry'],
  ['BEREAVEMENT', 'Bereavement'],
  ['LIFE_DECISIONS', 'Life Decisions'],
  ['OTHER', 'Other'],
];

/**
 * Requesting counselling.
 *
 * If the server's safeguarding triage flags what was written, the response
 * carries a message that is shown prominently — before the confirmation — so
 * that someone describing danger sees the emergency guidance first rather than
 * a cheerful "request received".
 */
export function CounsellingRequestForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    category: 'SPIRITUAL_GROWTH',
    summary: '',
    details: '',
    preferredGender: 'UNSPECIFIED',
    preferredDate: '',
    preferredTimeLabel: '',
    urgency: 'ROUTINE',
    preferredMethod: 'TEXT',
    language: 'en',
  });
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    matchesFound: number;
    safeguarding: { flagged: boolean; message?: string };
  } | null>(null);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch('/api/counselling/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        details: form.details || undefined,
        preferredDate: form.preferredDate
          ? new Date(form.preferredDate).toISOString()
          : undefined,
        preferredTimeLabel: form.preferredTimeLabel || undefined,
        acknowledgeDisclaimer: acknowledged,
      }),
    }).catch(() => null);

    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setError(payload?.error?.message ?? 'We could not submit your request. Please try again.');
      setPending(false);
      return;
    }

    setResult(payload.data);
    setPending(false);
  }

  if (result) {
    return (
      <div className="space-y-6">
        {result.safeguarding.flagged && result.safeguarding.message ? (
          <div
            role="alert"
            className="rounded-xl border-2 border-red-400 bg-red-50 p-6 dark:border-red-700 dark:bg-red-950/50"
          >
            <h2 className="font-serif text-lg font-semibold text-red-900 dark:text-red-200">
              Please read this first
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-red-900 dark:text-red-100">
              {result.safeguarding.message}
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-ink-200 bg-white p-6 text-center shadow-card dark:border-ink-800 dark:bg-ink-900">
          <p aria-hidden className="text-4xl text-gold-500">
            ✓
          </p>
          <h2 className="mt-3 font-serif text-xl font-semibold">Request received</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
            {result.message}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/app/counselling')}
              className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950"
            >
              View my counselling
            </button>
            <Link
              href="/app/dashboard"
              className="min-h-[2.75rem] rounded-lg border border-ink-300 px-5 py-2.5 text-sm dark:border-ink-700"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
        >
          {error}
        </div>
      ) : null}

      <div>
        <label htmlFor="summary" className="label">
          What would you like to talk about?
        </label>
        <textarea
          id="summary"
          required
          rows={3}
          maxLength={500}
          value={form.summary}
          onChange={(e) => update('summary', e.target.value)}
          className="input resize-y"
          placeholder="A sentence or two is enough. Your counsellor will see this before your session."
          aria-describedby="summaryHelp"
        />
        <p id="summaryHelp" className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
          {form.summary.length}/500 · Only you, your assigned counsellor and — where there is a
          safeguarding concern — a safeguarding lead can see this.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="label">
            Counselling category
          </label>
          <select
            id="category"
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
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
          <label htmlFor="urgency" className="label">
            How soon do you need to speak?
          </label>
          <select
            id="urgency"
            value={form.urgency}
            onChange={(e) => update('urgency', e.target.value)}
            className="input"
          >
            <option value="ROUTINE">When a counsellor is available</option>
            <option value="SOON">Within the next few days</option>
            <option value="URGENT">As soon as possible</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="details" className="label">
          Anything else you would like your counsellor to know{' '}
          <span className="font-normal text-ink-500">(optional)</span>
        </label>
        <textarea
          id="details"
          rows={5}
          maxLength={4000}
          value={form.details}
          onChange={(e) => update('details', e.target.value)}
          className="input resize-y"
        />
      </div>

      <fieldset className="rounded-lg border border-ink-200 p-5 dark:border-ink-800">
        <legend className="px-2 text-sm font-medium">Your preferences</legend>
        <p className="mb-4 text-xs text-ink-500 dark:text-parchment-400">
          We honour these where we can. Where we cannot, your request waits with a counselling
          administrator rather than being matched against your wishes.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="preferredGender" className="label">
              Preferred counsellor
            </label>
            <select
              id="preferredGender"
              value={form.preferredGender}
              onChange={(e) => update('preferredGender', e.target.value)}
              className="input"
            >
              <option value="UNSPECIFIED">No preference</option>
              <option value="FEMALE">A female counsellor</option>
              <option value="MALE">A male counsellor</option>
            </select>
          </div>

          <div>
            <label htmlFor="preferredMethod" className="label">
              How would you like to meet?
            </label>
            <select
              id="preferredMethod"
              value={form.preferredMethod}
              onChange={(e) => update('preferredMethod', e.target.value)}
              className="input"
            >
              <option value="TEXT">Written conversation</option>
              <option value="VOICE">Voice call</option>
              <option value="VIDEO">Video call</option>
              <option value="IN_PERSON">In person, at a ministry centre</option>
            </select>
          </div>

          <div>
            <label htmlFor="preferredDate" className="label">
              Preferred date <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <input
              id="preferredDate"
              type="date"
              value={form.preferredDate}
              onChange={(e) => update('preferredDate', e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="preferredTimeLabel" className="label">
              Preferred time <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <input
              id="preferredTimeLabel"
              placeholder="e.g. mornings, after 6pm"
              maxLength={40}
              value={form.preferredTimeLabel}
              onChange={(e) => update('preferredTimeLabel', e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="language" className="label">
              Language
            </label>
            <select
              id="language"
              value={form.language}
              onChange={(e) => update('language', e.target.value)}
              className="input"
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
              <option value="pt">Português</option>
              <option value="sw">Kiswahili</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* The disclaimer is shown in full, immediately before the request is sent. */}
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/40">
        <h2 className="font-serif text-base font-semibold text-amber-900 dark:text-amber-100">
          Before you send this request
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
          Pastoral counselling provides spiritual guidance, prayer, biblical encouragement and
          pastoral support. It is not a substitute for emergency services, licensed medical care,
          psychological treatment, psychiatric treatment, legal advice or other professional
          services.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
          If you are in immediate danger, or thinking of harming yourself or someone else, please
          contact your local emergency services or a crisis line now.
        </p>
        <label className="mt-4 flex gap-3 text-sm text-amber-900 dark:text-amber-100">
          <input
            type="checkbox"
            required
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-gold-600"
          />
          <span>
            I have read and understood this.{' '}
            <Link
              href="/counselling-disclaimer"
              target="_blank"
              className="underline underline-offset-2"
            >
              Read the full disclaimer
            </Link>
            .
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending || !acknowledged || form.summary.trim().length < 10}
        className="min-h-[2.75rem] w-full rounded-lg bg-gold-sheen px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:brightness-105 disabled:opacity-50"
      >
        {pending ? 'Sending your request…' : 'Send counselling request'}
      </button>
    </form>
  );
}
