'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Enrolling on, or leaving, a course.
 *
 * Leaving is confirmed in words rather than with a bare "are you sure",
 * because the consequence — progress is not kept — is the part someone needs
 * to know before they click, not after.
 */
export function CourseEnrolment({
  courseSlug,
  enrolled,
  lessonCount,
}: {
  courseSlug: string;
  enrolled: boolean;
  lessonCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: 'POST' | 'DELETE') {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/courses/${courseSlug}/enrol`, { method }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setError(payload?.error?.message ?? 'That could not be completed. Please try again.');
      setBusy(false);
      return;
    }
    setBusy(false);
    router.refresh();
  }

  if (enrolled) {
    return (
      <div>
        {error ? (
          <p role="alert" className="mb-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const confirmed = window.confirm(
              'Leave this course? Your progress through it will not be kept, and enrolling again starts from the first lesson.',
            );
            if (confirmed) void call('DELETE');
          }}
          className="text-sm text-ink-500 underline underline-offset-4 disabled:opacity-50 dark:text-parchment-400"
        >
          {busy ? 'Working…' : 'Leave this course'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gold-300 bg-gold-50 p-6 text-center dark:border-gold-800 dark:bg-gold-950/30">
      <h2 className="font-serif text-lg font-semibold">Enrol to begin</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
        {lessonCount} lesson{lessonCount === 1 ? '' : 's'}. Enrolling keeps your place, so you can
        work through it over weeks rather than in one sitting.
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void call('POST')}
        disabled={busy}
        className="mt-5 min-h-[2.75rem] rounded-lg bg-gold-sheen px-6 text-sm font-semibold text-ink-950 disabled:opacity-50"
      >
        {busy ? 'Enrolling…' : 'Enrol on this course'}
      </button>
    </div>
  );
}
