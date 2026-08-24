import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ reason: z.string().trim().min(3).max(300) });

/**
 * Declining returns the request to the queue for reassignment rather than
 * closing it. Nobody's request is dropped because one counsellor was
 * unavailable.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const context = await requireUser();
  const { reason } = await parseBody(request, schema);

  const counsellor = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
    select: { id: true, status: true },
  });
  if (!counsellor || counsellor.status !== 'APPROVED') {
    throw new ApiError(403, 'not_approved', 'Only approved counsellors can respond to requests.');
  }

  const counsellingRequest = await prisma.counsellingRequest.findUnique({ where: { id } });
  if (!counsellingRequest) {
    throw new ApiError(404, 'not_found', 'That request could not be found.');
  }

  await prisma.counsellingRequest.update({
    where: { id },
    data: {
      status: 'MATCHING',
      assignedCounsellorId: null,
      assignedAt: null,
      declineReason: reason,
    },
  });

  const admins = await prisma.userRole.findMany({
    where: { role: { key: { in: ['COUNSELLING_ADMIN', 'ADMIN'] } } },
    select: { userId: true },
  });
  for (const admin of new Set(admins.map((a) => a.userId))) {
    await notify({
      userId: admin,
      category: 'COUNSELLING',
      title: 'A counselling request needs reassignment',
      body: 'A counsellor has declined a request and it is back in the queue.',
      link: '/admin/counselling',
    });
  }

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.COUNSELLING_DECLINED,
    targetType: 'counselling_request',
    targetId: id,
    reason,
    ipAddress: context.ipAddress,
  });

  return ok({ message: 'Request returned to the queue for reassignment.' });
});
