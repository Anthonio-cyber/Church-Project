'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type ControlRow = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  isDefault: boolean;
};

/**
 * Emergency controls.
 *
 * Each action requires a typed CONFIRM and a written reason, and the server
 * requires the sensitive permission with MFA and a fresh re-authentication on
 * top of that. The interface makes the consequence of each control explicit
 * rather than reducing it to a toggle.
 */
export function EmergencyControls({
  controls,
  centers,
  admins,
  recentActivations,
}: {
  controls: ControlRow[];
  centers: { id: string; name: string; isActive: boolean }[];
  admins: { id: string; label: string }[];
  recentActivations: {
    id: string;
    at: string;
    actor: string;
    reason: string | null;
    metadata: Record<string, unknown> | null;
  }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<{
    action: string;
    flagKey?: string;
    enabled?: boolean;
    targetId?: string;
    label: string;
    consequence: string;
  } | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [centerId, setCenterId] = useState('');
  const [adminId, setAdminId] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function execute() {
    if (!pending) return;
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/super-admin/emergency-controls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: pending.action,
        flagKey: pending.flagKey,
        enabled: pending.enabled,
        targetId: pending.targetId,
        confirmation: 'CONFIRM',
        reason,
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({
        tone: 'error',
        text: payload?.error?.message ?? 'That control could not be activated.',
      });
      setBusy(false);
      return;
    }

    setStatus({ tone: 'ok', text: payload.data.message });
    setPending(null);
    setConfirmation('');
    setReason('');
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {status ? (
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            status.tone === 'ok'
              ? 'border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
              : 'border border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          {status.text}
        </p>
      ) : null}

      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">Platform capabilities</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {controls.map((control) => (
            <li
              key={control.key}
              className={`rounded-xl border p-5 ${
                control.isDefault
                  ? 'border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900'
                  : 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-serif text-base font-semibold">{control.label}</h3>
                  <p className="mt-1 text-sm text-ink-600 dark:text-parchment-300">
                    {control.description}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    control.enabled
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                      : 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200'
                  }`}
                >
                  {control.enabled ? 'On' : 'Off'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPending({
                    action: 'set_flag',
                    flagKey: control.key,
                    enabled: !control.enabled,
                    label: `${control.enabled ? 'Switch off' : 'Switch on'} ${control.label}`,
                    consequence: control.enabled
                      ? `Members will no longer be able to use ${control.label.toLowerCase()}. The platform will tell them it is unavailable rather than failing silently.`
                      : `${control.label} will be available to members again.`,
                  });
                  setReason('');
                  setConfirmation('');
                }}
                className={`mt-4 min-h-[2.5rem] w-full rounded-lg px-4 text-sm font-semibold ${
                  control.enabled
                    ? 'border border-red-300 text-red-700 dark:border-red-800 dark:text-red-300'
                    : 'bg-gold-sheen text-ink-950'
                }`}
              >
                {control.enabled ? 'Switch off' : 'Switch on'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">Containment actions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setPending({
                action: 'revoke_all_sessions',
                label: 'Revoke every active session',
                consequence:
                  'Everyone on the platform is signed out immediately, on every device, including counsellors mid-session and members in a waiting room.',
              });
              setReason('');
              setConfirmation('');
            }}
            className="rounded-xl border border-red-300 bg-white p-5 text-left dark:border-red-800 dark:bg-ink-900"
          >
            <h3 className="font-serif text-base font-semibold text-red-800 dark:text-red-300">
              Revoke every session
            </h3>
            <p className="mt-1 text-sm text-ink-600 dark:text-parchment-300">
              Signs everyone out, everywhere, at once.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setPending({
                action: 'require_global_password_reset',
                label: 'Require a global password reset',
                consequence:
                  'Every account must set a new password at next sign-in, and all sessions are revoked. Use this if you believe credentials have been exposed.',
              });
              setReason('');
              setConfirmation('');
            }}
            className="rounded-xl border border-red-300 bg-white p-5 text-left dark:border-red-800 dark:bg-ink-900"
          >
            <h3 className="font-serif text-base font-semibold text-red-800 dark:text-red-300">
              Global password reset
            </h3>
            <p className="mt-1 text-sm text-ink-600 dark:text-parchment-300">
              Forces every member to set a new password.
            </p>
          </button>

          <div className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
            <h3 className="font-serif text-base font-semibold">Disable a ministry centre</h3>
            <label htmlFor="centerSelect" className="sr-only">
              Ministry centre
            </label>
            <select
              id="centerSelect"
              value={centerId}
              onChange={(event) => setCenterId(event.target.value)}
              className="input mt-3"
            >
              <option value="">Choose a centre…</option>
              {centers
                .filter((center) => center.isActive)
                .map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!centerId}
              onClick={() => {
                setPending({
                  action: 'disable_ministry_center',
                  targetId: centerId,
                  label: 'Disable this ministry centre',
                  consequence:
                    'The centre stops appearing publicly and its centre-scoped content becomes unavailable.',
                });
                setReason('');
                setConfirmation('');
              }}
              className="mt-3 min-h-[2.5rem] w-full rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
            >
              Disable centre
            </button>
          </div>

          <div className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
            <h3 className="font-serif text-base font-semibold">
              Disable a compromised administrator
            </h3>
            <label htmlFor="adminSelect" className="sr-only">
              Administrator
            </label>
            <select
              id="adminSelect"
              value={adminId}
              onChange={(event) => setAdminId(event.target.value)}
              className="input mt-3"
            >
              <option value="">Choose an administrator…</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!adminId}
              onClick={() => {
                setPending({
                  action: 'disable_administrator',
                  targetId: adminId,
                  label: 'Disable this administrator account',
                  consequence:
                    'The account is disabled and all its sessions revoked immediately. The hierarchy guard still applies: you cannot disable someone at or above your own authority.',
                });
                setReason('');
                setConfirmation('');
              }}
              className="mt-3 min-h-[2.5rem] w-full rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
            >
              Disable account
            </button>
          </div>
        </div>
      </section>

      {/* Confirmation */}
      {pending ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergencyTitle"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border-2 border-red-500 bg-white p-6 dark:bg-ink-900">
            <h3
              id="emergencyTitle"
              className="font-serif text-xl font-semibold text-red-800 dark:text-red-300"
            >
              {pending.label}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-700 dark:text-parchment-200">
              {pending.consequence}
            </p>

            <div className="mt-5">
              <label htmlFor="emergencyReason" className="label">
                Reason (recorded permanently and sent to senior leadership)
              </label>
              <textarea
                id="emergencyReason"
                rows={3}
                minLength={8}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="input resize-y"
              />
            </div>

            <div className="mt-4">
              <label htmlFor="emergencyConfirm" className="label">
                Type CONFIRM to proceed
              </label>
              <input
                id="emergencyConfirm"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="input font-mono"
                autoComplete="off"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={execute}
                disabled={busy || confirmation !== 'CONFIRM' || reason.trim().length < 8}
                className="min-h-[2.75rem] flex-1 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="min-h-[2.75rem] rounded-lg border border-ink-300 px-5 text-sm dark:border-ink-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">Recent activations</h2>
        {recentActivations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-300 p-6 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
            No emergency control has ever been used on this platform.
          </p>
        ) : (
          <ol className="space-y-3">
            {recentActivations.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-ink-200 bg-white p-4 text-sm dark:border-ink-800 dark:bg-ink-900"
              >
                <p className="font-medium">{entry.actor}</p>
                <p className="text-xs text-ink-500 dark:text-parchment-400">
                  {new Date(entry.at).toLocaleString()}
                </p>
                {entry.reason ? (
                  <p className="mt-1 text-ink-600 dark:text-parchment-300">“{entry.reason}”</p>
                ) : null}
                {entry.metadata ? (
                  <p className="mt-1 font-mono text-xs text-ink-500 dark:text-parchment-400">
                    {JSON.stringify(entry.metadata)}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
