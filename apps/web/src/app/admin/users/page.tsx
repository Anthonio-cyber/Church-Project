import type { Metadata } from 'next';
import type { AccountStatus, RoleKey } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { AdminUserTable } from '@/components/app/AdminUserTable';
import { ROLE_RANK } from '@/lib/permissions';

export const metadata: Metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; role?: string }>;
}) {
  const context = await requirePagePermission(['users.view'], '/admin/users');
  const params = await searchParams;
  const query = params.q?.trim();

  const where = {
    ...(params.status
      ? { status: params.status as AccountStatus }
      : { status: { not: 'DELETED' as AccountStatus } }),
    ...(params.role ? { roles: { some: { role: { key: params.role as RoleKey } } } } : {}),
    ...(query
      ? {
          OR: [
            { email: { contains: query, mode: 'insensitive' as const } },
            { profile: { displayName: { contains: query, mode: 'insensitive' as const } } },
            { profile: { lastName: { contains: query, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        email: true,
        status: true,
        statusReason: true,
        createdAt: true,
        lastLoginAt: true,
        mfaEnabled: true,
        isDemoAccount: true,
        emailVerifiedAt: true,
        profile: {
          select: {
            displayName: true,
            firstName: true,
            lastName: true,
            country: true,
            ageBand: true,
          },
        },
        roles: { select: { role: { select: { key: true } } } },
        ministryCenter: { select: { name: true } },
        _count: { select: { sessions: { where: { revokedAt: null } } } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <>
      <AppPageHeader
        eyebrow="Admin Portal"
        title="Users"
        description="Account administration only. Counselling history, message content and prayer content are not reachable from this page."
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="q" className="label">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query ?? ''}
            placeholder="Email, display name or surname"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="status" className="label">
            Status
          </label>
          <select id="status" name="status" defaultValue={params.status ?? ''} className="input">
            <option value="">All (except deleted)</option>
            {['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED', 'DELETION_REQUESTED'].map(
              (value) => (
                <option key={value} value={value}>
                  {value.toLowerCase().replace(/_/g, ' ')}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <label htmlFor="role" className="label">
            Role
          </label>
          <select id="role" name="role" defaultValue={params.role ?? ''} className="input">
            <option value="">All roles</option>
            {Object.keys(ROLE_RANK).map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase().replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950"
        >
          Filter
        </button>
      </form>

      <p className="mb-4 text-sm text-ink-500 dark:text-parchment-400">
        {total} account{total === 1 ? '' : 's'} · showing up to 50
      </p>

      <AdminUserTable
        permissions={{
          canSuspend: context.permissions.has('users.suspend'),
          canForceLogout: context.permissions.has('users.force_logout'),
          canRequireMfa: context.permissions.has('users.require_mfa'),
          canAssignRole: context.permissions.has('users.assign_role'),
          canEdit: context.permissions.has('users.edit'),
        }}
        users={rows.map((row) => {
          const roles = row.roles.map((entry) => entry.role.key);
          const rank = roles.reduce((max, key) => Math.max(max, ROLE_RANK[key] ?? 0), 0);
          return {
            id: row.id,
            email: row.email,
            displayName: row.profile?.displayName ?? '—',
            fullName: row.profile
              ? `${row.profile.firstName} ${row.profile.lastName}`
              : '—',
            country: row.profile?.country ?? null,
            ageBand: row.profile?.ageBand ?? 'UNDECLARED',
            status: row.status,
            statusReason: row.statusReason,
            roles,
            rank,
            // The hierarchy guard, mirrored for the interface. The server
            // enforces the identical rule on every write.
            actionable: rank < context.rank && row.id !== context.user.id,
            mfaEnabled: row.mfaEnabled,
            emailVerified: Boolean(row.emailVerifiedAt),
            activeSessions: row._count.sessions,
            ministryCenter: row.ministryCenter?.name ?? null,
            isDemoAccount: row.isDemoAccount,
            createdAt: row.createdAt.toISOString(),
            lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
          };
        })}
      />
    </>
  );
}
