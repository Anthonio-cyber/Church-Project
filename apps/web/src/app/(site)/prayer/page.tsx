import type { Metadata } from 'next';
import { PageHero } from '@/components/site/SiteChrome';
import { ButtonLink, Card } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Prayer',
  description: 'Ask for prayer publicly, privately, or with the ministry team alone.',
};

export default function PrayerPage() {
  return (
    <>
      <PageHero
        eyebrow="Prayer"
        title="Ask, and let the fellowship stand with you"
        description="Prayer requests can be shared with the whole fellowship, kept entirely private, or sent to the ministry team alone. You choose, and you can withdraw a request at any time."
      >
        <ButtonLink href="/register">Create an account to request prayer</ButtonLink>
      </PageHero>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h2 className="mb-6 font-serif text-2xl font-semibold">Three ways to share</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <Card>
            <h3 className="font-serif text-lg font-semibold text-gold-800 dark:text-gold-300">Public</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
              Shared on the prayer wall with other members. You can post anonymously — if you do,
              your name is withheld at the API itself, not merely hidden in the interface.
            </p>
          </Card>
          <Card>
            <h3 className="font-serif text-lg font-semibold text-gold-800 dark:text-gold-300">Private</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
              Visible only to you. A place to write down what you are carrying and return to it,
              without it being seen by anyone else.
            </p>
          </Card>
          <Card>
            <h3 className="font-serif text-lg font-semibold text-gold-800 dark:text-gold-300">
              Ministry team
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
              Sent to pastors, counsellors and ministry leaders who pray over requests — but not
              published to the fellowship at large.
            </p>
          </Card>
        </div>

        <h2 className="mb-6 mt-16 font-serif text-2xl font-semibold">
          What the prayer wall deliberately is not
        </h2>
        <div className="space-y-4 text-base leading-relaxed text-ink-700 dark:text-parchment-200">
          <p>
            There is a count of how many have prayed, because that is genuine encouragement. There
            is no list of who prayed, no comment thread, no reaction bar and no ranking. A request
            for prayer should not become a performance.
          </p>
          <p>
            You can mark a request as answered, and you can remove it entirely. Removing it removes
            it — it does not merely hide it from the wall.
          </p>
        </div>
      </section>
    </>
  );
}
