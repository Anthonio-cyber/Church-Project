'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type AdminRow = {
  id: string;
  email: string;
  displayName: string;
  fullName: string;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  roles: string[];
  roleLabels: string[];
  rank: number;
  actionable: boolean;
  isSeedPlaceholder: boolean;
  hierarchyTitle: string | null;
  hierarchyProvisional: boolean;
  assignments: { role: string; assignedAt: string; reason: string | null }[];
  overrides: {
    permission: string;
    granted: boolean;
    reason: string;
    expiresAt: string | null;
  }[];
};

const APPOINTABLE_ROLES = [
  'MODERATOR',
  'CONTENT_ADMIN',
  'EVENT_ADMIN',
  'ANALYTICS_ADMIN',
  'COUNSELLING_ADMIN',
  'SAFEGUARDING_ADMIN',
  'ADMIN',
  'SENIOR_LEADERSHIP_ADMIN',
  'SUPER_ADMIN',
];

/** Appoint, remove or suspend administrative office. */
export function AdminGovernance({
  admins,
  candidates,
  viewerId,
  viewerRank,
}: {
  admins: AdminRow[];
  candidates: { id: string; label: string }[];
  viewerId: string;
  viewerRank: number;
}) {
  const router = useRouter();
  const [appointing, setAppointing] = useState(false);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('ADMIN');
  const [reason, setReason] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [removeRole, setRemoveRole] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(action: string, targetId: string, targetRole: string) {
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/super-admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: targetId, role: targetRole, reason }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({
        tone: 'error',
        text: payload?.error?.message ?? 'That action could not be completed.',
      });
      setBusy(false);
      return;
    }

    setStatus({ tone: 'ok', text: payload.data.message });
    setAppointing(false);
    setOpenId(null);
    setReason('');
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
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

      <button
        type="button"
        onClick={() => {
          setAppointing((open) => !open);
          setReason('');
        }}
        className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950"
      >
        {appointing ? 'Cancel' : 'Appoint an administrator'}
      </button>

      {appointing ? (
        <div className="space-y-5 rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="appointUser" className="label">Member</label>
              <select
                id="appointUser"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                className="input"
              >
                <option value="">Choose a member…</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="appointRole" className="label">Office</label>
              <select
                id="appointRole"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="input"
              >
                {APPOINTABLE_ROLES.map((value) => (
                  <option key={value} value={value}>
                    {value.toLowerCase().replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
                Your rank is {viewerRank}. Roles at or above it will be refused by the server.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="appointReason" className="label">
              Reason (recorded permanently, minimum 8 characters)
            </label>
            <textarea
              id="appointReason"
              rows={2}
              minLength={8}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="input resize-y"
            />
          </div>

          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            Appointing makes multi-factor authentication a standing requirement on this account and
            revokes their current sessions, so the new authority takes effect at their next
            sign-in rather than mid-session.
          </p>

          <button
            type="button"
            onClick={() => act('appoint', userId, role)}
            disabled={busy || !userId || reason.trim().length < 8}
            className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
          >
            {busy ? 'Appointing…' : 'Appoint'}
          </button>
        </div>
      ) : null}

      <ul className="space-y-4">
        {admins.map((admin) => (
          <li
            key={admin.id}
            className={`rounded-xl border bg-white p-5 dark:bg-ink-900 ${
              admin.id === viewerId
                ? 'border-gold-400 dark:border-gold-700'
                : 'border-ink-200 dark:border-ink-800'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {admin.roleLabels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-900 dark:bg-gold-950/60 dark:text-gold-200"
                    >
                      {label}
                    </span>
                  ))}
                  <span className="text-xs text-ink-500 dark:text-parchment-400">
                    rank {admin.rank}
                  </span>
                  {admin.id === viewerId ? (
                    <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                      This is you
                    </span>
                  ) : null}
                  {!admin.mfaEnabled ? (
                    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-200">
                      No multi-factor authentication
                    </span>
                  ) : null}
                  {admin.isSeedPlaceholder || admin.hierarchyProvisional ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
                      Provisional seed record
                    </span>
                  ) : null}
                </div>

                <h3 className="font-serif text-lg font-semibold">{admin.fullName}</h3>
                <p className="text-sm text-ink-600 dark:text-parchment-300">
                  {admin.email}
                  {admin.hierarchyTitle ? ` · ${admin.hierarchyTitle}` : ''}
                </p>
                <p className="mt-1 text-xs text-ink-500 dark:text-parchment-400">
                  Account {admin.status.toLowerCase().replace(/_/g, ' ')} · last signed in{' '}
                  {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString() : 'never'}
                </p>

                {admin.overrides.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-parchment-400">
                      Individual permission overrides
                    </p>
                    <ul className="mt-1 space-y-1">
                      {admin.overrides.map((override) => (
                        <li key={override.permission} className="text-xs">
                          <span
                            className={
                              override.granted
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-700 dark:text-red-400'
                            }
                          >
                            {override.granted ? '+ granted' : '− denied'}
                          </span>{' '}
                          <span className="font-mono">{override.permission}</span>
                          <span className="text-ink-500 dark:text-parchment-400">
                            {' '}
                            — {override.reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-ink-500 dark:text-parchment-400">
                    Appointment history
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {admin.assignments.map((assignment) => (
                      <li key={assignment.role} className="text-xs">
                        <span className="capitalize">
                          {assignment.role.toLowerCase().replace(/_/g, ' ')}
                        </span>{' '}
                        <span className="text-ink-500 dark:text-parchment-400">
                          — {new Date(assignment.assignedAt).toLocaleDateString()}
                          {assignment.reason ? ` · “${assignment.reason}”` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>

              {admin.actionable ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(openId === admin.id ? null : admin.id);
                    setRemoveRole(admin.roles[0] ?? 'ADMIN');
                    setReason('');
                  }}
                  className="min-h-[2.75rem] shrink-0 rounded-lg border border-ink-300 px-5 text-sm dark:border-ink-700"
                >
                  Manage
                </button>
              ) : (
                <span
                  className="shrink-0 text-xs text-ink-400 dark:text-parchment-500"
                  title={
                    admin.id === viewerId
                      ? 'You cannot perform governance actions on your own account.'
                      : 'This administrator holds equal or greater authority than you.'
                  }
                >
                  {admin.id === viewerId ? 'Self-action refused' : 'No authority'}
                </span>
              )}
            </div>

            {openId === admin.id ? (
              <div className="mt-5 space-y-4 rounded-lg border border-red-300 bg-red-50/50 p-4 dark:border-red-800 dark:bg-red-950/20">
                <div>
                  <label htmlFor={`role-${admin.id}`} className="label">
                    Which office?
                  </label>
                  <select
                    id={`role-${admin.id}`}
                    value={removeRole}
                    onChange={(event) => setRemoveRole(event.target.value)}
                    className="input"
                  >
                    {admin.roles.map((value) => (
                      <option key={value} value={value}>
                        {value.toLowerCase().replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={`reason-${admin.id}`} className="label">
                    Reason (recorded permanently, minimum 8 characters)
                  </label>
                  <textarea
                    id={`reason-${admin.id}`}
                    rows={2}
                    minLength={8}
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="input resize-y"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => act('remove', admin.id, removeRole)}
                    disabled={busy || reason.trim().length < 8}
                    className="min-h-[2.75rem] rounded-lg border border-ink-300 px-5 text-sm disabled:opacity-50 dark:border-ink-700"
                  >
                    Remove this office
                  </button>
                  <button
                    type="button"
                    onClick={() => act('suspend_access', admin.id, removeRole)}
                    disabled={busy || reason.trim().length < 8}
                    className="min-h-[2.75rem] rounded-lg bg-red-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Suspend the account
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenId(null)}
                    className="min-h-[2.75rem] rounded-lg px-5 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
