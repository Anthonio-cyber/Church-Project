'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SignOutButton({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    router.push('/login');
    router.refresh();
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        aria-label="Sign out"
        className="rounded-lg p-2 text-parchment-200 hover:text-gold-300 disabled:opacity-60"
      >
        <span aria-hidden className="text-lg">
          ⏻
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={`w-full rounded-lg border border-ink-700 px-3 py-2 text-sm text-parchment-200 transition hover:border-gold-600 hover:text-gold-300 disabled:opacity-60 ${className}`}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
