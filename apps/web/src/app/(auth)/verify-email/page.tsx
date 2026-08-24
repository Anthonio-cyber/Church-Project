import { Suspense } from 'react';
import type { Metadata } from 'next';
import { VerifyEmailForm } from '@/components/forms/TokenForms';

export const metadata: Metadata = { title: 'Confirm your email' };

export default function VerifyEmailPage() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-ink-800 bg-ink-900/60 p-8">
      <Suspense fallback={<p className="text-center text-sm text-parchment-300">Loading…</p>}>
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}
