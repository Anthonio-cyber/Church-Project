import { prisma } from '@/lib/db';
import { ok, paginationFrom, route } from '@/lib/api';
import { requirePermission } from '@/lib/auth/context';
import { ROLE_RANK } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * Administrative user list.
 *
 * Note the shape of each row: enough to administer an account (status, roles,
 * last sign-in) and nothing more. Counselling history, message counts and
 * prayer content are absent by design — an administrator's job is the account,
 * not the person's pastoral life.
 */
export const GET = route(async (request: Request) => {
  const context = await requirePermission('users.view');
  const { take, skip } = paginationFrom(request, 25, 100);
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim();
  const status = url.searchParams.get('status');
  const role = url.searchParams.get('role');

  const where = {
    status: status ? (status as never) : { not: 'DELETED' as const },
    ...(role ? { roles: { some: { role: { key: role as never } } } } : {}),
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
      take,
      skip,
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
        profile: { select: { displayName: true, firstName: true, lastName: true, country: true, ageBand: true } },
        roles: { select: { role: { select: { key: true, name: true } } } },
        ministryCenter: { select: { name: true } },
        _count: { select: { sessions: { where: { revokedAt: null } } } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return ok({
    total,
    users: rows.map((row) => {
      const roles = row.roles.map((r) => r.role.key);
      const rank = roles.reduce((max, key) => Math.max(max, ROLE_RANK[key] ?? 0), 0);
      return {
        id: row.id,
        email: row.email,
        displayName: row.profile?.displayName ?? '—',
        fullName: row.profile ? `${row.profile.firstName} ${row.profile.lastName}` : '—',
        country: row.profile?.country ?? null,
        ageBand: row.profile?.ageBand ?? 'UNDECLARED',
        status: row.status,
        statusReason: row.statusReason,
        roles,
        rank,
        // The interface uses this to grey out anyone the viewer may not act on;
        // the server enforces the same rule again on every write.
        actionable: rank < context.rank,
        mfaEnabled: row.mfaEnabled,
        emailVerified: Boolean(row.emailVerifiedAt),
        activeSessions: row._count.sessions,
        ministryCenter: row.ministryCenter?.name ?? null,
        isDemoAccount: row.isDemoAccount,
        createdAt: row.createdAt,
        lastLoginAt: row.lastLoginAt,
      };
    }),
  });
});
