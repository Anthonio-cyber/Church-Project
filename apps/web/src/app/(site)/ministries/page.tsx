import type { Metadata } from 'next';
import { PageHero } from '@/components/site/SiteChrome';
import { Card } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Ministries',
  description: 'The ministry areas served by this platform and how believers can take part.',
};

const MINISTRIES = [
  { name: 'Prayer and Intercession', body: 'Corporate prayer, intercession for the nations, and the prayer wall where believers stand with one another.' },
  { name: 'Pastoral Care', body: 'Verified counsellors and pastors offering private counselling across marriage, family, grief, calling and personal struggle.' },
  { name: 'Discipleship and Teaching', body: 'Structured courses that take a believer from foundations through to maturity and ministry readiness.' },
  { name: 'Youth and Young Adults', body: 'Guidance and discipleship for young believers, under safeguarding protections appropriate to their age.' },
  { name: 'Marriage and Family', body: 'Support for couples and households, offered pastorally and alongside professional help where it is needed.' },
  { name: 'Missions', body: 'Equipping and sending believers, and connecting ministry centres across countries.' },
  { name: 'Ministry Training', body: 'Practical preparation for those serving: leadership, character, accountability and service.' },
  { name: 'Fellowship and Community', body: 'Consent-based connection between believers, protected from the pressures of ordinary social platforms.' },
];

export default function MinistriesPage() {
  return (
    <>
      <PageHero
        eyebrow="Ministries"
        title="Ministry areas"
        description="Each ministry area is served by approved leaders and, where counselling is involved, by verified counsellors under supervision."
      />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MINISTRIES.map((ministry) => (
            <Card key={ministry.name} as="article">
              <h2 className="font-serif text-lg font-semibold text-gold-800 dark:text-gold-300">
                {ministry.name}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
                {ministry.body}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
