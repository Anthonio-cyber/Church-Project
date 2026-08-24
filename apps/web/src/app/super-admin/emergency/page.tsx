import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { EmergencyControls } from '@/components/app/EmergencyControls';
import { Card } from '@/components/ui';
import { FEATURE_FLAGS, getAllFlags, type FeatureFlagKey } from '@/lib/domain/settings';
import { AUDIT } from '@/lib/audit';

export const metadata: Metadata = { title: 'Emergency Controls' };
export const dynamic = 'force-dynamic';

export default async function EmergencyControlsPage() {
  const context = await requirePagePermission(
    ['emergency_controls.manage'],
    '/super-admin/emergency',
  );

  const [flags, recent, centers, admins] = await Promise.all([
    getAllFlags(),
    prisma.auditLog.findMany({
      where: { action: AUDIT.EMERGENCY_CONTROL },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, createdAt: true, actorEmail: true, reason: true, metadata: true },
    }),
    prisma.ministryCenter.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: {
        roles: { some: { role: { rank: { lt: context.rank, gt: 30 } } } },
        id: { not: context.user.id },
      },
      select: { id: true, email: true, profile: { select: { displayName: true } } },
      take: 100,
    }),
  ]);

  return (
    <>
      <AppPageHeader
        eyebrow="Super Admin Portal"
        title="Emergency controls"
        description="Blunt instruments for containing an incident in minutes, without a deployment."
      />

      <Card className="mb-8 border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/30">
        <h2 className="font-serif text-lg font-semibold text-red-900 dark:text-red-200">
          Before you use any of these
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-red-900 dark:text-red-100">
          <li>
            • Each control takes effect immediately for everyone, and is checked server-side at the
            point of use — not merely hidden in the interface.
          </li>
          <li>
            • Each requires a typed confirmation and a written reason, so none can be triggered by a
            stray click.
          </li>
          <li>
            • Every senior leader is notified by email the moment one is used. An emergency action
            is never silent.
          </li>
          <li>
            • Turning off counselling intake means someone in difficulty cannot ask for help. Weigh
            that against whatever you are containing.
          </li>
        </ul>
      </Card>

      <EmergencyControls
        controls={(Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map((key) => ({
          key,
          label: FEATURE_FLAGS[key].label,
          description: FEATURE_FLAGS[key].description,
          enabled: flags[key],
          isDefault: flags[key] === FEATURE_FLAGS[key].default,
        }))}
        centers={centers}
        admins={admins.map((admin) => ({
          id: admin.id,
          label: `${admin.profile?.displayName ?? 'Administrator'} — ${admin.email}`,
        }))}
        recentActivations={recent.map((entry) => ({
          id: entry.id,
          at: entry.createdAt.toISOString(),
          actor: entry.actorEmail ?? 'Unknown',
          reason: entry.reason,
          metadata: entry.metadata as Record<string, unknown> | null,
        }))}
      />
    </>
  );
}
