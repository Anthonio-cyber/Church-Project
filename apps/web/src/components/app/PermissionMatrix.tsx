'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export type CataloguePermission = { key: string; description: string; sensitive: boolean };
export type RoleSummary = {
  key: string;
  name: string;
  description: string;
  rank: number;
  holders: number;
  permissions: string[];
};
export type StaffMember = {
  id: string;
  email: string;
  displayName: string;
  rank: number;
  roles: string[];
  overrides: {
    permission: string;
    granted: boolean;
    reason: string;
    expiresAt: string | null;
  }[];
};

/**
 * The permission catalogue and the per-person override editor.
 *
 * The matrix makes the shape of the system legible at a glance: which offices
 * carry what, and — more importantly — what they deliberately do not carry.
 */
export function PermissionMatrix({
  catalogue,
  roles,
  staff,
  viewerPermissions,
  viewerRank,
}: {
  catalogue: CataloguePermission[];
  roles: RoleSummary[];
  staff: StaffMember[];
  viewerPermissions: string[];
  viewerRank: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'matrix' | 'people'>('matrix');
  const [personId, setPersonId] = useState('');
  const [permission, setPermission] = useState(catalogue[0]?.key ?? '');
  const [grant, setGrant] = useState<'grant' | 'deny' | 'clear'>('grant');
  const [reason, setReason] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedPerson = useMemo(
    () => staff.find((person) => person.id === personId) ?? null,
    [staff, personId],
  );

  async function submit() {
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/super-admin/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: personId,
        permission,
        granted: grant === 'clear' ? null : grant === 'grant',
        reason,
        expiresInDays: expiresInDays === '' ? undefined : Number(expiresInDays),
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    setStatus(
      response?.ok
        ? { tone: 'ok', text: payload.data.message }
        : { tone: 'error', text: payload?.error?.message ?? 'That change could not be made.' },
    );
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

      <nav aria-label="Permission views" className="flex gap-2">
        {[
          { value: 'matrix' as const, label: 'Role matrix' },
          { value: 'people' as const, label: 'Individual overrides' },
        ].map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setTab(entry.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === entry.value
                ? 'bg-gold-sheen text-ink-950'
                : 'border border-ink-300 dark:border-ink-700'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === 'matrix' ? (
        <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
          <table className="w-full min-w-[64rem] text-left text-xs">
            <caption className="sr-only">
              Which administrative roles carry which permissions
            </caption>
            <thead className="bg-parchment-100 dark:bg-ink-900">
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-parchment-100 px-3 py-3 font-medium dark:bg-ink-900">
                  Permission
                </th>
                {roles
                  .filter((role) => role.key !== 'USER')
                  .map((role) => (
                    <th
                      key={role.key}
                      scope="col"
                      className="px-2 py-3 text-center font-medium"
                      title={role.description}
                    >
                      <span className="block max-w-[5rem] break-words">
                        {role.name.replace(' Administrator', ' Admin')}
                      </span>
                      <span className="mt-0.5 block text-[0.6rem] font-normal text-ink-500 dark:text-parchment-400">
                        {role.holders} holder{role.holders === 1 ? '' : 's'}
                      </span>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
              {catalogue.map((entry) => (
                <tr key={entry.key} className="bg-white dark:bg-ink-900">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-normal dark:bg-ink-900"
                  >
                    <span className="font-mono">{entry.key}</span>
                    {entry.sensitive ? (
                      <span
                        className="ml-2 rounded-full bg-red-50 px-1.5 py-0.5 text-[0.6rem] font-medium text-red-800 dark:bg-red-950/50 dark:text-red-200"
                        title="Sensitive: requires MFA, fresh re-authentication and a recorded reason."
                      >
                        sensitive
                      </span>
                    ) : null}
                    <span className="mt-0.5 block max-w-[22rem] text-[0.65rem] text-ink-500 dark:text-parchment-400">
                      {entry.description}
                    </span>
                  </th>
                  {roles
                    .filter((role) => role.key !== 'USER')
                    .map((role) => (
                      <td key={role.key} className="px-2 py-2 text-center">
                        {role.permissions.includes(entry.key) ? (
                          <span
                            className="text-emerald-600 dark:text-emerald-400"
                            aria-label={`${role.name} has ${entry.key}`}
                          >
                            ●
                          </span>
                        ) : (
                          <span
                            className="text-ink-200 dark:text-ink-700"
                            aria-label={`${role.name} does not have ${entry.key}`}
                          >
                            ·
                          </span>
                        )}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-5 rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900">
            <h2 className="font-serif text-lg font-semibold">Grant or deny for one person</h2>

            <div>
              <label htmlFor="person" className="label">Person</label>
              <select
                id="person"
                value={personId}
                onChange={(event) => setPersonId(event.target.value)}
                className="input"
              >
                <option value="">Choose someone…</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id} disabled={person.rank >= viewerRank}>
                    {person.displayName} — {person.email}
                    {person.rank >= viewerRank ? ' (no authority)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="permission" className="label">Permission</label>
                <select
                  id="permission"
                  value={permission}
                  onChange={(event) => setPermission(event.target.value)}
                  className="input font-mono text-xs"
                >
                  {catalogue.map((entry) => (
                    <option
                      key={entry.key}
                      value={entry.key}
                      disabled={grant === 'grant' && !viewerPermissions.includes(entry.key)}
                    >
                      {entry.key}
                      {entry.sensitive ? ' (sensitive)' : ''}
                      {!viewerPermissions.includes(entry.key) ? ' — you do not hold this' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="grant" className="label">Effect</label>
                <select
                  id="grant"
                  value={grant}
                  onChange={(event) => setGrant(event.target.value as typeof grant)}
                  className="input"
                >
                  <option value="grant">Grant — add this permission</option>
                  <option value="deny">Deny — remove it even if a role grants it</option>
                  <option value="clear">Clear the override</option>
                </select>
              </div>
            </div>

            {grant !== 'clear' ? (
              <div>
                <label htmlFor="expires" className="label">
                  Expires after <span className="font-normal text-ink-500">(optional)</span>
                </label>
                <select
                  id="expires"
                  value={expiresInDays}
                  onChange={(event) =>
                    setExpiresInDays(event.target.value === '' ? '' : Number(event.target.value))
                  }
                  className="input"
                >
                  <option value="">No expiry</option>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                </select>
                <p className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
                  A temporary grant that expires on its own is safer than one someone has to
                  remember to remove.
                </p>
              </div>
            ) : null}

            <div>
              <label htmlFor="permReason" className="label">
                Reason (recorded permanently, minimum 8 characters)
              </label>
              <textarea
                id="permReason"
                rows={2}
                minLength={8}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="input resize-y"
              />
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={busy || !personId || reason.trim().length < 8}
              className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Apply'}
            </button>
          </div>

          <aside>
            <h2 className="mb-4 font-serif text-lg font-semibold">
              {selectedPerson ? selectedPerson.displayName : 'Existing overrides'}
            </h2>

            {selectedPerson ? (
              <div className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
                <p className="mb-3 text-xs text-ink-500 dark:text-parchment-400">
                  Roles: {selectedPerson.roles.map((r) => r.toLowerCase().replace(/_/g, ' ')).join(', ')}
                </p>
                {selectedPerson.overrides.length === 0 ? (
                  <p className="text-sm text-ink-500 dark:text-parchment-400">
                    No individual overrides — their permissions come entirely from their roles.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {selectedPerson.overrides.map((override) => (
                      <li key={override.permission} className="text-xs">
                        <span
                          className={
                            override.granted
                              ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                              : 'font-semibold text-red-700 dark:text-red-400'
                          }
                        >
                          {override.granted ? '+ granted' : '− denied'}
                        </span>{' '}
                        <span className="font-mono">{override.permission}</span>
                        <p className="text-ink-500 dark:text-parchment-400">
                          {override.reason}
                          {override.expiresAt
                            ? ` · expires ${new Date(override.expiresAt).toLocaleDateString()}`
                            : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <ul className="space-y-3">
                {staff
                  .filter((person) => person.overrides.length > 0)
                  .map((person) => (
                    <li
                      key={person.id}
                      className="rounded-xl border border-ink-200 bg-white p-4 text-sm dark:border-ink-800 dark:bg-ink-900"
                    >
                      <p className="font-medium">{person.displayName}</p>
                      <ul className="mt-1 space-y-0.5">
                        {person.overrides.map((override) => (
                          <li key={override.permission} className="text-xs">
                            <span
                              className={
                                override.granted
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-red-700 dark:text-red-400'
                              }
                            >
                              {override.granted ? '+' : '−'}
                            </span>{' '}
                            <span className="font-mono">{override.permission}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                {staff.every((person) => person.overrides.length === 0) ? (
                  <li className="rounded-xl border border-dashed border-ink-300 p-5 text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
                    No individual overrides in place. Everyone's permissions come from their roles.
                  </li>
                ) : null}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
