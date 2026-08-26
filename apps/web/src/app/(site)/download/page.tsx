import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/site/SiteChrome';
import { InstallAppButton } from '@/components/site/InstallAppButton';
import { Card } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Get the app',
  description:
    'Install iPastor on your phone, tablet or computer. One account, one database, wherever you open it.',
};

const FEATURES = [
  {
    title: 'Nothing to download',
    body: 'There is no file, so there is no “this file may harm your device” warning and no permission to grant. The install happens inside the browser itself, the same way it does for any installable site.',
  },
  {
    title: 'The same account everywhere',
    body: 'Installing does not create a second account or a second copy of anything. The app is the platform — your counselling requests, messages and progress are the same records, whichever device you open.',
  },
  {
    title: 'Its own icon and window',
    body: 'Once installed, iPastor opens from your home screen like any other app, without the browser address bar. Nothing about it announces what it is to someone glancing at your screen.',
  },
  {
    title: 'Nothing kept on the device',
    body: 'Counselling pages, messages and every signed-in screen are never stored offline, because a phone that is shared, lost or handed on must not be able to reproduce a private conversation.',
  },
];

export default function DownloadPage() {
  return (
    <>
      <PageHero
        eyebrow="Get the app"
        title="iPastor on your phone"
        description="Install it straight from this page. No store account, no file to download, no warning to click past, and no cost."
      >
        <InstallAppButton />
      </PageHero>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Card key={feature.title} as="article">
              <h2 className="font-serif text-lg font-semibold text-gold-800 dark:text-gold-300">
                {feature.title}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
                {feature.body}
              </p>
            </Card>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-ink-200 bg-parchment-100 p-6 dark:border-ink-800 dark:bg-ink-900">
          <h2 className="font-serif text-lg font-semibold">Installing by hand</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
            If the button above did not appear, your browser installs from its own menu instead.
          </p>
          <dl className="mt-4 space-y-4 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
            <div>
              <dt className="font-semibold text-ink-900 dark:text-parchment-100">
                Android — Chrome, Edge or Samsung Internet
              </dt>
              <dd className="mt-1">
                Open the <strong>⋮</strong> menu and choose <strong>Install app</strong> or{' '}
                <strong>Add to Home screen</strong>.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-900 dark:text-parchment-100">
                iPhone and iPad — Safari
              </dt>
              <dd className="mt-1">
                Tap <strong>Share</strong>, scroll down, then tap <strong>Add to Home Screen</strong>
                . iPhone only allows this from Safari, and notifications only work once it has been
                added this way.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-900 dark:text-parchment-100">
                Windows, Mac and Linux
              </dt>
              <dd className="mt-1">
                Chrome and Edge show an install icon at the right-hand end of the address bar.
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-8 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
          Not signed up yet?{' '}
          <Link
            href="/register"
            className="font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
          >
            Create an account
          </Link>{' '}
          first — installing gives you the app, not the account.
        </p>
      </section>
    </>
  );
}
