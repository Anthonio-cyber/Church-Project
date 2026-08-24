import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/forms/RegisterForm';
import { getAuthContext } from '@/lib/auth/context';
import { getFlag } from '@/lib/domain/settings';

export const metadata: Metadata = { title: 'Create an account' };
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const context = await getAuthContext();
  if (context) redirect('/app/dashboard');

  // Registration can be closed from the emergency controls. When it is, the
  // page says so honestly rather than presenting a form that will fail.
  const registrationOpen = await getFlag('registration.enabled').catch(() => true);

  return (
    <div className="w-full max-w-xl">
      <div className="mb-8 text-center">
        <h1 className="font-serif text-3xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-parchment-400">
          We ask for as little as the platform genuinely needs.
        </p>
      </div>

      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-7">
        {registrationOpen ? (
          <RegisterForm />
        ) : (
          <div className="py-6 text-center">
            <p aria-hidden className="mb-3 text-3xl">
              🔒
            </p>
            <h2 className="font-serif text-lg font-semibold">Registration is temporarily closed</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-parchment-300">
              New registrations have been paused by the ministry’s administrators. Please try again
              later, or contact the ministry office if you need help now.
            </p>
            <Link
              href="/contact"
              className="mt-5 inline-block text-sm font-medium text-gold-400 underline underline-offset-4"
            >
              Contact the ministry office
            </Link>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-parchment-400">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-gold-400 underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
