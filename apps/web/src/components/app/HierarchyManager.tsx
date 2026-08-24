'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type HierarchyNode = {
  id: string;
  personName: string;
  title: string;
  ministryRole: string;
  administrativeRole: string;
  rank: number;
  status: string;
  isSeedPlaceholder: boolean;
  organisationConfirmedAt: string | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  supervisor: { id: string; personName: string; title: string } | null;
  ministryCenter: { id: string; name: string } | null;
  account: { id: string; email: string; status: string; mfaEnabled: boolean } | null;
  recentChanges: { id: string; changeType: string; reason: string; createdAt: string }[];
};

const ADMINISTRATIVE_ROLES = [
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
  'SENIOR_LEADERSHIP_ADMIN',
  'SUPER_ADMIN',
];

/**
 * Church hierarchy management.
 *
 * The rank guard is applied here for clarity and again on the server for
 * safety: positions at or above the viewer's own rank are shown but cannot be
 * created or altered by them.
 */
export function HierarchyManager({
  nodes,
  centers,
  candidates,
  viewerRank,
}: {
  nodes: HierarchyNode[];
  centers: { id: string; name: string }[];
  candidates: { id: string; label: string }[];
  viewerRank: number;
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [action, setAction] = useState('approve');
  const [supervisorId, setSupervisorId] = useState('');
  const [ministryCenterId, setMinistryCenterId] = useState('');
  const [reason, setReason] = useState('');
  const [form, setForm] = useState({
    userId: '',
    personName: '',
    title: '',
    ministryRole: '',
    administrativeRole: 'MINISTRY_LEADER',
    supervisorId: '',
    ministryCenterId: '',
    notes: '',
  });
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/super-admin/hierarchy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        userId: form.userId || undefined,
        supervisorId: form.supervisorId || undefined,
        ministryCenterId: form.ministryCenterId || undefined,
        notes: form.notes || undefined,
        reason,
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({
        tone: 'error',
        text: payload?.error?.message ?? 'That position could not be created.',
      });
      setBusy(false);
      return;
    }

    setStatus({ tone: 'ok', text: payload.data.message });
    setComposing(false);
    setReason('');
    setBusy(false);
    router.refresh();
  }

  async function update(nodeId: string) {
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/super-admin/hierarchy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId,
        action,
        reason,
        ...(action === 'set_supervisor' ? { supervisorId: supervisorId || null } : {}),
        ...(action === 'set_center' ? { ministryCenterId: ministryCenterId || null } : {}),
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    setStatus(
      response?.ok
        ? { tone: 'ok', text: payload.data.message }
        : { tone: 'error', text: payload?.error?.message ?? 'That change could not be made.' },
    );
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
          setComposing((open) => !open);
          setReason('');
        }}
        className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950"
      >
        {composing ? 'Cancel' : 'Add a leadership position'}
      </button>

      {composing ? (
        <form
          onSubmit={create}
          className="space-y-5 rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="personName" className="label">Person's name</label>
              <input
                id="personName"
                required
                value={form.personName}
                onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="title" className="label">Title</label>
              <input
                id="title"
                required
                placeholder="e.g. Senior Leadership Administrator"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="ministryRole" className="label">Ministry role</label>
              <input
                id="ministryRole"
                required
                placeholder="e.g. Oversight of ministry operations"
                value={form.ministryRole}
                onChange={(e) => setForm((f) => ({ ...f, ministryRole: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="administrativeRole" className="label">Administrative role</label>
              <select
                id="administrativeRole"
                value={form.administrativeRole}
                onChange={(e) => setForm((f) => ({ ...f, administrativeRole: e.target.value }))}
                className="input"
              >
                {ADMINISTRATIVE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.toLowerCase().replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
                You cannot create a position at or above your own authority.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="linkedAccount" className="label">
                Linked account <span className="font-normal text-ink-500">(optional)</span>
              </label>
              <select
                id="linkedAccount"
                value={form.userId}
                onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                className="input"
              >
                <option value="">Not linked yet</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="supervisor" className="label">Reports to</label>
              <select
                id="supervisor"
                value={form.supervisorId}
                onChange={(e) => setForm((f) => ({ ...f, supervisorId: e.target.value }))}
                className="input"
              >
                <option value="">No supervisor</option>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.personName} — {node.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="center" className="label">Ministry centre</label>
              <select
                id="center"
                value={form.ministryCenterId}
                onChange={(e) => setForm((f) => ({ ...f, ministryCenterId: e.target.value }))}
                className="input"
              >
                <option value="">No centre</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="createReason" className="label">
              Reason (recorded permanently, minimum 8 characters)
            </label>
            <textarea
              id="createReason"
              rows={2}
              minLength={8}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input resize-y"
            />
          </div>

          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            New positions are created awaiting approval and confer no access. Roles and permissions
            are granted separately, through the Administrators and Permissions pages.
          </p>

          <button
            type="submit"
            disabled={busy || reason.trim().length < 8}
            className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create position'}
          </button>
        </form>
      ) : null}

      <ul className="space-y-4">
        {nodes.map((node) => {
          const actionable = node.rank < viewerRank;
          return (
            <li
              key={node.id}
              className={`rounded-xl border bg-white p-5 dark:bg-ink-900 ${
                node.isSeedPlaceholder
                  ? 'border-amber-300 dark:border-amber-800'
                  : 'border-ink-200 dark:border-ink-800'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        node.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                          : node.status === 'PENDING_APPROVAL'
                            ? 'bg-gold-100 text-gold-900 dark:bg-gold-950/60 dark:text-gold-200'
                            : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-parchment-300'
                      }`}
                    >
                      {node.status.toLowerCase().replace(/_/g, ' ')}
                    </span>
                    <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium capitalize text-ink-700 dark:bg-ink-800 dark:text-parchment-200">
                      {node.administrativeRole.toLowerCase().replace(/_/g, ' ')} · rank {node.rank}
                    </span>
                    {node.isSeedPlaceholder ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
                        Provisional — not confirmed by the organisation
                      </span>
                    ) : null}
                  </div>

                  <h3 className="font-serif text-lg font-semibold">{node.personName}</h3>
                  <p className="text-sm text-gold-700 dark:text-gold-400">{node.title}</p>
                  <p className="mt-1 text-sm text-ink-600 dark:text-parchment-300">
                    {node.ministryRole}
                  </p>

                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="font-medium">Reports to</dt>
                      <dd className="text-ink-600 dark:text-parchment-300">
                        {node.supervisor
                          ? `${node.supervisor.personName} (${node.supervisor.title})`
                          : '—'}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium">Centre</dt>
                      <dd className="text-ink-600 dark:text-parchment-300">
                        {node.ministryCenter?.name ?? '—'}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium">Account</dt>
                      <dd className="text-ink-600 dark:text-parchment-300">
                        {node.account
                          ? `${node.account.email}${node.account.mfaEnabled ? ' · MFA on' : ' · no MFA'}`
                          : 'Not linked'}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium">Since</dt>
                      <dd className="text-ink-600 dark:text-parchment-300">
                        {new Date(node.startDate).toLocaleDateString()}
                      </dd>
                    </div>
                  </dl>

                  {node.recentChanges.length > 0 ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-ink-500 dark:text-parchment-400">
                        Change history
                      </summary>
                      <ol className="mt-2 space-y-2">
                        {node.recentChanges.map((change) => (
                          <li key={change.id} className="border-l-2 border-gold-400 pl-3 text-xs">
                            <p className="font-medium capitalize">
                              {change.changeType.toLowerCase().replace(/_/g, ' ')}
                            </p>
                            <p className="text-ink-500 dark:text-parchment-400">
                              {new Date(change.createdAt).toLocaleString()}
                            </p>
                            <p className="text-ink-600 dark:text-parchment-300">“{change.reason}”</p>
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : null}
                </div>

                {actionable ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(openId === node.id ? null : node.id);
                      setAction(node.status === 'PENDING_APPROVAL' ? 'approve' : 'suspend');
                      setSupervisorId(node.supervisor?.id ?? '');
                      setMinistryCenterId(node.ministryCenter?.id ?? '');
                      setReason('');
                    }}
                    className="min-h-[2.75rem] shrink-0 rounded-lg border border-ink-300 px-5 text-sm dark:border-ink-700"
                  >
                    Manage
                  </button>
                ) : (
                  <span
                    className="shrink-0 text-xs text-ink-400 dark:text-parchment-500"
                    title="This position holds equal or greater authority than you."
                  >
                    No authority
                  </span>
                )}
              </div>

              {openId === node.id ? (
                <div className="mt-5 space-y-4 rounded-lg border border-gold-300 bg-gold-50/40 p-4 dark:border-gold-800 dark:bg-gold-950/20">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`action-${node.id}`} className="label">Action</label>
                      <select
                        id={`action-${node.id}`}
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        className="input"
                      >
                        <option value="approve">Approve the position</option>
                        <option value="suspend">Suspend</option>
                        <option value="reinstate">Reinstate</option>
                        <option value="remove">Remove</option>
                        <option value="archive">Archive</option>
                        <option value="set_supervisor">Change reporting line</option>
                        <option value="set_center">Change ministry centre</option>
                        <option value="confirm_with_organisation">
                          Confirm with the organisation
                        </option>
                      </select>
                    </div>

                    {action === 'set_supervisor' ? (
                      <div>
                        <label htmlFor={`sup-${node.id}`} className="label">Reports to</label>
                        <select
                          id={`sup-${node.id}`}
                          value={supervisorId}
                          onChange={(e) => setSupervisorId(e.target.value)}
                          className="input"
                        >
                          <option value="">No supervisor</option>
                          {nodes
                            .filter((other) => other.id !== node.id)
                            .map((other) => (
                              <option key={other.id} value={other.id}>
                                {other.personName} — {other.title}
                              </option>
                            ))}
                        </select>
                      </div>
                    ) : null}

                    {action === 'set_center' ? (
                      <div>
                        <label htmlFor={`center-${node.id}`} className="label">Ministry centre</label>
                        <select
                          id={`center-${node.id}`}
                          value={ministryCenterId}
                          onChange={(e) => setMinistryCenterId(e.target.value)}
                          className="input"
                        >
                          <option value="">No centre</option>
                          {centers.map((center) => (
                            <option key={center.id} value={center.id}>
                              {center.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>

                  {action === 'confirm_with_organisation' ? (
                    <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                      Confirm only when the organisation has verified that this named person holds
                      this office. Confirming publishes the record on the public leadership page.
                    </p>
                  ) : null}

                  <div>
                    <label htmlFor={`reason-${node.id}`} className="label">
                      Reason (recorded permanently, minimum 8 characters)
                    </label>
                    <textarea
                      id={`reason-${node.id}`}
                      rows={2}
                      minLength={8}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="input resize-y"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => update(node.id)}
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
            </li>
          );
        })}

        {nodes.length === 0 ? (
          <li className="rounded-xl border border-dashed border-ink-300 px-6 py-12 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
            No leadership positions recorded yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
