import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/forms/TokenForms';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="font-serif text-3xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm text-parchment-400">
          Enter your email address and we will send you a link.
        </p>
      </div>
      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-7">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
