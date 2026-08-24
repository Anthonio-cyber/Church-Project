'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type QueueRequest = {
  id: string;
  categoryLabel: string;
  urgency: string;
  status: string;
  preferredMethod: string;
  preferredGender: string;
  language: string;
  createdAt: string;
  safeguardingFlagged: boolean;
  memberName: string;
  memberIsMinor: boolean;
  assignedCounsellor: { id: string; displayName: string } | null;
  sessionScheduledFor: string | null;
};

export type CounsellorOption = {
  id: string;
  displayName: string;
  gender: string;
  availabilityState: string;
  categories: string[];
  languages: string[];
  acceptsMinors: boolean;
  caseload: number;
  capacity: number;
};

/**
 * Counselling operations.
 *
 * Note what a counselling administrator is given: the shape of the queue, and
 * the ability to move work between counsellors. Not the summary of what a
 * member wishes to discuss, not the conversation, not the notes. Running
 * counselling operations does not require reading counselling.
 */
export function CounsellingOperations({
  requests,
  counsellors,
  canAssign,
}: {
  requests: QueueRequest[];
  counsellors: CounsellorOption[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [counsellorId, setCounsellorId] = useState('');
  const [reason, setReason] = useState('');
  const [suggestions, setSuggestions] = useState<
    { counsellorId: string; displayName: string; score: number; caseload: number }[] | null
  >(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function suggest(requestId: string) {
    setBusy(true);
    const response = await fetch('/api/admin/counselling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setSuggestions(payload?.data?.matches ?? []);
    setBusy(false);
  }

  async function assign(requestId: string, unassign = false) {
    setBusy(true);
    setStatus(null);

    const response = await fetch('/api/admin/counselling', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        counsellorId: unassign ? null : counsellorId,
        reason,
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({
        tone: 'error',
        text: payload?.error?.message ?? 'That assignment could not be made.',
      });
      setBusy(false);
      return;
    }

    setStatus({ tone: 'ok', text: payload.data.message });
    setOpenId(null);
    setReason('');
    setCounsellorId('');
    setSuggestions(null);
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

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 px-6 py-12 text-center dark:border-ink-700">
          <p aria-hidden className="mb-3 font-serif text-3xl text-gold-500">
            ✓
          </p>
          <h2 className="font-serif text-lg font-semibold">Nothing waiting</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-600 dark:text-parchment-300">
            Requests appear here as members submit them.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {requests.map((request) => (
            <li
              key={request.id}
              className={`rounded-xl border bg-white p-5 dark:bg-ink-900 ${
                request.safeguardingFlagged
                  ? 'border-red-300 dark:border-red-800'
                  : 'border-ink-200 dark:border-ink-800'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-900 dark:bg-gold-950/60 dark:text-gold-200">
                      {request.categoryLabel}
                    </span>
                    <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium capitalize text-ink-700 dark:bg-ink-800 dark:text-parchment-200">
                      {request.status.toLowerCase().replace(/_/g, ' ')}
                    </span>
                    {request.urgency === 'URGENT' ? (
                      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-200">
                        Urgent
                      </span>
                    ) : null}
                    {request.safeguardingFlagged ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-900 dark:bg-red-950/70 dark:text-red-200">
                        Safeguarding lead notified
                      </span>
                    ) : null}
                    {request.memberIsMinor ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                        Young person
                      </span>
                    ) : null}
                  </div>

                  <p className="font-medium">{request.memberName}</p>

                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-ink-600 sm:grid-cols-2 dark:text-parchment-300">
                    <div className="flex gap-2">
                      <dt className="font-medium text-ink-800 dark:text-parchment-100">Prefers</dt>
                      <dd>
                        {request.preferredMethod.toLowerCase().replace(/_/g, ' ')}
                        {request.preferredGender !== 'UNSPECIFIED'
                          ? ` · a ${request.preferredGender.toLowerCase()} counsellor`
                          : ''}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium text-ink-800 dark:text-parchment-100">Language</dt>
                      <dd>{request.language}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium text-ink-800 dark:text-parchment-100">Waiting</dt>
                      <dd>
                        {Math.max(
                          0,
                          Math.floor(
                            (Date.now() - new Date(request.createdAt).getTime()) / 86_400_000,
                          ),
                        )}{' '}
                        day(s)
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium text-ink-800 dark:text-parchment-100">
                        Counsellor
                      </dt>
                      <dd>{request.assignedCounsellor?.displayName ?? 'Unassigned'}</dd>
                    </div>
                  </dl>

                  {request.sessionScheduledFor ? (
                    <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
                      Session scheduled for{' '}
                      {new Date(request.sessionScheduledFor).toLocaleString()}
                    </p>
                  ) : null}

                  <p className="mt-3 text-xs italic text-ink-500 dark:text-parchment-400">
                    What this member wishes to discuss is not shown here. Counselling operations do
                    not include reading counselling.
                  </p>
                </div>

                {canAssign && !request.sessionScheduledFor ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(openId === request.id ? null : request.id);
                      setSuggestions(null);
                      setReason('');
                      setCounsellorId(request.assignedCounsellor?.id ?? '');
                    }}
                    className="min-h-[2.75rem] shrink-0 rounded-lg border border-ink-300 px-5 text-sm dark:border-ink-700"
                  >
                    {request.assignedCounsellor ? 'Reassign' : 'Assign'}
                  </button>
                ) : null}
              </div>

              {openId === request.id ? (
                <div className="mt-5 space-y-4 rounded-lg border border-gold-300 bg-gold-50/40 p-4 dark:border-gold-800 dark:bg-gold-950/20">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[16rem] flex-1">
                      <label htmlFor={`counsellor-${request.id}`} className="label">
                        Counsellor
                      </label>
                      <select
                        id={`counsellor-${request.id}`}
                        value={counsellorId}
                        onChange={(event) => setCounsellorId(event.target.value)}
                        className="input"
                      >
                        <option value="">Choose a counsellor…</option>
                        {counsellors
                          .filter(
                            (counsellor) => !request.memberIsMinor || counsellor.acceptsMinors,
                          )
                          .map((counsellor) => (
                            <option key={counsellor.id} value={counsellor.id}>
                              {counsellor.displayName} — {counsellor.caseload}/
                              {counsellor.capacity} ·{' '}
                              {counsellor.availabilityState.toLowerCase()}
                            </option>
                          ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => suggest(request.id)}
                      disabled={busy}
                      className="min-h-[2.75rem] rounded-lg border border-ink-300 px-4 text-sm dark:border-ink-700"
                    >
                      Suggest matches
                    </button>
                  </div>

                  {suggestions ? (
                    suggestions.length === 0 ? (
                      <p className="text-sm text-ink-600 dark:text-parchment-300">
                        No counsellor currently matches this request’s category, language and
                        preferences. It will stay in the queue rather than being matched against
                        the member’s wishes.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {suggestions.map((suggestion) => (
                          <li key={suggestion.counsellorId}>
                            <button
                              type="button"
                              onClick={() => setCounsellorId(suggestion.counsellorId)}
                              className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left text-sm ${
                                counsellorId === suggestion.counsellorId
                                  ? 'border-gold-500 bg-gold-100 dark:bg-gold-950/50'
                                  : 'border-ink-200 dark:border-ink-800'
                              }`}
                            >
                              <span>{suggestion.displayName}</span>
                              <span className="text-xs text-ink-500 dark:text-parchment-400">
                                match score {suggestion.score} · caseload {suggestion.caseload}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}

                  <div>
                    <label htmlFor={`reason-${request.id}`} className="label">
                      Reason (recorded in the audit log, minimum 8 characters)
                    </label>
                    <textarea
                      id={`reason-${request.id}`}
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
                      onClick={() => assign(request.id)}
                      disabled={busy || !counsellorId || reason.trim().length < 8}
                      className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
                    >
                      {busy ? 'Working…' : 'Assign and notify'}
                    </button>
                    {request.assignedCounsellor ? (
                      <button
                        type="button"
                        onClick={() => assign(request.id, true)}
                        disabled={busy || reason.trim().length < 8}
                        className="min-h-[2.75rem] rounded-lg border border-ink-300 px-5 text-sm disabled:opacity-50 dark:border-ink-700"
                      >
                        Return to queue
                      </button>
                    ) : null}
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
      )}
    </div>
  );
}
