'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type DataRequestRow = {
  id: string;
  kind: string;
  status: string;
  details: string | null;
  createdAt: string;
  handledAt: string | null;
  member: { displayName: string; email: string; accountStatus: string };
};

/** Review and resolve members' data-rights requests. */
export function DataGovernanceQueue({ requests }: { requests: DataRequestRow[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('IN_PROGRESS');
  const [reason, setReason] = useState('');
  const [responseUrl, setResponseUrl] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(requestId: string) {
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/admin/data-governance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        status: nextStatus,
        reason,
        responseUrl: responseUrl || undefined,
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    setStatus(
      response?.ok
        ? { tone: 'ok', text: payload.data.message }
        : { tone: 'error', text: payload?.error?.message ?? 'That could not be saved.' },
    );
    setOpenId(null);
    setReason('');
    setResponseUrl('');
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

      <ul className="space-y-3">
        {requests.map((request) => (
          <li
            key={request.id}
            className={`rounded-xl border bg-white p-5 dark:bg-ink-900 ${
              request.kind === 'DELETION'
                ? 'border-amber-300 dark:border-amber-800'
                : 'border-ink-200 dark:border-ink-800'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gold-900 dark:bg-gold-950/60 dark:text-gold-200">
                    {request.kind.toLowerCase().replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      request.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                        : request.status === 'REJECTED'
                          ? 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200'
                          : 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-parchment-200'
                    }`}
                  >
                    {request.status.toLowerCase().replace(/_/g, ' ')}
                  </span>
                </div>

                <p className="font-medium">{request.member.displayName}</p>
                <p className="text-xs text-ink-500 dark:text-parchment-400">
                  {request.member.email} · account{' '}
                  {request.member.accountStatus.toLowerCase().replace(/_/g, ' ')}
                </p>

                {request.details ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-ink-700 dark:text-parchment-200">
                    {request.details}
                  </p>
                ) : null}

                <p className="mt-2 text-xs text-ink-500 dark:text-parchment-400">
                  Submitted {new Date(request.createdAt).toLocaleString()}
                  {request.handledAt
                    ? ` · handled ${new Date(request.handledAt).toLocaleString()}`
                    : ''}
                </p>
              </div>

              {request.status !== 'COMPLETED' && request.status !== 'REJECTED' ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(openId === request.id ? null : request.id);
                    setReason('');
                  }}
                  className="min-h-[2.75rem] shrink-0 rounded-lg border border-ink-300 px-5 text-sm dark:border-ink-700"
                >
                  Handle
                </button>
              ) : null}
            </div>

            {openId === request.id ? (
              <div className="mt-5 space-y-4 rounded-lg border border-gold-300 bg-gold-50/40 p-4 dark:border-gold-800 dark:bg-gold-950/20">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`status-${request.id}`} className="label">
                      Outcome
                    </label>
                    <select
                      id={`status-${request.id}`}
                      value={nextStatus}
                      onChange={(event) => setNextStatus(event.target.value)}
                      className="input"
                    >
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="REJECTED">Cannot be completed in full</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`url-${request.id}`} className="label">
                      Response link <span className="font-normal text-ink-500">(optional)</span>
                    </label>
                    <input
                      id={`url-${request.id}`}
                      type="url"
                      value={responseUrl}
                      onChange={(event) => setResponseUrl(event.target.value)}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={`reason-${request.id}`} className="label">
                    Reason (recorded in the audit log, minimum 8 characters)
                  </label>
                  <textarea
                    id={`reason-${request.id}`}
                    rows={3}
                    minLength={8}
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="input resize-y"
                    placeholder="Say specifically what was erased and what was retained, and why."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => submit(request.id)}
                    disabled={busy || reason.trim().length < 8}
                    className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
                  >
                    {busy ? 'Saving…' : 'Save and notify the member'}
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
        ))}
      </ul>
    </div>
  );
}
