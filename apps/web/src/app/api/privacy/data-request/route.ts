import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertSameOrigin, created, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { notify } from '@/lib/notifications';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const schema = z.object({
  kind: z.enum(['EXPORT', 'CORRECTION', 'DELETION', 'CONSENT_WITHDRAWAL', 'SUPPORT']),
  details: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const GET = route(async () => {
  const context = await requireUser();
  const requests = await prisma.dataRequest.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, kind: true, status: true, details: true, createdAt: true, handledAt: true },
  });
  return ok({ requests });
});

/**
 * Data-rights requests.
 *
 * A deletion request marks the account rather than destroying it immediately:
 * safeguarding records and audit history may have to be retained under the
 * organisation's legal obligations, and that decision belongs to a data
 * governance administrator, not to an automatic job.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const input = await parseBody(request, schema);

  const dataRequest = await prisma.dataRequest.create({
    data: {
      userId: context.user.id,
      kind: input.kind,
      details: input.details || null,
      status: 'RECEIVED',
    },
  });

  if (input.kind === 'DELETION') {
    await prisma.user.update({
      where: { id: context.user.id },
      data: { status: 'DELETION_REQUESTED' },
    });
  }

  const governors = await prisma.userRole.findMany({
    where: { role: { key: { in: ['SUPER_ADMIN', 'SENIOR_LEADERSHIP_ADMIN'] } } },
    select: { userId: true },
  });
  for (const governor of new Set(governors.map((g) => g.userId))) {
    await notify({
      userId: governor,
      category: 'ADMINISTRATIVE',
      title: 'A data-rights request has been submitted',
      body: `A ${input.kind.toLowerCase().replace('_', ' ')} request is awaiting review.`,
      link: '/admin/data-governance',
    });
  }

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    action: 'DATA_REQUEST_SUBMITTED',
    targetType: 'data_request',
    targetId: dataRequest.id,
    metadata: { kind: input.kind },
    ipAddress: context.ipAddress,
  });

  return created({
    request: { id: dataRequest.id, kind: dataRequest.kind, status: dataRequest.status },
    message:
      input.kind === 'DELETION'
        ? 'Your deletion request has been recorded. A data governance administrator will review it and confirm what can be erased and what must be retained under legal obligation.'
        : 'Your request has been recorded and will be reviewed.',
  });
});
