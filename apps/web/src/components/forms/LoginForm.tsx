'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * Sign in.
 *
 * The two-step shape matters: when the server answers `mfaRequired`, no session
 * has been created and no cookie set — the password check passed, and nothing
 * more. Only a valid second factor produces a session.
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [stage, setStage] = useState<'credentials' | 'mfa'>('credentials');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(stage === 'mfa' ? { mfaCode } : {}),
          deviceLabel: typeof navigator !== 'undefined' ? navigator.platform : undefined,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? 'Sign-in failed. Please try again.');
        setPending(false);
        return;
      }

      if (payload.data?.mfaRequired) {
        setStage('mfa');
        setPending(false);
        return;
      }

      if (payload.data?.user?.mustChangePassword) {
        router.push('/app/privacy?mustChangePassword=1');
        return;
      }

      router.push('/app/dashboard');
      router.refresh();
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </div>
      ) : null}

      {stage === 'credentials' ? (
        <>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-parchment-200">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-parchment-100 placeholder:text-ink-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-parchment-200">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-gold-400 hover:underline">
                Forgotten?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-parchment-100 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40"
            />
          </div>
        </>
      ) : (
        <div>
          <label htmlFor="mfaCode" className="mb-1.5 block text-sm font-medium text-parchment-200">
            Six-digit authentication code
          </label>
          <input
            id="mfaCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ''))}
            className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-center font-mono text-2xl tracking-[0.4em] text-parchment-100 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40"
          />
          <p className="mt-2 text-xs text-parchment-400">
            Open your authenticator app and enter the current code for this account.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-[2.75rem] w-full rounded-lg bg-gold-sheen px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:brightness-105 disabled:opacity-60"
      >
        {pending ? 'Please wait…' : stage === 'mfa' ? 'Verify and sign in' : 'Sign in'}
      </button>

      {stage === 'mfa' ? (
        <button
          type="button"
          onClick={() => {
            setStage('credentials');
            setMfaCode('');
            setError(null);
          }}
          className="w-full text-center text-sm text-parchment-400 hover:text-gold-300"
        >
          Use a different account
        </button>
      ) : null}
    </form>
  );
}
