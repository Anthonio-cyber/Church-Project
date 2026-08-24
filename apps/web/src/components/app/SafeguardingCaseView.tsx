'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type AccessEntry = {
  id: string;
  actor: string;
  action: string;
  reason: string | null;
  createdAt: string;
};

/**
 * A safeguarding case.
 *
 * The narrative is fetched only when a lead explicitly asks for it and states
 * why. That request decrypts server-side, writes an access record against the
 * case and an audit entry. Nothing is decrypted by simply landing on the page.
 */
export function SafeguardingCaseView({
  caseId,
  reference,
  category,
  riskLevel,
  status,
  involvesMinor,
  createdAt,
  escalatedAt,
  closedAt,
  closureSummary,
  assignedToId,
  subject,
  sourceReport,
  leads,
  accessTrail,
}: {
  caseId: string;
  reference: string;
  category: string;
  riskLevel: string;
  status: string;
  involvesMinor: boolean;
  createdAt: string;
  escalatedAt: string | null;
  closedAt: string | null;
  closureSummary: string | null;
  assignedToId: string | null;
  subject: { displayName: string; accountStatus: string; isMinor: boolean } | null;
  sourceReport: { reference: string; category: string; createdAt: string } | null;
  leads: { id: string; displayName: string }[];
  accessTrail: AccessEntry[];
}) {
  const router = useRouter();
  const [readReason, setReadReason] = useState('');
  const [narrative, setNarrative] = useState<string | null>(null);
  const [action, setAction] = useState('assign');
  const [assignToId, setAssignToId] = useState(assignedToId ?? '');
  const [newRisk, setNewRisk] = useState(riskLevel);
  const [closureNote, setClosureNote] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [status_, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function openNarrative() {
    setBusy(true);
    setStatus(null);

    const response = await fetch(
      `/api/admin/safeguarding/${caseId}?reason=${encodeURIComponent(readReason)}`,
    ).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({
        tone: 'error',
        text: payload?.error?.message ?? 'The case could not be opened.',
      });
      setBusy(false);
      return;
    }

    setNarrative(payload.data.case.narrative);
    setStatus({ tone: 'ok', text: payload.data.notice });
    setBusy(false);
    router.refresh();
  }

  async function submitAction() {
    setBusy(true);
    setStatus(null);

    const response = await fetch(`/api/admin/safeguarding/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        reason: actionReason,
        ...(action === 'assign' ? { assignToId } : {}),
        ...(action === 'set_risk' ? { riskLevel: newRisk } : {}),
        ...(action === 'close' ? { closureSummary: closureNote || undefined } : {}),
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
    setActionReason('');
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {status_ ? (
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            status_.tone === 'ok'
              ? 'border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
              : 'border border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          {status_.text}
        </p>
      ) : null}

      {/* Case metadata */}
      <div className="rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              riskLevel === 'CRITICAL'
                ? 'bg-red-100 text-red-900 dark:bg-red-950/70 dark:text-red-200'
                : 'bg-gold-100 text-gold-900 dark:bg-gold-950/60 dark:text-gold-200'
            }`}
          >
            {riskLevel.toLowerCase()} risk
          </span>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium capitalize text-ink-700 dark:bg-ink-800 dark:text-parchment-200">
            {category.toLowerCase().replace(/_/g, ' ')}
          </span>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium capitalize text-ink-700 dark:bg-ink-800 dark:text-parchment-200">
            {status.toLowerCase().replace(/_/g, ' ')}
          </span>
          {involvesMinor ? (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-900 dark:bg-red-950/70 dark:text-red-200">
              Involves a minor
            </span>
          ) : null}
        </div>

        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="font-medium">Reference</dt>
            <dd className="font-mono">{reference}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Raised</dt>
            <dd>{new Date(createdAt).toLocaleString()}</dd>
          </div>
          {subject ? (
            <>
              <div className="flex gap-2">
                <dt className="font-medium">Subject</dt>
                <dd>{subject.displayName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Account status</dt>
                <dd className="capitalize">{subject.accountStatus.toLowerCase()}</dd>
              </div>
            </>
          ) : null}
          {sourceReport ? (
            <div className="flex gap-2">
              <dt className="font-medium">From report</dt>
              <dd className="font-mono">{sourceReport.reference}</dd>
            </div>
          ) : null}
          {escalatedAt ? (
            <div className="flex gap-2">
              <dt className="font-medium">Escalated</dt>
              <dd>{new Date(escalatedAt).toLocaleString()}</dd>
            </div>
          ) : null}
          {closedAt ? (
            <div className="flex gap-2">
              <dt className="font-medium">Closed</dt>
              <dd>{new Date(closedAt).toLocaleString()}</dd>
            </div>
          ) : null}
        </dl>

        {closureSummary ? (
          <p className="mt-4 rounded-lg border border-ink-200 bg-parchment-100 p-4 text-sm dark:border-ink-800 dark:bg-ink-950">
            <strong>Closure summary:</strong> {closureSummary}
          </p>
        ) : null}
      </div>

      {/* The narrative, behind a stated reason */}
      <div className="rounded-xl border-2 border-red-300 bg-red-50/50 p-6 dark:border-red-800 dark:bg-red-950/20">
        <h2 className="font-serif text-lg font-semibold text-red-900 dark:text-red-200">
          Case narrative
        </h2>

        {narrative === null ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-red-900 dark:text-red-100">
              The narrative is encrypted at rest. Opening it records your name, the time and the
              reason you give below against this case. That record is append-only and cannot be
              removed.
            </p>

            <div className="mt-4">
              <label htmlFor="readReason" className="label text-red-900 dark:text-red-100">
                Why do you need to read this case? (minimum 8 characters)
              </label>
              <textarea
                id="readReason"
                rows={2}
                minLength={8}
                maxLength={500}
                value={readReason}
                onChange={(event) => setReadReason(event.target.value)}
                className="input resize-y"
              />
            </div>

            <button
              type="button"
              onClick={openNarrative}
              disabled={busy || readReason.trim().length < 8}
              className="mt-4 min-h-[2.75rem] rounded-lg bg-red-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Opening…' : 'Open the narrative and record my access'}
            </button>
          </>
        ) : (
          <div className="mt-4 rounded-lg border border-red-300 bg-white p-5 dark:border-red-800 dark:bg-ink-900">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{narrative}</p>
          </div>
        )}
      </div>

      {/* Case management */}
      <div className="rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900">
        <h2 className="mb-4 font-serif text-lg font-semibold">Manage the case</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="caseAction" className="label">
              Action
            </label>
            <select
              id="caseAction"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className="input"
            >
              <option value="assign">Assign to a safeguarding lead</option>
              <option value="set_risk">Change the risk level</option>
              <option value="escalate">Escalate to senior leadership</option>
              <option value="action_taken">Mark as actioned</option>
              <option value="close">Close the case</option>
            </select>
          </div>

          {action === 'assign' ? (
            <div>
              <label htmlFor="assignTo" className="label">
                Lead
              </label>
              <select
                id="assignTo"
                value={assignToId}
                onChange={(event) => setAssignToId(event.target.value)}
                className="input"
              >
                <option value="">Choose a lead…</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.displayName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {action === 'set_risk' ? (
            <div>
              <label htmlFor="newRisk" className="label">
                Risk level
              </label>
              <select
                id="newRisk"
                value={newRisk}
                onChange={(event) => setNewRisk(event.target.value)}
                className="input"
              >
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => (
                  <option key={value} value={value}>
                    {value.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {action === 'close' ? (
          <div className="mt-4">
            <label htmlFor="closureNote" className="label">
              Closure summary
            </label>
            <textarea
              id="closureNote"
              rows={3}
              maxLength={2000}
              value={closureNote}
              onChange={(event) => setClosureNote(event.target.value)}
              className="input resize-y"
            />
          </div>
        ) : null}

        <div className="mt-4">
          <label htmlFor="actionReason" className="label">
            Reason (recorded against the case, minimum 8 characters)
          </label>
          <textarea
            id="actionReason"
            rows={2}
            minLength={8}
            maxLength={500}
            value={actionReason}
            onChange={(event) => setActionReason(event.target.value)}
            className="input resize-y"
          />
        </div>

        <button
          type="button"
          onClick={submitAction}
          disabled={busy || actionReason.trim().length < 8}
          className="mt-4 min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Confirm'}
        </button>
      </div>

      {/* The access trail */}
      <div className="rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900">
        <h2 className="mb-1 font-serif text-lg font-semibold">Access trail</h2>
        <p className="mb-4 text-sm text-ink-500 dark:text-parchment-400">
          Append-only. Rejected by the database on update or delete.
        </p>

        {accessTrail.length === 0 ? (
          <p className="text-sm text-ink-500 dark:text-parchment-400">
            No one has opened this case yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {accessTrail.map((entry) => (
              <li
                key={entry.id}
                className="border-l-2 border-gold-400 pl-4 text-sm"
              >
                <p className="font-medium">
                  {entry.actor}{' '}
                  <span className="font-normal text-ink-500 dark:text-parchment-400">
                    {entry.action.toLowerCase()}
                  </span>
                </p>
                <p className="text-xs text-ink-500 dark:text-parchment-400">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
                {entry.reason ? (
                  <p className="mt-1 text-ink-600 dark:text-parchment-300">“{entry.reason}”</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
