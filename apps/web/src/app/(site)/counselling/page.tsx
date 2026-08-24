import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/site/SiteChrome';
import { ButtonLink, Card, SafeguardingNotice } from '@/components/ui';
import { COUNSELLING_DISCLAIMER } from '@/lib/domain/safeguarding';
import { CATEGORY_LABEL } from '@/lib/domain/counselling';

export const metadata: Metadata = {
  title: 'Pastoral Counselling',
  description:
    'How private pastoral counselling works: requesting, matching, the private waiting room, the secure session, and how your information is protected.',
};

const STEPS = [
  {
    step: 'You request counselling',
    body: 'Tell us what you would like to talk about, choose a category, and set your preferences — preferred counsellor gender, language, timing and how you would like to meet.',
  },
  {
    step: 'The request is checked',
    body: 'Requests are reviewed for safeguarding concerns first. If what you describe needs professional or emergency help, we say so immediately and route it to a safeguarding lead.',
  },
  {
    step: 'A counsellor is matched',
    body: 'Matching considers your category, language, preferences, the counsellor’s approved areas of service, ministry centre and current caseload. Only verified counsellors receive requests.',
  },
  {
    step: 'Your session is confirmed',
    body: 'You receive a confirmation and a reminder. The notification never says what your session is about — only that you have a private pastoral session.',
  },
  {
    step: 'The private waiting room',
    body: 'Fifteen minutes before your time, you can enter a waiting room that holds only you. You cannot see anyone else waiting, and nobody can see you.',
  },
  {
    step: 'The secure session',
    body: 'When your counsellor joins, you enter the session. Counselling conversations never mix with ordinary messages, and the session ends when your counsellor closes it.',
  },
  {
    step: 'Follow-up',
    body: 'Your counsellor may write follow-up notes intended for you to read. Their own internal notes are their pastoral record and stay encrypted and private.',
  },
];

export default function CounsellingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pastoral Counselling"
        title="Private counselling with an approved counsellor"
        description="Spiritual guidance, prayer, biblical encouragement and pastoral support — offered by verified counsellors, in a space built to protect what you share."
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/register">Create an account to request counselling</ButtonLink>
          <ButtonLink href="/counselling-disclaimer" variant="secondary">
            Read the counselling disclaimer
          </ButtonLink>
        </div>
      </PageHero>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="mb-12">
          <SafeguardingNotice />
        </div>

        <h2 className="mb-8 font-serif text-2xl font-semibold">How it works</h2>
        <ol className="space-y-6">
          {STEPS.map((step, index) => (
            <li key={step.step} className="flex gap-5">
              <span
                aria-hidden
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-sheen font-serif text-sm font-bold text-ink-950"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="font-serif text-lg font-semibold">{step.step}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mb-6 mt-16 font-serif text-2xl font-semibold">What people bring</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
            <span
              key={key}
              className="rounded-full border border-gold-300 bg-gold-50 px-3.5 py-1.5 text-sm text-gold-900 dark:border-gold-800 dark:bg-gold-950/50 dark:text-gold-200"
            >
              {label}
            </span>
          ))}
        </div>

        <h2 className="mb-6 mt-16 font-serif text-2xl font-semibold">
          Who can see what you share
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Card>
            <h3 className="font-serif text-lg font-semibold text-emerald-800 dark:text-emerald-300">
              Can see your session
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-600 dark:text-parchment-300">
              <li>• You.</li>
              <li>• The counsellor assigned to you.</li>
              <li>
                • A safeguarding lead, only where there is a safeguarding concern, only with a
                written reason, and only with that access recorded against the record.
              </li>
            </ul>
          </Card>
          <Card>
            <h3 className="font-serif text-lg font-semibold text-red-800 dark:text-red-300">
              Cannot see your session
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-600 dark:text-parchment-300">
              <li>• Other members. Ever.</li>
              <li>• Moderators.</li>
              <li>• Counselling administrators, who manage operations, not conversations.</li>
              <li>• Other counsellors.</li>
              <li>• Administrators — including the Super Admin — as a matter of rank alone.</li>
            </ul>
          </Card>
        </div>

        <div className="mt-14 rounded-xl border border-ink-300 bg-parchment-100 p-6 dark:border-ink-700 dark:bg-ink-900">
          <h2 className="font-serif text-lg font-semibold">The counselling disclaimer</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-700 dark:text-parchment-200">
            {COUNSELLING_DISCLAIMER}
          </p>
          <p className="mt-4 text-sm text-ink-600 dark:text-parchment-300">
            You will be asked to acknowledge this before your first request.{' '}
            <Link
              href="/counselling-disclaimer"
              className="font-medium text-gold-700 underline underline-offset-4 dark:text-gold-400"
            >
              Read it in full
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
