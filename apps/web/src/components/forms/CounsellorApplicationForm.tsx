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

const LANGUAGES: [string, string][] = [
  ['en', 'English'],
  ['fr', 'Français'],
  ['es', 'Español'],
  ['pt', 'Português'],
  ['sw', 'Kiswahili'],
];

/**
 * Applying to serve as a counsellor.
 *
 * Submitting this grants nothing by itself — it creates a PENDING record that
 * only an administrator holding counsellors.verify can approve, from the
 * Admin Portal's Counsellors page.
 */
export function CounsellorApplicationForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    ministryRole: '',
    biography: '',
    experienceYears: '',
    qualifications: '',
    referenceInfo: '',
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(['en']);
  const [sessionTypes, setSessionTypes] = useState<string[]>(['TEXT']);
  const [acceptsMinors, setAcceptsMinors] = useState(false);
  const [agreePolicies, setAgreePolicies] = useState(false);
  const [agreeSafeguarding, setAgreeSafeguarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState<{ message: string } | null>(null);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggle(list: string[], setList: (next: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch('/api/counsellor/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ministryRole: form.ministryRole,
        biography: form.biography,
        categories,
        languages,
        experienceYears: form.experienceYears ? Number(form.experienceYears) : 0,
        qualifications: form.qualifications || undefined,
        referenceInfo: form.referenceInfo || undefined,
        sessionTypes,
        acceptsMinors,
        agreeToCounsellingPolicies: agreePolicies,
        acknowledgeSafeguarding: agreeSafeguarding,
      }),
    }).catch(() => null);

    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setError(payload?.error?.message ?? 'We could not submit your application. Please try again.');
      setPending(false);
      return;
    }

    setSubmitted({ message: payload.data.message });
    setPending(false);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-ink-200 bg-white p-6 text-center shadow-card dark:border-ink-800 dark:bg-ink-900">
        <p aria-hidden className="text-4xl text-gold-500">
          ✓
        </p>
        <h2 className="mt-3 font-serif text-xl font-semibold">Application submitted</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
          {submitted.message}
        </p>
        <div className="mt-6">
          <Link
            href="/app/dashboard"
            className="min-h-[2.75rem] inline-flex items-center rounded-lg border border-ink-300 px-5 py-2.5 text-sm dark:border-ink-700"
          >
            Back to dashboard
          </Link>
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
        <label htmlFor="ministryRole" className="label">
          Your ministry role or title
        </label>
        <input
          id="ministryRole"
          required
          minLength={2}
          maxLength={80}
          value={form.ministryRole}
          onChange={(e) => update('ministryRole', e.target.value)}
          className="input"
          placeholder="e.g. Pastor, Minister, Ministry Worker"
        />
      </div>

      <div>
        <label htmlFor="biography" className="label">
          Tell us about yourself and how you serve
        </label>
        <textarea
          id="biography"
          required
          rows={5}
          minLength={50}
          maxLength={3000}
          value={form.biography}
          onChange={(e) => update('biography', e.target.value)}
          className="input resize-y"
          placeholder="Your background, your experience, and how you'd like to serve members seeking counselling."
        />
        <p className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
          {form.biography.length}/3000 · Shown to members deciding whether to request you.
        </p>
      </div>

      <div>
        <span className="label">Areas you can serve in</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CATEGORIES.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={categories.includes(value)}
                onChange={() => toggle(categories, setCategories, value)}
                className="h-4 w-4 accent-gold-600"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <span className="label">Languages you counsel in</span>
          <div className="mt-2 space-y-2">
            {LANGUAGES.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={languages.includes(value)}
                  onChange={() => toggle(languages, setLanguages, value)}
                  className="h-4 w-4 accent-gold-600"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className="label">How you can meet with members</span>
          <div className="mt-2 space-y-2">
            {(
              [
                ['TEXT', 'Written conversation'],
                ['VOICE', 'Voice call'],
                ['VIDEO', 'Video call'],
                ['IN_PERSON', 'In person'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sessionTypes.includes(value)}
                  onChange={() => toggle(sessionTypes, setSessionTypes, value)}
                  className="h-4 w-4 accent-gold-600"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="experienceYears" className="label">
            Years of ministry experience
          </label>
          <input
            id="experienceYears"
            type="number"
            min={0}
            max={80}
            value={form.experienceYears}
            onChange={(e) => update('experienceYears', e.target.value)}
            className="input"
          />
        </div>

        <div className="flex items-end pb-2.5">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={acceptsMinors}
              onChange={(e) => setAcceptsMinors(e.target.checked)}
              className="h-4 w-4 accent-gold-600"
            />
            I am willing and approved to serve young people
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="qualifications" className="label">
          Relevant training or qualifications{' '}
          <span className="font-normal text-ink-500">(optional)</span>
        </label>
        <textarea
          id="qualifications"
          rows={3}
          maxLength={1000}
          value={form.qualifications}
          onChange={(e) => update('qualifications', e.target.value)}
          className="input resize-y"
        />
      </div>

      <div>
        <label htmlFor="referenceInfo" className="label">
          A reference who can vouch for your character{' '}
          <span className="font-normal text-ink-500">(optional)</span>
        </label>
        <input
          id="referenceInfo"
          maxLength={500}
          value={form.referenceInfo}
          onChange={(e) => update('referenceInfo', e.target.value)}
          className="input"
          placeholder="Name and how they know you"
        />
      </div>

      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/40">
        <h2 className="font-serif text-base font-semibold text-amber-900 dark:text-amber-100">
          Before you apply
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
          Approved counsellors have access to what members share in confidence. Every session,
          note and access to counselling content is recorded, and this platform's safeguarding
          policy applies to you in full.
        </p>
        <div className="mt-4 space-y-3">
          <label className="flex gap-3 text-sm text-amber-900 dark:text-amber-100">
            <input
              type="checkbox"
              required
              checked={agreePolicies}
              onChange={(e) => setAgreePolicies(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-gold-600"
            />
            <span>I have read and agree to the counselling policies.</span>
          </label>
          <label className="flex gap-3 text-sm text-amber-900 dark:text-amber-100">
            <input
              type="checkbox"
              required
              checked={agreeSafeguarding}
              onChange={(e) => setAgreeSafeguarding(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-gold-600"
            />
            <span>
              I have read and acknowledge the{' '}
              <Link href="/safeguarding" target="_blank" className="underline underline-offset-2">
                safeguarding policy
              </Link>
              .
            </span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={
          pending ||
          !agreePolicies ||
          !agreeSafeguarding ||
          form.ministryRole.trim().length < 2 ||
          form.biography.trim().length < 50 ||
          categories.length === 0 ||
          languages.length === 0 ||
          sessionTypes.length === 0
        }
        className="min-h-[2.75rem] w-full rounded-lg bg-gold-sheen px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:brightness-105 disabled:opacity-50"
      >
        {pending ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}
