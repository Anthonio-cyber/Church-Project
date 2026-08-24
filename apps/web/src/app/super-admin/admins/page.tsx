import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { AdminGovernance } from '@/components/app/AdminGovernance';
import { Card } from '@/components/ui';
import { ADMIN_ROLES, ROLE_LABEL, ROLE_RANK } from '@/lib/permissions';

export const metadata: Metadata = { title: 'Administrators' };
export const dynamic = 'force-dynamic';

export default async function AdminsPage() {
  const context = await requirePagePermission(['admins.manage'], '/super-admin/admins');

  const [admins, candidates] = await Promise.all([
    prisma.user.findMany({
      where: { roles: { some: { role: { key: { in: ADMIN_ROLES } } } } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
        isSeedPlaceholder: true,
        profile: { select: { displayName: true, firstName: true, lastName: true } },
        roles: {
          select: {
            assignedAt: true,
            reason: true,
            role: { select: { key: true } },
          },
        },
        permissionOverrides: {
          select: {
            granted: true,
            reason: true,
            expiresAt: true,
            permission: { select: { key: true } },
          },
        },
        hierarchyNode: { select: { title: true, status: true, isSeedPlaceholder: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        roles: { none: { role: { key: { in: ADMIN_ROLES } } } },
      },
      select: { id: true, email: true, profile: { select: { displayName: true } } },
      take: 200,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <>
      <AppPageHeader
        eyebrow="Super Admin Portal"
        title="Administrators"
        description="Appointment, removal and suspension of administrative office."
      />

      <Card className="mb-8 border-gold-300 bg-gold-50/40 dark:border-gold-800 dark:bg-gold-950/20">
        <h2 className="font-serif text-base font-semibold">Three guards run before anything changes</h2>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed text-ink-700 dark:text-parchment-200">
          <li>
            <strong>1. Permission.</strong> You hold admins.manage, with multi-factor
            authentication and a re-authentication within the last ten minutes.
          </li>
          <li>
            <strong>2. Authority.</strong> Self-targeting is refused outright, and so is any
            account of equal or greater rank than yours (currently {context.rank}).
          </li>
          <li>
            <strong>3. Grant.</strong> You cannot assign a role at or above your own rank — which
            is why no administrator can promote themselves or a peer to Super Admin.
          </li>
        </ol>
        <p className="mt-3 text-sm text-ink-600 dark:text-parchment-300">
          Appointing or removing an office revokes that person's sessions, so a stale session cannot
          carry old authority into a new role.
        </p>
      </Card>

      <AdminGovernance
        viewerId={context.user.id}
        viewerRank={context.rank}
        candidates={candidates.map((candidate) => ({
          id: candidate.id,
          label: `${candidate.profile?.displayName ?? 'Member'} — ${candidate.email}`,
        }))}
        admins={admins.map((admin) => {
          const roles = admin.roles.map((entry) => entry.role.key);
          const rank = roles.reduce((max, key) => Math.max(max, ROLE_RANK[key] ?? 0), 0);
          return {
            id: admin.id,
            email: admin.email,
            displayName: admin.profile?.displayName ?? '—',
            fullName: admin.profile
              ? `${admin.profile.firstName} ${admin.profile.lastName}`
              : '—',
            status: admin.status,
            mfaEnabled: admin.mfaEnabled,
            lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
            roles,
            roleLabels: roles.map((role) => ROLE_LABEL[role]),
            rank,
            actionable: rank < context.rank && admin.id !== context.user.id,
            isSeedPlaceholder: admin.isSeedPlaceholder,
            hierarchyTitle: admin.hierarchyNode?.title ?? null,
            hierarchyProvisional: admin.hierarchyNode?.isSeedPlaceholder ?? false,
            assignments: admin.roles.map((entry) => ({
              role: entry.role.key,
              assignedAt: entry.assignedAt.toISOString(),
              reason: entry.reason,
            })),
            overrides: admin.permissionOverrides.map((override) => ({
              permission: override.permission.key,
              granted: override.granted,
              reason: override.reason,
              expiresAt: override.expiresAt?.toISOString() ?? null,
            })),
          };
        })}
      />
    </>
  );
}
