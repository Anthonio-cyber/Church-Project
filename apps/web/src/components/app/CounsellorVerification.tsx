'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type CounsellorRow = {
  id: string;
  displayName: string;
  fullName: string;
  email: string;
  ministryRole: string;
  biography: string;
  categories: string[];
  languages: string[];
  experienceYears: number;
  qualifications: string | null;
  referenceInfo: string | null;
  acceptsMinors: boolean;
  status: string;
  statusReason: string | null;
  verifiedAt: string | null;
  availabilityState: string;
  activeCaseload: number;
  maxConcurrentCases: number;
  ministryCenter: string | null;
  mfaEnabled: boolean;
  policiesAcceptedAt: string | null;
  safeguardingAcknowledgedAt: string | null;
  createdAt: string;
};

/**
 * Counsellor verification.
 *
 * Approving someone here is the moment they may begin receiving people's
 * pastoral confidences. The interface therefore surfaces the things a verifier
 * should actually weigh — safeguarding acknowledgement, policy acceptance,
 * whether they have asked to work with young people — rather than reducing the
 * decision to a single button.
 */
export function CounsellorVerification({
  counsellors,
  canVerify,
  canSuspend,
}: {
  counsellors: CounsellorRow[];
  canVerify: boolean;
  canSuspend: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [action, setAction] = useState('approve');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(counsellorId: string) {
    setBusy(true);
    setStatus(null);

    const response = await fetch(`/api/admin/counsellors/${counsellorId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
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

  if (counsellors.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-300 px-6 py-12 text-center dark:border-ink-700">
        <p aria-hidden className="mb-3 font-serif text-3xl text-gold-500">
          ✚
        </p>
        <h2 className="font-serif text-lg font-semibold">No counsellors in this view</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-600 dark:text-parchment-300">
          Applications appear here as members apply from inside the platform.
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
        {counsellors.map((counsellor) => (
          <li
            key={counsellor.id}
            className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      counsellor.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                        : counsellor.status === 'SUSPENDED' || counsellor.status === 'REJECTED'
                          ? 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200'
                          : 'bg-gold-100 text-gold-900 dark:bg-gold-950/60 dark:text-gold-200'
                    }`}
                  >
                    {counsellor.status.toLowerCase().replace(/_/g, ' ')}
                  </span>
                  {counsellor.acceptsMinors ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                      Requests approval to work with young people
                    </span>
                  ) : null}
                  {!counsellor.mfaEnabled ? (
                    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-200">
                      No multi-factor authentication
                    </span>
                  ) : null}
                </div>

                <h3 className="font-serif text-lg font-semibold">{counsellor.fullName}</h3>
                <p className="text-sm text-gold-700 dark:text-gold-400">
                  {counsellor.ministryRole}
                  {counsellor.ministryCenter ? ` · ${counsellor.ministryCenter}` : ''}
                </p>
                <p className="text-xs text-ink-500 dark:text-parchment-400">
                  {counsellor.email} · appears to members as “{counsellor.displayName}”
                </p>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700 dark:text-parchment-200">
                  {counsellor.biography}
                </p>

                <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="font-medium">Areas</dt>
                    <dd className="text-ink-600 dark:text-parchment-300">
                      {counsellor.categories
                        .map((category) => category.toLowerCase().replace(/_/g, ' '))
                        .join(', ') || '—'}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Languages</dt>
                    <dd className="text-ink-600 dark:text-parchment-300">
                      {counsellor.languages.join(', ') || '—'}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Experience</dt>
                    <dd className="text-ink-600 dark:text-parchment-300">
                      {counsellor.experienceYears} year
                      {counsellor.experienceYears === 1 ? '' : 's'}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Caseload</dt>
                    <dd className="text-ink-600 dark:text-parchment-300">
                      {counsellor.activeCaseload} of {counsellor.maxConcurrentCases}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Policies accepted</dt>
                    <dd
                      className={
                        counsellor.policiesAcceptedAt
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }
                    >
                      {counsellor.policiesAcceptedAt
                        ? new Date(counsellor.policiesAcceptedAt).toLocaleDateString()
                        : 'Not accepted'}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Safeguarding acknowledged</dt>
                    <dd
                      className={
                        counsellor.safeguardingAcknowledgedAt
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }
                    >
                      {counsellor.safeguardingAcknowledgedAt
                        ? new Date(counsellor.safeguardingAcknowledgedAt).toLocaleDateString()
                        : 'Not acknowledged'}
                    </dd>
                  </div>
                </dl>

                {counsellor.qualifications ? (
                  <div className="mt-4 rounded-lg border border-ink-200 bg-parchment-100 p-3 text-sm dark:border-ink-800 dark:bg-ink-950">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-parchment-400">
                      Qualifications and experience
                    </p>
                    <p className="whitespace-pre-wrap">{counsellor.qualifications}</p>
                  </div>
                ) : null}

                {counsellor.referenceInfo ? (
                  <div className="mt-3 rounded-lg border border-ink-200 bg-parchment-100 p-3 text-sm dark:border-ink-800 dark:bg-ink-950">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-parchment-400">
                      References
                    </p>
                    <p className="whitespace-pre-wrap">{counsellor.referenceInfo}</p>
                  </div>
                ) : null}

                {counsellor.statusReason ? (
                  <p className="mt-3 text-sm text-ink-600 dark:text-parchment-300">
                    <strong>Recorded reason:</strong> {counsellor.statusReason}
                  </p>
                ) : null}
              </div>

              {canVerify || canSuspend ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(openId === counsellor.id ? null : counsellor.id);
                    setAction(counsellor.status === 'APPROVED' ? 'suspend' : 'approve');
                    setReason('');
                  }}
                  className="min-h-[2.75rem] shrink-0 rounded-lg border border-ink-300 px-5 text-sm dark:border-ink-700"
                >
                  Decide
                </button>
              ) : null}
            </div>

            {openId === counsellor.id ? (
              <div className="mt-5 space-y-4 rounded-lg border border-gold-300 bg-gold-50/40 p-4 dark:border-gold-800 dark:bg-gold-950/20">
                <div>
                  <label htmlFor={`action-${counsellor.id}`} className="label">
                    Decision
                  </label>
                  <select
                    id={`action-${counsellor.id}`}
                    value={action}
                    onChange={(event) => setAction(event.target.value)}
                    className="input"
                  >
                    {canVerify ? <option value="approve">Approve — may receive requests</option> : null}
                    {canVerify ? <option value="set_under_review">Mark as under review</option> : null}
                    {canVerify ? <option value="reject">Reject the application</option> : null}
                    {canSuspend ? <option value="suspend">Suspend from counselling</option> : null}
                    {canVerify ? <option value="reinstate">Reinstate</option> : null}
                  </select>
                </div>

                {action === 'approve' ? (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    Approving attaches the counsellor role and makes multi-factor authentication a
                    standing requirement on this account. They will begin receiving people's
                    pastoral confidences.
                  </p>
                ) : null}

                {action === 'suspend' ? (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    Suspending returns their open requests to the counselling queue for
                    reassignment rather than cancelling on the members waiting.
                  </p>
                ) : null}

                <div>
                  <label htmlFor={`reason-${counsellor.id}`} className="label">
                    Reason (recorded in the audit log, minimum 8 characters)
                  </label>
                  <textarea
                    id={`reason-${counsellor.id}`}
                    rows={2}
                    minLength={8}
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="input resize-y"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => submit(counsellor.id)}
                    disabled={busy || reason.trim().length < 8}
                    className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'Confirm decision'}
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
