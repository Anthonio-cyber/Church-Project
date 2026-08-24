import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requirePermission, requireUser } from '@/lib/auth/context';
import { reasonSchema } from '@/lib/validation';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(['approve', 'reject', 'suspend', 'reinstate', 'set_under_review']),
  reason: reasonSchema,
});

/**
 * Counsellor verification.
 *
 * Approval is the moment a person may begin receiving people's pastoral
 * confidences, so it is deliberately an explicit administrative act with a
 * recorded reason — never a side effect of applying, and never self-service.
 * Approving also attaches the COUNSELLOR role, which mandates MFA.
 */
export const PATCH = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const base = await requireUser();
  const input = await parseBody(request, schema);

  const context = await requirePermission(
    input.action === 'suspend' ? 'counsellors.suspend' : 'counsellors.verify',
    { context: base, reason: input.reason, targetType: 'counsellor', targetId: id },
  );

  const counsellor = await prisma.counsellor.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!counsellor) throw new ApiError(404, 'not_found', 'That counsellor could not be found.');

  const counsellorRole = await prisma.role.findUnique({ where: { key: 'COUNSELLOR' } });
  const now = new Date();

  const auditBase = {
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    targetType: 'counsellor',
    targetId: id,
    reason: input.reason,
    ipAddress: context.ipAddress,
  };

  switch (input.action) {
    case 'approve': {
      await prisma.$transaction(async (tx) => {
        await tx.counsellor.update({
          where: { id },
          data: {
            status: 'APPROVED',
            statusReason: null,
            verifiedAt: now,
            verifiedById: context.user.id,
          },
        });
        if (counsellorRole) {
          await tx.userRole.upsert({
            where: { userId_roleId: { userId: counsellor.userId, roleId: counsellorRole.id } },
            create: {
              userId: counsellor.userId,
              roleId: counsellorRole.id,
              assignedById: context.user.id,
              reason: input.reason,
            },
            update: {},
          });
        }
        // The counsellor role carries a standing MFA requirement.
        await tx.user.update({
          where: { id: counsellor.userId },
          data: { mfaRequired: true },
        });
      });

      await writeAudit({ ...auditBase, action: AUDIT.COUNSELLOR_VERIFIED });
      await notify({
        userId: counsellor.userId,
        category: 'ADMINISTRATIVE',
        title: 'Your counsellor application has been approved',
        body: 'Set up multi-factor authentication and your availability to begin receiving requests.',
        isCritical: true,
        email: {
          subject: 'Your counsellor application has been approved',
          text: 'Your application has been approved. Please set up multi-factor authentication and your availability before receiving requests.',
        },
      });
      return ok({ message: 'Counsellor approved. Multi-factor authentication is now required for them.' });
    }

    case 'reject': {
      await prisma.counsellor.update({
        where: { id },
        data: { status: 'REJECTED', statusReason: input.reason },
      });
      await writeAudit({ ...auditBase, action: AUDIT.COUNSELLOR_REJECTED });
      await notify({
        userId: counsellor.userId,
        category: 'ADMINISTRATIVE',
        title: 'Update on your counsellor application',
        body: 'Your application was not approved at this time. Please speak with your ministry leader.',
      });
      return ok({ message: 'Application rejected.' });
    }

    case 'suspend': {
      await prisma.$transaction(async (tx) => {
        await tx.counsellor.update({
          where: { id },
          data: { status: 'SUSPENDED', statusReason: input.reason, availabilityState: 'UNAVAILABLE' },
        });
        if (counsellorRole) {
          await tx.userRole.deleteMany({
            where: { userId: counsellor.userId, roleId: counsellorRole.id },
          });
        }
        // Sessions already in the diary are returned to the counselling queue
        // rather than silently cancelled on the member.
        await tx.counsellingRequest.updateMany({
          where: { assignedCounsellorId: id, status: { in: ['ASSIGNED', 'SCHEDULED'] } },
          data: { status: 'MATCHING', assignedCounsellorId: null },
        });
      });
      await writeAudit({ ...auditBase, action: AUDIT.COUNSELLOR_SUSPENDED });
      return ok({
        message: 'Counsellor suspended. Open requests have been returned to the queue for reassignment.',
      });
    }

    case 'reinstate': {
      await prisma.$transaction(async (tx) => {
        await tx.counsellor.update({
          where: { id },
          data: { status: 'APPROVED', statusReason: null },
        });
        if (counsellorRole) {
          await tx.userRole.upsert({
            where: { userId_roleId: { userId: counsellor.userId, roleId: counsellorRole.id } },
            create: {
              userId: counsellor.userId,
              roleId: counsellorRole.id,
              assignedById: context.user.id,
              reason: input.reason,
            },
            update: {},
          });
        }
      });
      await writeAudit({ ...auditBase, action: 'ADMIN_COUNSELLOR_REINSTATED' });
      return ok({ message: 'Counsellor reinstated.' });
    }

    case 'set_under_review': {
      await prisma.counsellor.update({
        where: { id },
        data: { status: 'UNDER_REVIEW', statusReason: input.reason },
      });
      await writeAudit({ ...auditBase, action: 'ADMIN_COUNSELLOR_UNDER_REVIEW' });
      return ok({ message: 'Application marked as under review.' });
    }
  }
});
