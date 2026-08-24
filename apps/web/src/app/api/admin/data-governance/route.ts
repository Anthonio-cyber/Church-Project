import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requirePermission, requireUser } from '@/lib/auth/context';
import { reasonSchema } from '@/lib/validation';
import { writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requirePermission('data_governance.manage', {
    reason: 'Reviewing outstanding data-rights requests.',
  });

  const [requests, retention] = await Promise.all([
    prisma.dataRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, email: true, status: true, profile: { select: { displayName: true } } } },
      },
    }),
    prisma.platformSetting.findMany({ where: { key: { startsWith: 'retention.' } } }),
  ]);

  return ok({ requests, retentionSettings: retention });
});

const schema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'REJECTED']),
  reason: reasonSchema,
  responseUrl: z.string().url().max(600).optional(),
});

export const PATCH = route(async (request: Request) => {
  assertSameOrigin(request);
  const base = await requireUser();
  const input = await parseBody(request, schema);
  const context = await requirePermission('data_governance.manage', {
    context: base,
    reason: input.reason,
    targetType: 'data_request',
    targetId: input.requestId,
  });

  const dataRequest = await prisma.dataRequest.findUnique({ where: { id: input.requestId } });
  if (!dataRequest) throw new ApiError(404, 'not_found', 'That request could not be found.');

  await prisma.dataRequest.update({
    where: { id: input.requestId },
    data: {
      status: input.status,
      handledById: context.user.id,
      handledAt: new Date(),
      responseUrl: input.responseUrl ?? null,
    },
  });

  await notify({
    userId: dataRequest.userId,
    category: 'ADMINISTRATIVE',
    title: 'Your data-rights request has been updated',
    body:
      input.status === 'COMPLETED'
        ? 'Your request has been completed. Open the Privacy Centre for details.'
        : input.status === 'REJECTED'
          ? 'Your request could not be completed in full. Open the Privacy Centre for the reason.'
          : 'Your request is being worked on.',
    link: '/app/privacy',
    isCritical: true,
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: 'DATA_REQUEST_HANDLED',
    targetType: 'data_request',
    targetId: input.requestId,
    reason: input.reason,
    metadata: { status: input.status, kind: dataRequest.kind },
    ipAddress: context.ipAddress,
  });

  return ok({ message: 'Request updated and the member notified.' });
});
