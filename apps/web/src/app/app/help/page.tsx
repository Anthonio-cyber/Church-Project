import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Badge, Card, SafeguardingNotice } from '@/components/ui';
import { ReportForm } from '@/components/app/ReportForm';

export const metadata: Metadata = { title: 'Help & Support' };
export const dynamic = 'force-dynamic';

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>;
}) {
  const context = await requirePageUser('/app/help');
  const params = await searchParams;

  const [myReports, blocks] = await Promise.all([
    prisma.report.findMany({
      where: { reporterId: context.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, reference: true, category: true, status: true, createdAt: true },
    }),
    prisma.block.findMany({
      where: { blockerId: context.user.id },
      include: { blocked: { select: { profile: { select: { displayName: true } } } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <AppPageHeader
        eyebrow="Help"
        title="Get help"
        description="Report a concern, review what you have reported, and find out where to go for urgent help."
      />

      <SafeguardingNotice />

      <Card className="border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
        <h2 className="font-serif text-lg font-semibold text-red-900 dark:text-red-200">
          If you are in immediate danger
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-red-900 dark:text-red-100">
          This platform cannot intervene physically and is not an emergency service. Contact your
          local emergency services now. If you are thinking of harming yourself or someone else,
          contact a crisis line in your country.
        </p>
        <p className="mt-3 text-sm text-red-900 dark:text-red-100">
          Pastoral care can walk alongside professional help. It cannot replace it, and we will
          never pretend otherwise.
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 font-serif text-xl font-semibold">Report a concern</h2>
        <p className="mb-5 text-sm text-ink-600 dark:text-parchment-300">
          A moderator reviews reports. Serious categories go straight to a safeguarding lead.
        </p>
        <ReportForm reportedUserId={params.report} />
      </Card>

      {myReports.length > 0 ? (
        <Card>
          <h2 className="mb-4 font-serif text-xl font-semibold">Your reports</h2>
          <ul className="space-y-3">
            {myReports.map((report) => (
              <li
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-200 px-4 py-3 dark:border-ink-800"
              >
                <div>
                  <p className="font-mono text-sm font-semibold">{report.reference}</p>
                  <p className="text-xs text-ink-500 dark:text-parchment-400">
                    {report.category.toLowerCase().replace(/_/g, ' ')} ·{' '}
                    {report.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <Badge
                  tone={
                    report.status === 'RESOLVED'
                      ? 'positive'
                      : report.status === 'ESCALATED'
                        ? 'critical'
                        : report.status === 'DISMISSED'
                          ? 'neutral'
                          : 'gold'
                  }
                >
                  {report.status.toLowerCase().replace(/_/g, ' ')}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {blocks.length > 0 ? (
        <Card>
          <h2 className="mb-4 font-serif text-xl font-semibold">Members you have blocked</h2>
          <ul className="space-y-2">
            {blocks.map((block) => (
              <li
                key={block.id}
                className="rounded-lg border border-ink-200 px-4 py-3 text-sm dark:border-ink-800"
              >
                {block.blocked.profile?.displayName ?? 'Member'}
                <span className="ml-2 text-xs text-ink-500 dark:text-parchment-400">
                  blocked {block.createdAt.toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-4 font-serif text-xl font-semibold">Common questions</h2>
        <ul className="space-y-3 text-sm">
          {[
            ['How counselling works', '/counselling'],
            ['Who can see my information', '/privacy'],
            ['Community guidelines', '/community-guidelines'],
            ['Safeguarding policy', '/safeguarding'],
            ['Your data rights', '/data-rights'],
            ['Frequently asked questions', '/faq'],
          ].map(([label, href]) => (
            <li key={href}>
              <Link
                href={href}
                className="font-medium text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
              >
                {label} →
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
