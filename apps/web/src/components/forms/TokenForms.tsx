'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const field =
  'w-full rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-parchment-100 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40';
const button =
  'min-h-[2.75rem] w-full rounded-lg bg-gold-sheen px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:brightness-105 disabled:opacity-60';

/** Confirms an email address from the link in the verification message. */
export function VerifyEmailForm() {
  const params = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This link is missing its confirmation code. Please use the link from your email.');
      return;
    }

    let cancelled = false;
    setState('working');

    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (cancelled) return;
        if (response.ok) {
          setState('done');
          setMessage(payload.data.message);
        } else {
          setState('error');
          setMessage(payload?.error?.message ?? 'This link could not be confirmed.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState('error');
          setMessage('We could not reach the server. Please try again.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="space-y-4 text-center">
      {state === 'working' ? (
        <p role="status" className="text-sm text-parchment-300">
          Confirming your email address…
        </p>
      ) : null}
      {state === 'done' ? (
        <>
          <p aria-hidden className="text-4xl">
            ✓
          </p>
          <h2 className="font-serif text-xl font-semibold">Email confirmed</h2>
          <p className="text-sm text-parchment-300">{message}</p>
          <Link href="/login" className="inline-block text-sm text-gold-400 underline underline-offset-4">
            Sign in
          </Link>
        </>
      ) : null}
      {state === 'error' ? (
        <>
          <p aria-hidden className="text-4xl">
            ✕
          </p>
          <h2 className="font-serif text-xl font-semibold">We could not confirm that link</h2>
          <p className="text-sm text-parchment-300">{message}</p>
          <Link href="/login" className="inline-block text-sm text-gold-400 underline underline-offset-4">
            Back to sign in
          </Link>
        </>
      ) : null}
    </div>
  );
}

/** Requests a password reset. The response never reveals whether the address exists. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const response = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setMessage(
      payload?.data?.message ??
        'If an account exists for that address, a reset link has been sent.',
    );
    setPending(false);
  }

  if (message) {
    return (
      <div className="space-y-4 text-center">
        <p aria-hidden className="text-4xl">
          ✉️
        </p>
        <p className="text-sm leading-relaxed text-parchment-300">{message}</p>
        <Link href="/login" className="inline-block text-sm text-gold-400 underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-parchment-200">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={field}
        />
      </div>
      <button type="submit" disabled={pending} className={button}>
        {pending ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}

/** Sets a new password from a reset link, then revokes every other session. */
export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setProblems([]);

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setPending(true);
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setError(payload?.error?.message ?? 'We could not reset your password.');
      if (payload?.error?.detail?.problems) setProblems(payload.error.detail.problems);
      setPending(false);
      return;
    }

    router.push('/login?reset=1');
  }

  if (!token) {
    return (
      <p className="text-center text-sm text-parchment-300">
        This link is missing its reset code. Please use the link from your email, or{' '}
        <Link href="/forgot-password" className="text-gold-400 underline underline-offset-4">
          request a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
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

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-parchment-200">
          New password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={field}
        />
      </div>

      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-parchment-200">
          Confirm new password
        </label>
        <input
          id="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className={field}
        />
      </div>

      <p className="text-xs leading-relaxed text-parchment-400">
        Changing your password signs you out of every device, including any that should not be
        signed in.
      </p>

      <button type="submit" disabled={pending} className={button}>
        {pending ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}
