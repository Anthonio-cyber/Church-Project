import type { Metadata } from 'next';
import { PageHero } from '@/components/site/SiteChrome';
import { ButtonLink } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

/** Shown by the service worker when a public page is requested with no network. */
export default function OfflinePage() {
  return (
    <>
      <PageHero
        eyebrow="Offline"
        title="You appear to be offline"
        description="Some pages you have already visited are available. Anything private — counselling, messages, your dashboard — needs a connection, and deliberately is not stored on this device."
      />
      <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900">
          <h2 className="font-serif text-lg font-semibold">If you need help now</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-700 dark:text-parchment-200">
            This platform is not an emergency service and cannot reach you while you are offline. If
            you are in immediate danger, or thinking of harming yourself or someone else, contact
            your local emergency services or a crisis line in your country now.
          </p>
        </div>
        <div className="mt-6">
          <ButtonLink href="/">Try again</ButtonLink>
        </div>
      </section>
    </>
  );
}
