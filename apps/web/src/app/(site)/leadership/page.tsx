import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { PageHero } from '@/components/site/SiteChrome';
import { Badge, Card, EmptyState } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Church Leadership',
  description:
    'The leadership and administrative structure that governs this platform, and the accountability that comes with it.',
};

export const dynamic = 'force-dynamic';

export default async function LeadershipPage() {
  // Only positions that are ACTIVE and confirmed by the organisation appear
  // publicly. A seeded placeholder is never published as though it were a
  // statement that a named person holds an office.
  const nodes = await prisma.churchHierarchyNode
    .findMany({
      where: { status: 'ACTIVE', isSeedPlaceholder: false },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        personName: true,
        title: true,
        ministryRole: true,
        administrativeRole: true,
        supervisorId: true,
        ministryCenter: { select: { name: true, country: true } },
      },
    })
    .catch(() => []);

  const pendingConfirmation = await prisma.churchHierarchyNode
    .count({ where: { isSeedPlaceholder: true } })
    .catch(() => 0);

  return (
    <>
      <PageHero
        eyebrow="Church Leadership"
        title="Leadership, administration and accountability"
        description="Administrative authority on this platform follows the church's recognised leadership structure. Administrators are not equal, and none of them operate without a record."
      />

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="mb-12 space-y-5 text-base leading-relaxed text-ink-700 dark:text-parchment-200">
          <p>
            Every administrative role here carries a defined rank, a defined set of permissions, and
            a supervising office. Authority flows down that structure and never sideways or upwards:
            an administrator cannot act on a peer, cannot act on anyone senior to them, and cannot
            grant themselves — or anyone else — an authority they do not already hold.
          </p>
          <p>
            Holding senior office does not mean seeing everything. Access to private counselling
            records, internal counsellor notes and safeguarding cases is separate from
            administrative seniority, requires a stated operational or safeguarding reason, and is
            recorded against the record that was opened.
          </p>
        </div>

        <h2 className="mb-6 font-serif text-2xl font-semibold">Current leadership</h2>

        {nodes.length === 0 ? (
          <EmptyState
            icon="⚖"
            title="No leadership records have been published"
            description="Leadership positions appear here once they have been approved in the Super Admin portal and confirmed with the organisation. Provisional or placeholder records are deliberately never shown on the public site."
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {nodes.map((node) => (
              <Card key={node.id} as="li">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-lg font-semibold">{node.personName}</h3>
                    <p className="mt-1 text-sm text-gold-700 dark:text-gold-400">{node.title}</p>
                  </div>
                  <Badge tone="gold">{ROLE_LABEL[node.administrativeRole]}</Badge>
                </div>
                <p className="mt-3 text-sm text-ink-600 dark:text-parchment-300">
                  {node.ministryRole}
                </p>
                {node.ministryCenter ? (
                  <p className="mt-2 text-xs text-ink-500 dark:text-parchment-400">
                    {node.ministryCenter.name}
                    {node.ministryCenter.country ? ` · ${node.ministryCenter.country}` : ''}
                  </p>
                ) : null}
              </Card>
            ))}
          </ul>
        )}

        {pendingConfirmation > 0 ? (
          <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <strong className="font-semibold">
              {pendingConfirmation} leadership record{pendingConfirmation === 1 ? '' : 's'} awaiting
              organisational confirmation.
            </strong>{' '}
            Provisional records exist in the administration portal but are not published here. No
            person is publicly named as holding an office until the organisation has confirmed it.
          </div>
        ) : null}

        <h2 className="mb-6 mt-16 font-serif text-2xl font-semibold">How authority is structured</h2>
        <div className="rounded-xl border border-ink-200 bg-parchment-100 p-6 dark:border-ink-800 dark:bg-ink-900">
          <ol className="space-y-4 text-sm leading-relaxed text-ink-700 dark:text-parchment-200">
            <li>
              <strong className="text-gold-800 dark:text-gold-300">Super Admin (Setman)</strong> —
              highest platform authority: hierarchy, appointments, permissions, emergency controls
              and data governance. Subject in full to audit logging, multi-factor authentication and
              re-authentication, and unable to erase the audit log.
            </li>
            <li>
              <strong className="text-gold-800 dark:text-gold-300">
                Senior Leadership Administrator
              </strong>{' '}
              — oversight of ministry operations, counsellor operations, content, events and
              administrative activity, as assigned by the Setman.
            </li>
            <li>
              <strong className="text-gold-800 dark:text-gold-300">Administrator</strong> — day-to-day
              operations: members, counsellors, counselling operations, resources, courses, events and
              announcements, as assigned by senior leadership.
            </li>
            <li>
              <strong className="text-gold-800 dark:text-gold-300">
                Moderators, counsellors, ministry leaders and specialist administrators
              </strong>{' '}
              — narrowly scoped roles. A moderator has no access to counselling content. A counselling
              administrator runs operations without reading conversations. A safeguarding lead handles
              sensitive cases under approved policy, with every access recorded.
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
