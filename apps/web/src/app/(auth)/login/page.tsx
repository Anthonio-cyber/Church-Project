import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/forms/LoginForm';
import { getAuthContext } from '@/lib/auth/context';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const context = await getAuthContext();
  if (context) redirect('/app/dashboard');

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="font-serif text-3xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-parchment-400">
          Sign in to your account to continue.
        </p>
      </div>

      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-7">
        <LoginForm />
      </div>

      <p className="mt-6 text-center text-sm text-parchment-400">
        Don’t have an account?{' '}
        <Link href="/register" className="font-medium text-gold-400 underline underline-offset-4">
          Create one
        </Link>
      </p>

      <p className="mt-8 text-center text-xs leading-relaxed text-parchment-500">
        Counsellors, moderators and administrators are required to use multi-factor
        authentication. If your role requires it and you have not set it up yet, you will be
        prompted after signing in.
      </p>
    </div>
  );
}
