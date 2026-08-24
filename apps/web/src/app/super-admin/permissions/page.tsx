import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { PermissionMatrix } from '@/components/app/PermissionMatrix';
import { Card } from '@/components/ui';
import { ALL_PERMISSIONS, PERMISSIONS, SENSITIVE_PERMISSIONS } from '@/lib/permissions';

export const metadata: Metadata = { title: 'Permissions' };
export const dynamic = 'force-dynamic';

export default async function PermissionsPage() {
  const context = await requirePagePermission(['permissions.manage'], '/super-admin/permissions');

  const [roles, staff] = await Promise.all([
    prisma.role.findMany({
      orderBy: { rank: 'desc' },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    }),
    prisma.user.findMany({
      where: { roles: { some: { role: { key: { not: 'USER' } } } } },
      select: {
        id: true,
        email: true,
        profile: { select: { displayName: true } },
        roles: { select: { role: { select: { key: true, rank: true } } } },
        permissionOverrides: {
          select: {
            granted: true,
            reason: true,
            expiresAt: true,
            permission: { select: { key: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    }),
  ]);

  return (
    <>
      <AppPageHeader
        eyebrow="Super Admin Portal"
        title="Permissions"
        description="The full catalogue, what each role carries, and per-person grants and denials."
      />

      <Card className="mb-8 border-gold-300 bg-gold-50/40 dark:border-gold-800 dark:bg-gold-950/20">
        <h2 className="font-serif text-base font-semibold">How a permission is resolved</h2>
        <ol className="mt-3 space-y-1.5 text-sm leading-relaxed text-ink-700 dark:text-parchment-200">
          <li>1. The union of everything the person's active roles carry.</li>
          <li>2. Plus any explicit individual grant.</li>
          <li>3. Minus any explicit individual denial — a denial always wins.</li>
        </ol>
        <p className="mt-3 text-sm text-ink-600 dark:text-parchment-300">
          That third step is how least privilege works in practice: a senior office can be given
          without also handing over, say, counselling note access. You can never grant a permission
          you do not hold yourself, and changing someone's permissions revokes their sessions so the
          change takes effect cleanly.
        </p>
      </Card>

      <PermissionMatrix
        viewerPermissions={Array.from(context.permissions)}
        viewerRank={context.rank}
        catalogue={ALL_PERMISSIONS.map((key) => ({
          key,
          description: PERMISSIONS[key],
          sensitive: SENSITIVE_PERMISSIONS.includes(key),
        }))}
        roles={roles.map((role) => ({
          key: role.key,
          name: role.name,
          description: role.description,
          rank: role.rank,
          holders: role._count.users,
          permissions: role.permissions.map((entry) => entry.permission.key),
        }))}
        staff={staff.map((person) => ({
          id: person.id,
          email: person.email,
          displayName: person.profile?.displayName ?? person.email,
          rank: person.roles.reduce((max, entry) => Math.max(max, entry.role.rank), 0),
          roles: person.roles.map((entry) => entry.role.key),
          overrides: person.permissionOverrides.map((override) => ({
            permission: override.permission.key,
            granted: override.granted,
            reason: override.reason,
            expiresAt: override.expiresAt?.toISOString() ?? null,
          })),
        }))}
      />
    </>
  );
}
