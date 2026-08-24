import { prisma } from '@/lib/db';
import { ok, paginationFrom, route } from '@/lib/api';
import { requirePermission } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

export const GET = route(async (request: Request) => {
  await requirePermission('counsellors.manage');
  const { take, skip } = paginationFrom(request, 25, 100);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  const where = status ? { status: status as never } : {};

  const [rows, total] = await Promise.all([
    prisma.counsellor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            mfaEnabled: true,
            profile: { select: { displayName: true, firstName: true, lastName: true, avatarUrl: true, gender: true } },
          },
        },
        ministryCenter: { select: { name: true } },
        _count: {
          select: {
            sessions: { where: { status: { in: ['CONFIRMED', 'WAITING', 'ACTIVE'] } } },
          },
        },
      },
    }),
    prisma.counsellor.count({ where }),
  ]);

  return ok({
    total,
    counsellors: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      email: row.user.email,
      displayName: row.user.profile?.displayName ?? '—',
      fullName: row.user.profile
        ? `${row.user.profile.firstName} ${row.user.profile.lastName}`
        : '—',
      avatarUrl: row.user.profile?.avatarUrl ?? null,
      ministryRole: row.ministryRole,
      biography: row.biography,
      categories: row.categories,
      languages: row.languages,
      experienceYears: row.experienceYears,
      qualifications: row.qualifications,
      referenceInfo: row.referenceInfo,
      acceptsMinors: row.acceptsMinors,
      sessionTypes: row.sessionTypes,
      status: row.status,
      statusReason: row.statusReason,
      verifiedAt: row.verifiedAt,
      availabilityState: row.availabilityState,
      activeCaseload: row._count.sessions,
      maxConcurrentCases: row.maxConcurrentCases,
      ministryCenter: row.ministryCenter?.name ?? null,
      mfaEnabled: row.user.mfaEnabled,
      policiesAcceptedAt: row.policiesAcceptedAt,
      safeguardingAcknowledgedAt: row.safeguardingAcknowledgedAt,
      createdAt: row.createdAt,
    })),
  });
});
