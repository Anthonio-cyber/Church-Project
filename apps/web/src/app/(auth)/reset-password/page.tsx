import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/forms/TokenForms';

export const metadata: Metadata = { title: 'Set a new password' };

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="font-serif text-3xl font-semibold">Set a new password</h1>
      </div>
      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-7">
        <Suspense fallback={<p className="text-center text-sm text-parchment-300">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
