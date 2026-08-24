'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string;
  fullName: string;
  country: string | null;
  ageBand: string;
  status: string;
  statusReason: string | null;
  roles: string[];
  rank: number;
  /** False when the viewer holds equal or lower authority than this account. */
  actionable: boolean;
  mfaEnabled: boolean;
  emailVerified: boolean;
  activeSessions: number;
  ministryCenter: string | null;
  isDemoAccount: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminUserPermissions = {
  canSuspend: boolean;
  canForceLogout: boolean;
  canRequireMfa: boolean;
  canAssignRole: boolean;
  canEdit: boolean;
};

const ASSIGNABLE_ROLES = [
  'USER',
  'COUNSELLOR',
  'PASTOR',
  'MINISTRY_LEADER',
  'MODERATOR',
  'CONTENT_ADMIN',
  'EVENT_ADMIN',
  'ANALYTICS_ADMIN',
  'COUNSELLING_ADMIN',
  'SAFEGUARDING_ADMIN',
  'ADMIN',
];

/**
 * The administrative member list.
 *
 * Rows the viewer has no authority over are visibly inert. That is a courtesy
 * to the administrator, not a security control — the server refuses the same
 * actions independently, so a crafted request gains nothing.
 */
export function AdminUserTable({
  users,
  permissions,
}: {
  users: AdminUserRow[];
  permissions: AdminUserPermissions;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [action, setAction] = useState('suspend');
  const [role, setRole] = useState('USER');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const availableActions = [
    permissions.canSuspend ? ['suspend', 'Suspend account'] : null,
    permissions.canSuspend ? ['reinstate', 'Reinstate account'] : null,
    permissions.canSuspend ? ['disable', 'Disable account'] : null,
    permissions.canForceLogout ? ['revoke_sessions', 'Sign out of all devices'] : null,
    permissions.canRequireMfa ? ['require_mfa', 'Require multi-factor authentication'] : null,
    permissions.canEdit ? ['require_password_reset', 'Require a password reset'] : null,
    permissions.canAssignRole ? ['assign_role', 'Assign a role'] : null,
    permissions.canAssignRole ? ['remove_role', 'Remove a role'] : null,
  ].filter(Boolean) as [string, string][];

  async function submit(userId: string) {
    setBusy(true);
    setStatus(null);

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        reason,
        ...(action === 'assign_role' || action === 'remove_role' ? { role } : {}),
      }),
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
    setOpenId(null);
    setReason('');
    setBusy(false);
    router.refresh();
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

      <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-parchment-100 text-xs uppercase tracking-wide text-ink-500 dark:bg-ink-900 dark:text-parchment-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Member
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Roles
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Security
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Last seen
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
            {users.map((user) => (
              <tr key={user.id} className="bg-white align-top dark:bg-ink-900">
                <td className="px-4 py-3">
                  <p className="font-medium">{user.displayName}</p>
                  <p className="text-xs text-ink-500 dark:text-parchment-400">{user.email}</p>
                  <p className="text-xs text-ink-400 dark:text-parchment-500">
                    {[user.country, user.ministryCenter].filter(Boolean).join(' · ') || '—'}
                  </p>
                  {user.ageBand === 'MINOR' ? (
                    <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[0.65rem] font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                      Under 18 — protected
                    </span>
                  ) : null}
                  {user.isDemoAccount ? (
                    <span className="mt-1 ml-1 inline-block rounded-full bg-ink-100 px-2 py-0.5 text-[0.65rem] font-medium text-ink-700 dark:bg-ink-800 dark:text-parchment-200">
                      Demo
                    </span>
                  ) : null}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      user.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                        : user.status === 'SUSPENDED' || user.status === 'DISABLED'
                          ? 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200'
                          : 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-parchment-200'
                    }`}
                  >
                    {user.status.toLowerCase().replace(/_/g, ' ')}
                  </span>
                  {user.statusReason ? (
                    <p className="mt-1 max-w-[14rem] text-xs text-ink-500 dark:text-parchment-400">
                      {user.statusReason}
                    </p>
                  ) : null}
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-gold-100 px-2 py-0.5 text-[0.65rem] font-medium text-gold-900 dark:bg-gold-950/60 dark:text-gold-200"
                      >
                        {r.toLowerCase().replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </td>

                <td className="px-4 py-3 text-xs">
                  <p className={user.mfaEnabled ? 'text-emerald-700 dark:text-emerald-400' : ''}>
                    {user.mfaEnabled ? '✓ MFA' : 'No MFA'}
                  </p>
                  <p className={user.emailVerified ? '' : 'text-amber-700 dark:text-amber-400'}>
                    {user.emailVerified ? 'Email verified' : 'Email unverified'}
                  </p>
                  <p className="text-ink-500 dark:text-parchment-400">
                    {user.activeSessions} device{user.activeSessions === 1 ? '' : 's'}
                  </p>
                </td>

                <td className="px-4 py-3 text-xs text-ink-500 dark:text-parchment-400">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                </td>

                <td className="px-4 py-3 text-right">
                  {user.actionable && availableActions.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenId(openId === user.id ? null : user.id);
                        setAction(availableActions[0]![0]);
                        setReason('');
                      }}
                      className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs dark:border-ink-700"
                    >
                      Manage
                    </button>
                  ) : (
                    <span
                      className="text-xs text-ink-400 dark:text-parchment-500"
                      title="This account holds equal or greater authority than you, so you cannot act on it."
                    >
                      No authority
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="bg-white px-4 py-12 text-center text-sm text-ink-500 dark:bg-ink-900 dark:text-parchment-400"
                >
                  No accounts matched your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {openId ? (
        <div className="rounded-xl border border-gold-300 bg-gold-50/40 p-5 dark:border-gold-800 dark:bg-gold-950/20">
          <h3 className="mb-4 font-serif text-base font-semibold">
            Manage {users.find((user) => user.id === openId)?.displayName}
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="adminAction" className="label">
                Action
              </label>
              <select
                id="adminAction"
                value={action}
                onChange={(event) => setAction(event.target.value)}
                className="input"
              >
                {availableActions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {action === 'assign_role' || action === 'remove_role' ? (
              <div>
                <label htmlFor="adminRole" className="label">
                  Role
                </label>
                <select
                  id="adminRole"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="input"
                >
                  {ASSIGNABLE_ROLES.map((value) => (
                    <option key={value} value={value}>
                      {value.toLowerCase().replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
                  You cannot assign a role at or above your own level of authority. The server
                  refuses it regardless of what is selected here.
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <label htmlFor="adminReason" className="label">
              Reason (recorded permanently in the audit log, minimum 8 characters)
            </label>
            <textarea
              id="adminReason"
              rows={2}
              minLength={8}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="input resize-y"
            />
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => submit(openId)}
              disabled={busy || reason.trim().length < 8}
              className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="min-h-[2.75rem] rounded-lg border border-ink-300 px-5 text-sm dark:border-ink-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
