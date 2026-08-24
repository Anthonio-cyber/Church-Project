import type { Metadata } from 'next';
import { PageHero } from '@/components/site/SiteChrome';
import { ButtonLink } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Missions',
  description: 'The sending of the church: ministry centres, training and the gospel to the nations.',
};

export default function MissionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Missions"
        title="The gospel to the nations"
        description="Ministry centres across countries, believers trained and sent, and a platform that carries the work rather than getting in its way."
      />
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="space-y-6 text-base leading-relaxed text-ink-700 dark:text-parchment-200">
          <p>
            Missions is not a department of the church; it is what the church is for. This platform
            supports that work practically: ministry centres are first-class records with their own
            leaders, counsellors, events and resources, so a centre in one country can operate with
            real autonomy while remaining part of one accountable structure.
          </p>
          <p>
            Discipleship courses and ministry training are available in multiple languages and can
            be assigned to a specific centre. Events can be physical, online or both, so believers
            who cannot travel are not excluded from teaching and gathering.
          </p>
          <p>
            Counselling matching considers language and ministry centre, so wherever possible a
            person is cared for by someone who understands their context — and where that is not
            possible, the request stays with a counselling administrator rather than being silently
            mismatched.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/centers">Find a ministry centre</ButtonLink>
          <ButtonLink href="/discipleship" variant="secondary">
            Ministry training
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
