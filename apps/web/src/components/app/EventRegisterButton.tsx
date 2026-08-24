'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function EventRegisterButton({
  eventId,
  isRegistered,
  isFull,
}: {
  eventId: string;
  isRegistered: boolean;
  isFull: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setMessage(null);

    const response = await fetch(`/api/events/${eventId}/register`, {
      method: isRegistered ? 'DELETE' : 'POST',
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setMessage(payload?.error?.message ?? 'That did not work. Please try again.');
      setBusy(false);
      return;
    }

    setMessage(payload.data.message);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`min-h-[2.75rem] rounded-lg px-5 text-sm font-semibold disabled:opacity-60 ${
          isRegistered
            ? 'border border-ink-300 text-ink-700 dark:border-ink-700 dark:text-parchment-200'
            : 'bg-gold-sheen text-ink-950'
        }`}
      >
        {busy
          ? 'Please wait…'
          : isRegistered
            ? 'Cancel registration'
            : isFull
              ? 'Join waiting list'
              : 'Register'}
      </button>
      {message ? (
        <p role="status" className="mt-2 max-w-[16rem] text-xs text-ink-600 dark:text-parchment-300">
          {message}
        </p>
      ) : null}
    </div>
  );
}
