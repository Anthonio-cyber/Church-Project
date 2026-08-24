import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { PageHero } from '@/components/site/SiteChrome';
import { Card, EmptyState } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Ministry Centers',
  description: 'Find a ministry centre, its leadership, events and contact details.',
};

export const dynamic = 'force-dynamic';

export default async function CentersPage() {
  const centers = await prisma.ministryCenter
    .findMany({
      where: { isActive: true },
      orderBy: [{ country: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { counsellors: true, events: true } },
        hierarchy: {
          where: { status: 'ACTIVE', isSeedPlaceholder: false },
          select: { personName: true, title: true },
          take: 3,
        },
      },
    })
    .catch(() => []);

  type Center = (typeof centers)[number];
  const byCountry = centers.reduce<Record<string, Center[]>>((acc, center) => {
    (acc[center.country] ??= []).push(center);
    return acc;
  }, {});

  return (
    <>
      <PageHero
        eyebrow="Ministry Centers"
        title="Find a centre near you"
        description="Ministry centres hold their own leadership, counsellors, events and resources, while remaining part of one accountable structure."
      />

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        {centers.length === 0 ? (
          <EmptyState
            icon="⛪"
            title="No ministry centres have been published"
            description="Ministry centres appear here once they are created and activated in the administration portal."
          />
        ) : (
          Object.entries(byCountry).map(([country, list]) => (
            <div key={country} className="mb-12">
              <h2 className="mb-5 font-serif text-2xl font-semibold">{country}</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {list.map((center) => (
                  <Card key={center.id} as="article">
                    <h3 className="font-serif text-lg font-semibold">{center.name}</h3>
                    {center.city ? (
                      <p className="mt-1 text-sm text-gold-700 dark:text-gold-400">{center.city}</p>
                    ) : null}
                    {center.description ? (
                      <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
                        {center.description}
                      </p>
                    ) : null}
                    {center.hierarchy.length > 0 ? (
                      <p className="mt-3 text-sm text-ink-600 dark:text-parchment-300">
                        <span className="font-medium">Leadership:</span>{' '}
                        {center.hierarchy.map((node) => `${node.personName} (${node.title})`).join(', ')}
                      </p>
                    ) : null}
                    <dl className="mt-4 space-y-1 text-sm text-ink-600 dark:text-parchment-300">
                      {center.address ? (
                        <div>
                          <dt className="sr-only">Address</dt>
                          <dd>{center.address}</dd>
                        </div>
                      ) : null}
                      {center.contactEmail ? (
                        <div>
                          <dt className="sr-only">Email</dt>
                          <dd>
                            <a
                              href={`mailto:${center.contactEmail}`}
                              className="text-gold-700 underline underline-offset-4 dark:text-gold-400"
                            >
                              {center.contactEmail}
                            </a>
                          </dd>
                        </div>
                      ) : null}
                      {center.contactPhone ? (
                        <div>
                          <dt className="sr-only">Phone</dt>
                          <dd>{center.contactPhone}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <p className="mt-4 text-xs text-ink-500 dark:text-parchment-400">
                      {center._count.counsellors} counsellor
                      {center._count.counsellors === 1 ? '' : 's'} · {center._count.events} event
                      {center._count.events === 1 ? '' : 's'}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
