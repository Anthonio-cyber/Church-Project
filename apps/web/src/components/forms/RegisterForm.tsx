'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const PASSWORD_RULES = [
  { test: (value: string) => value.length >= 12, label: 'At least 12 characters' },
  { test: (value: string) => /[a-z]/.test(value), label: 'A lowercase letter' },
  { test: (value: string) => /[A-Z]/.test(value), label: 'An uppercase letter' },
  { test: (value: string) => /[0-9]/.test(value), label: 'A number' },
];

/**
 * Registration.
 *
 * The three consents are separate, unticked checkboxes rather than one bundled
 * "I agree": terms, privacy and the counselling disclaimer are different
 * agreements, and each is recorded individually with its policy version.
 */
export function RegisterForm() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    password: '',
    country: '',
    preferredLanguage: 'en',
    dateOfBirth: '',
    gender: 'UNSPECIFIED',
    phone: '',
  });
  const [consents, setConsents] = useState({
    acceptTerms: false,
    acceptPrivacy: false,
    acknowledgeCounsellingDisclaimer: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [done, setDone] = useState<{ message: string } | null>(null);
  const [pending, setPending] = useState(false);

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(form.password) })),
    [form.password],
  );

  const allConsented = Object.values(consents).every(Boolean);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setProblems([]);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : undefined,
          phone: form.phone || undefined,
          ...consents,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'We could not create your account.');
        const detail = payload?.error?.detail;
        if (detail?.problems) setProblems(detail.problems);
        if (detail?.issues) setProblems(detail.issues.map((i: { message: string }) => i.message));
        setPending(false);
        return;
      }

      setDone({
        message: payload.data.message,
      });
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    }
    setPending(false);
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p aria-hidden className="text-4xl">
          ✓
        </p>
        <h2 className="font-serif text-xl font-semibold">Welcome</h2>
        <p className="text-sm leading-relaxed text-parchment-300">{done.message}</p>
        <Link
          href="/login"
          className="inline-block min-h-[2.75rem] rounded-lg bg-gold-sheen px-6 py-2.5 text-sm font-semibold text-ink-950"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const field =
    'w-full rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-parchment-100 placeholder:text-ink-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40';
  const label = 'mb-1.5 block text-sm font-medium text-parchment-200';

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error ? (
        <div role="alert" className="rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-200">
          <p>{error}</p>
          {problems.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className={label}>
            First name
          </label>
          <input
            id="firstName"
            required
            autoComplete="given-name"
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="lastName" className={label}>
            Last name
          </label>
          <input
            id="lastName"
            required
            autoComplete="family-name"
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            className={field}
          />
        </div>
      </div>

      <div>
        <label htmlFor="displayName" className={label}>
          Display name
        </label>
        <input
          id="displayName"
          required
          value={form.displayName}
          onChange={(e) => update('displayName', e.target.value)}
          className={field}
          aria-describedby="displayNameHelp"
        />
        <p id="displayNameHelp" className="mt-1.5 text-xs text-parchment-400">
          This is what other members see. You do not have to use your real name.
        </p>
      </div>

      <div>
        <label htmlFor="email" className={label}>
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          className={field}
        />
      </div>

      <div>
        <label htmlFor="password" className={label}>
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          className={field}
          aria-describedby="passwordRules"
        />
        <ul id="passwordRules" className="mt-2 grid grid-cols-2 gap-1 text-xs">
          {passwordChecks.map((check) => (
            <li
              key={check.label}
              className={check.passed ? 'text-emerald-400' : 'text-parchment-500'}
            >
              <span aria-hidden>{check.passed ? '✓' : '·'}</span> {check.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="country" className={label}>
            Country
          </label>
          <input
            id="country"
            required
            autoComplete="country-name"
            value={form.country}
            onChange={(e) => update('country', e.target.value)}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="preferredLanguage" className={label}>
            Preferred language
          </label>
          <select
            id="preferredLanguage"
            value={form.preferredLanguage}
            onChange={(e) => update('preferredLanguage', e.target.value)}
            className={field}
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
            <option value="pt">Português</option>
            <option value="sw">Kiswahili</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="dateOfBirth" className={label}>
            Date of birth
          </label>
          <input
            id="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => update('dateOfBirth', e.target.value)}
            className={field}
            aria-describedby="dobHelp"
          />
          <p id="dobHelp" className="mt-1.5 text-xs text-parchment-400">
            Used only to apply age-appropriate safeguarding protections.
          </p>
        </div>
        <div>
          <label htmlFor="gender" className={label}>
            Gender <span className="font-normal text-parchment-400">(optional)</span>
          </label>
          <select
            id="gender"
            value={form.gender}
            onChange={(e) => update('gender', e.target.value)}
            className={field}
            aria-describedby="genderHelp"
          >
            <option value="UNSPECIFIED">Prefer not to say</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
          </select>
          <p id="genderHelp" className="mt-1.5 text-xs text-parchment-400">
            Used only to honour counsellor preferences you set.
          </p>
        </div>
      </div>

      <fieldset className="space-y-3 rounded-lg border border-ink-700 p-4">
        <legend className="px-2 text-sm font-medium text-parchment-200">
          Please read and agree
        </legend>

        <label className="flex gap-3 text-sm text-parchment-300">
          <input
            type="checkbox"
            required
            checked={consents.acceptTerms}
            onChange={(e) => setConsents((c) => ({ ...c, acceptTerms: e.target.checked }))}
            className="mt-0.5 h-4 w-4 shrink-0 accent-gold-500"
          />
          <span>
            I accept the{' '}
            <Link href="/terms" target="_blank" className="text-gold-400 underline underline-offset-2">
              Terms of Use
            </Link>
            .
          </span>
        </label>

        <label className="flex gap-3 text-sm text-parchment-300">
          <input
            type="checkbox"
            required
            checked={consents.acceptPrivacy}
            onChange={(e) => setConsents((c) => ({ ...c, acceptPrivacy: e.target.checked }))}
            className="mt-0.5 h-4 w-4 shrink-0 accent-gold-500"
          />
          <span>
            I have read the{' '}
            <Link href="/privacy" target="_blank" className="text-gold-400 underline underline-offset-2">
              Privacy Policy
            </Link>{' '}
            and understand who can access my information.
          </span>
        </label>

        <label className="flex gap-3 text-sm text-parchment-300">
          <input
            type="checkbox"
            required
            checked={consents.acknowledgeCounsellingDisclaimer}
            onChange={(e) =>
              setConsents((c) => ({ ...c, acknowledgeCounsellingDisclaimer: e.target.checked }))
            }
            className="mt-0.5 h-4 w-4 shrink-0 accent-gold-500"
          />
          <span>
            I understand that pastoral counselling is not a substitute for emergency services,
            licensed medical care, psychological or psychiatric treatment, or legal advice.{' '}
            <Link
              href="/counselling-disclaimer"
              target="_blank"
              className="text-gold-400 underline underline-offset-2"
            >
              Read the disclaimer
            </Link>
            .
          </span>
        </label>
      </fieldset>

      <button
        type="submit"
        disabled={pending || !allConsented}
        className="min-h-[2.75rem] w-full rounded-lg bg-gold-sheen px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:brightness-105 disabled:opacity-50"
      >
        {pending ? 'Creating your account…' : 'Create account'}
      </button>
    </form>
  );
}
