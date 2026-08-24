'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type ReportRow = {
  id: string;
  reference: string;
  category: string;
  description: string;
  status: string;
  createdAt: string;
  resolution: string | null;
  reporterName: string;
  reportedUser: {
    id: string;
    displayName: string;
    accountStatus: string;
    priorReportCount: number;
  } | null;
  message: { id: string; body: string | null; withheld: string | null; createdAt: string } | null;
  escalated: boolean;
};

const ACTIONS: [string, string, string][] = [
  ['claim', 'Claim', 'Take this report and mark it under review.'],
  ['resolve', 'Resolve', 'You acted on this report.'],
  ['dismiss', 'Dismiss', 'No action was needed.'],
  ['escalate', 'Escalate to safeguarding', 'This needs a safeguarding lead.'],
];

/**
 * The moderation queue.
 *
 * Every action requires a written reason of at least eight characters. That is
 * not friction for its own sake: the reason is what a member sees when they are
 * told their report was reviewed, and what an administrator reads when
 * reviewing moderation itself.
 */
export function ReportQueue({ reports, canResolve }: { reports: ReportRow[]; canResolve: boolean }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [action, setAction] = useState('claim');
  const [reason, setReason] = useState('');
  const [safeguardingCategory, setSafeguardingCategory] = useState('HARASSMENT');
  const [riskLevel, setRiskLevel] = useState('HIGH');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(reportId: string) {
    setBusy(true);
    setStatus(null);

    const response = await fetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        reason,
        ...(action === 'escalate' ? { safeguardingCategory, riskLevel } : {}),
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({ tone: 'error', text: payload?.error?.message ?? 'That action could not be completed.' });
      setBusy(false);
      return;
    }

    setStatus({ tone: 'ok', text: payload.data.message });
    setActiveId(null);
    setReason('');
    setBusy(false);
    router.refresh();
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-300 px-6 py-12 text-center dark:border-ink-700">
        <p aria-hidden className="mb-3 font-serif text-3xl text-gold-500">
          ✓
        </p>
        <h2 className="font-serif text-lg font-semibold">Nothing in this queue</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-600 dark:text-parchment-300">
          Reports appear here as members submit them.
        </p>
      </div>
    );
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

      <ul className="space-y-4">
        {reports.map((report) => (
          <li
            key={report.id}
            className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-gold-700 dark:text-gold-400">
                {report.reference}
              </span>
              <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium capitalize text-ink-700 dark:bg-ink-800 dark:text-parchment-200">
                {report.category.toLowerCase().replace(/_/g, ' ')}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  report.status === 'ESCALATED'
                    ? 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200'
                    : report.status === 'RESOLVED'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                      : 'bg-gold-100 text-gold-900 dark:bg-gold-950/60 dark:text-gold-200'
                }`}
              >
                {report.status.toLowerCase().replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-ink-500 dark:text-parchment-400">
                {new Date(report.createdAt).toLocaleString()}
              </span>
            </div>

            <p className="text-sm leading-relaxed">{report.description}</p>

            <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="font-medium">Reported by</dt>
                <dd className="text-ink-600 dark:text-parchment-300">{report.reporterName}</dd>
              </div>
              {report.reportedUser ? (
                <>
                  <div className="flex gap-2">
                    <dt className="font-medium">About</dt>
                    <dd className="text-ink-600 dark:text-parchment-300">
                      {report.reportedUser.displayName}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Account status</dt>
                    <dd className="text-ink-600 dark:text-parchment-300">
                      {report.reportedUser.accountStatus.toLowerCase()}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Prior reports</dt>
                    <dd
                      className={
                        report.reportedUser.priorReportCount > 2
                          ? 'font-semibold text-red-700 dark:text-red-400'
                          : 'text-ink-600 dark:text-parchment-300'
                      }
                    >
                      {report.reportedUser.priorReportCount}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>

            {report.message ? (
              <div className="mt-4 rounded-lg border border-ink-200 bg-parchment-100 p-4 dark:border-ink-800 dark:bg-ink-950">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-parchment-400">
                  Reported message
                </p>
                {report.message.withheld ? (
                  <p className="text-sm italic text-amber-800 dark:text-amber-300">
                    {report.message.withheld}
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{report.message.body}</p>
                )}
              </div>
            ) : null}

            {report.resolution ? (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                <strong>Outcome:</strong> {report.resolution}
              </p>
            ) : null}

            {activeId === report.id ? (
              <div className="mt-5 space-y-4 rounded-lg border border-ink-200 p-4 dark:border-ink-800">
                <div>
                  <label htmlFor={`action-${report.id}`} className="label">
                    Action
                  </label>
                  <select
                    id={`action-${report.id}`}
                    value={action}
                    onChange={(event) => setAction(event.target.value)}
                    className="input"
                  >
                    {ACTIONS.filter(
                      ([value]) => canResolve || value === 'claim' || value === 'escalate',
                    ).map(([value, label, hint]) => (
                      <option key={value} value={value}>
                        {label} — {hint}
                      </option>
                    ))}
                  </select>
                </div>

                {action === 'escalate' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`sgcat-${report.id}`} className="label">
                        Safeguarding category
                      </label>
                      <select
                        id={`sgcat-${report.id}`}
                        value={safeguardingCategory}
                        onChange={(event) => setSafeguardingCategory(event.target.value)}
                        className="input"
                      >
                        {[
                          'ABUSE',
                          'THREATS',
                          'EXPLOITATION',
                          'HARASSMENT',
                          'SELF_HARM_CONCERN',
                          'CHILD_SAFETY',
                          'SEXUAL_MISCONDUCT',
                          'FINANCIAL_EXPLOITATION',
                        ].map((value) => (
                          <option key={value} value={value}>
                            {value.toLowerCase().replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`risk-${report.id}`} className="label">
                        Risk level
                      </label>
                      <select
                        id={`risk-${report.id}`}
                        value={riskLevel}
                        onChange={(event) => setRiskLevel(event.target.value)}
                        className="input"
                      >
                        {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => (
                          <option key={value} value={value}>
                            {value.toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                <div>
                  <label htmlFor={`reason-${report.id}`} className="label">
                    Reason (recorded in the audit log, minimum 8 characters)
                  </label>
                  <textarea
                    id={`reason-${report.id}`}
                    rows={3}
                    minLength={8}
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="input resize-y"
                  />
                </div>

                {action === 'escalate' ? (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    Escalating creates a safeguarding case. You will not gain access to that case —
                    it becomes visible only to safeguarding leads and senior leadership.
                  </p>
                ) : null}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => submit(report.id)}
                    disabled={busy || reason.trim().length < 8}
                    className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    className="min-h-[2.75rem] rounded-lg border border-ink-300 px-5 text-sm dark:border-ink-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : report.status !== 'RESOLVED' && report.status !== 'DISMISSED' ? (
              <button
                type="button"
                onClick={() => {
                  setActiveId(report.id);
                  setAction(report.status === 'OPEN' ? 'claim' : 'resolve');
                  setReason('');
                }}
                className="mt-5 min-h-[2.75rem] rounded-lg border border-ink-300 px-5 text-sm dark:border-ink-700"
              >
                Take action
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
