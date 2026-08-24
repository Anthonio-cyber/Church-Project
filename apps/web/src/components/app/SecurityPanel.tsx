'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type DeviceSession = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceLabel: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
};

export type DataRequestEntry = {
  id: string;
  kind: string;
  status: string;
  createdAt: string;
  handledAt: string | null;
};

/** Multi-factor enrolment: secret, then proof, then enabled. */
export function MfaPanel({
  enabled,
  required,
  email,
}: {
  enabled: boolean;
  required: boolean;
  email: string;
}) {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    setStatus(null);
    const response = await fetch('/api/auth/mfa/setup', { method: 'POST' }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok) {
      setStatus({ tone: 'error', text: payload?.error?.message ?? 'Could not start setup.' });
      setBusy(false);
      return;
    }
    setSecret(payload.data.secret);
    setUri(payload.data.otpauthUri);
    setBusy(false);
  }

  async function confirm() {
    setBusy(true);
    setStatus(null);
    const response = await fetch('/api/auth/mfa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({ tone: 'error', text: payload?.error?.message ?? 'That code was not accepted.' });
      setBusy(false);
      return;
    }

    setStatus({ tone: 'ok', text: payload.data.message });
    setSecret(null);
    setUri(null);
    setCode('');
    setBusy(false);
    router.refresh();
  }

  async function disable() {
    setBusy(true);
    setStatus(null);
    const response = await fetch('/api/auth/mfa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    setStatus(
      response?.ok
        ? { tone: 'ok', text: payload.data.message }
        : { tone: 'error', text: payload?.error?.message ?? 'Could not disable.' },
    );
    setPassword('');
    setBusy(false);
    if (response?.ok) router.refresh();
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

      {enabled ? (
        <>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            ✓ Multi-factor authentication is enabled on this account.
          </p>
          {required ? (
            <p className="text-sm text-ink-600 dark:text-parchment-300">
              Your role requires it, so it cannot be switched off. If your role changes, this
              becomes optional again.
            </p>
          ) : (
            <div className="space-y-3">
              <label htmlFor="mfaPassword" className="label">
                Confirm your password to disable it
              </label>
              <input
                id="mfaPassword"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input"
              />
              <button
                type="button"
                onClick={disable}
                disabled={busy || !password}
                className="min-h-[2.75rem] rounded-lg border border-red-300 px-5 text-sm text-red-700 disabled:opacity-60 dark:border-red-800 dark:text-red-300"
              >
                Disable multi-factor authentication
              </button>
            </div>
          )}
        </>
      ) : secret ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-700 dark:text-parchment-200">
            Add this account to your authenticator app, then enter the six-digit code it shows.
          </p>
          <div className="rounded-lg border border-ink-200 bg-parchment-100 p-4 dark:border-ink-800 dark:bg-ink-950">
            <p className="text-xs uppercase tracking-wide text-ink-500 dark:text-parchment-400">
              Account
            </p>
            <p className="font-mono text-sm">{email}</p>
            <p className="mt-3 text-xs uppercase tracking-wide text-ink-500 dark:text-parchment-400">
              Secret key
            </p>
            <p className="break-all font-mono text-sm">{secret}</p>
            {uri ? (
              <p className="mt-3 break-all text-xs text-ink-500 dark:text-parchment-400">{uri}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="mfaCode" className="label">
              Six-digit code
            </label>
            <input
              id="mfaCode"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              className="input text-center font-mono text-xl tracking-[0.35em]"
            />
          </div>

          <button
            type="button"
            onClick={confirm}
            disabled={busy || code.length !== 6}
            className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-60"
          >
            {busy ? 'Verifying…' : 'Enable multi-factor authentication'}
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-600 dark:text-parchment-300">
            {required
              ? 'Your role requires multi-factor authentication. Sensitive actions stay blocked until you set it up.'
              : 'Add a second factor so that your password alone is not enough to reach your account.'}
          </p>
          <button
            type="button"
            onClick={begin}
            disabled={busy}
            className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-60"
          >
            {busy ? 'Preparing…' : 'Set up multi-factor authentication'}
          </button>
        </>
      )}
    </div>
  );
}

/** Every signed-in device, and the ability to end any of them. */
export function DevicePanel({ sessions }: { sessions: DeviceSession[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function revoke(sessionId?: string) {
    setBusy(true);
    const response = await fetch('/api/auth/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionId ? { sessionId } : { all: true }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setStatus(payload?.data?.message ?? 'Done.');
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-200 p-4 dark:border-ink-800"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {session.deviceLabel ?? 'Unknown device'}
                {session.isCurrent ? (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    This device
                  </span>
                ) : null}
              </p>
              <p className="truncate text-xs text-ink-500 dark:text-parchment-400">
                {session.ipAddress ?? 'Unknown address'} · last active{' '}
                {new Date(session.lastSeenAt).toLocaleString()}
              </p>
              {session.userAgent ? (
                <p className="truncate text-xs text-ink-400 dark:text-parchment-500">
                  {session.userAgent}
                </p>
              ) : null}
            </div>
            {!session.isCurrent ? (
              <button
                type="button"
                onClick={() => revoke(session.id)}
                disabled={busy}
                className="rounded-lg border border-ink-300 px-4 py-2 text-sm disabled:opacity-60 dark:border-ink-700"
              >
                Sign out
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {sessions.length > 1 ? (
        <button
          type="button"
          onClick={() => revoke()}
          disabled={busy}
          className="min-h-[2.75rem] rounded-lg border border-red-300 px-5 text-sm text-red-700 disabled:opacity-60 dark:border-red-800 dark:text-red-300"
        >
          Sign out of all other devices
        </button>
      ) : null}

      {status ? (
        <p role="status" className="text-sm text-ink-600 dark:text-parchment-300">
          {status}
        </p>
      ) : null}
    </div>
  );
}

/** Data export and data-rights requests. */
export function DataRightsPanel({ requests }: { requests: DataRequestEntry[] }) {
  const router = useRouter();
  const [kind, setKind] = useState('EXPORT');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    const response = await fetch('/api/privacy/export').catch(() => null);
    if (!response?.ok) {
      setStatus('We could not prepare your export. Please try again.');
      setBusy(false);
      return;
    }
    const payload = await response.json();
    const blob = new Blob([JSON.stringify(payload.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus('Your data has been downloaded.');
    setBusy(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch('/api/privacy/data-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, details: details || undefined }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setStatus(payload?.data?.message ?? payload?.error?.message ?? 'Submitted.');
    setDetails('');
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-serif text-base font-semibold">Download your data</h3>
        <p className="mt-1.5 text-sm text-ink-600 dark:text-parchment-300">
          Your profile, consents, prayer and counselling requests, messages you sent, registrations
          and notifications. The file also names what is <em>not</em> included, and why.
        </p>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="mt-3 min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-60"
        >
          {busy ? 'Preparing…' : 'Download my data'}
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4 border-t border-ink-200 pt-6 dark:border-ink-800">
        <h3 className="font-serif text-base font-semibold">Submit a data-rights request</h3>
        <div>
          <label htmlFor="requestKind" className="label">
            What would you like to request?
          </label>
          <select
            id="requestKind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="input"
          >
            <option value="EXPORT">A fuller copy of my data</option>
            <option value="CORRECTION">Correct information I cannot edit</option>
            <option value="DELETION">Delete my account</option>
            <option value="CONSENT_WITHDRAWAL">Withdraw a consent</option>
            <option value="SUPPORT">Something else</option>
          </select>
        </div>
        <div>
          <label htmlFor="requestDetails" className="label">
            Details <span className="font-normal text-ink-500">(optional)</span>
          </label>
          <textarea
            id="requestDetails"
            rows={3}
            maxLength={2000}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            className="input resize-y"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="min-h-[2.75rem] rounded-lg border border-ink-300 px-5 text-sm disabled:opacity-60 dark:border-ink-700"
        >
          Submit request
        </button>
      </form>

      {requests.length > 0 ? (
        <div className="border-t border-ink-200 pt-6 dark:border-ink-800">
          <h3 className="mb-3 font-serif text-base font-semibold">Your requests</h3>
          <ul className="space-y-2">
            {requests.map((request) => (
              <li
                key={request.id}
                className="flex items-center justify-between rounded-lg border border-ink-200 px-4 py-3 text-sm dark:border-ink-800"
              >
                <span>{request.kind.toLowerCase().replace('_', ' ')}</span>
                <span className="text-ink-500 dark:text-parchment-400">
                  {request.status.toLowerCase().replace('_', ' ')} ·{' '}
                  {new Date(request.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {status ? (
        <p role="status" className="rounded-lg border border-ink-200 px-4 py-3 text-sm dark:border-ink-800">
          {status}
        </p>
      ) : null}
    </div>
  );
}
