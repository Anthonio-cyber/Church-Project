import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requirePermission, requireUser } from '@/lib/auth/context';
import { reasonSchema } from '@/lib/validation';
import { decryptSensitive } from '@/lib/crypto';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Open a safeguarding case.
 *
 * Reading the narrative requires a written reason on the query string. The
 * reason, the reader and the time are written to the case's own access trail —
 * which is append-only at the database level — as well as to the audit log.
 * There is no way to read a case without leaving that record.
 */
export const GET = route(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const url = new URL(request.url);
  const reason = url.searchParams.get('reason') ?? '';

  const context = await requirePermission('safeguarding.view', {
    reason,
    targetType: 'safeguarding_case',
    targetId: id,
  });

  const safeguardingCase = await prisma.safeguardingCase.findUnique({
    where: { id },
    include: {
      accesses: { orderBy: { createdAt: 'desc' }, take: 20 },
      report: { select: { reference: true, category: true, description: true, createdAt: true } },
    },
  });
  if (!safeguardingCase) {
    throw new ApiError(404, 'not_found', 'That case could not be found.');
  }

  await prisma.safeguardingAccess.create({
    data: { caseId: id, actorId: context.user.id, action: 'READ', reason },
  });
  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.SAFEGUARDING_CASE_ACCESSED,
    targetType: 'safeguarding_case',
    targetId: id,
    reason,
    ipAddress: context.ipAddress,
  });

  const subject = safeguardingCase.subjectUserId
    ? await prisma.user.findUnique({
        where: { id: safeguardingCase.subjectUserId },
        select: { id: true, status: true, profile: { select: { displayName: true, ageBand: true } } },
      })
    : null;

  return ok({
    case: {
      id: safeguardingCase.id,
      reference: safeguardingCase.reference,
      category: safeguardingCase.category,
      riskLevel: safeguardingCase.riskLevel,
      status: safeguardingCase.status,
      involvesMinor: safeguardingCase.involvesMinor,
      narrative: decryptSensitive(
        safeguardingCase.narrativeCipher,
        safeguardingCase.narrativeIv,
      ),
      createdAt: safeguardingCase.createdAt,
      escalatedAt: safeguardingCase.escalatedAt,
      closedAt: safeguardingCase.closedAt,
      closureSummary: safeguardingCase.closureSummary,
      assignedToId: safeguardingCase.assignedToId,
      report: safeguardingCase.report,
      subject: subject
        ? {
            id: subject.id,
            displayName: subject.profile?.displayName ?? 'Member',
            accountStatus: subject.status,
            isMinor: subject.profile?.ageBand === 'MINOR',
          }
        : null,
      accessTrail: safeguardingCase.accesses,
    },
    notice:
      'Your access to this case has been recorded against it and cannot be removed.',
  });
});

const patchSchema = z.object({
  action: z.enum(['assign', 'set_risk', 'escalate', 'action_taken', 'close']),
  reason: reasonSchema,
  assignToId: z.string().uuid().optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  closureSummary: z.string().trim().max(2000).optional(),
});

export const PATCH = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const base = await requireUser();
  const input = await parseBody(request, patchSchema);

  const context = await requirePermission(
    input.action === 'escalate' ? 'safeguarding.escalate' : 'safeguarding.manage',
    { context: base, reason: input.reason, targetType: 'safeguarding_case', targetId: id },
  );

  const safeguardingCase = await prisma.safeguardingCase.findUnique({ where: { id } });
  if (!safeguardingCase) throw new ApiError(404, 'not_found', 'That case could not be found.');

  const record = async (action: string) => {
    await prisma.safeguardingAccess.create({
      data: { caseId: id, actorId: context.user.id, action, reason: input.reason },
    });
    await writeAudit({
      actorId: context.user.id,
      actorEmail: context.user.email,
      actorRole: context.roles.join(','),
      action: AUDIT.SAFEGUARDING_CASE_UPDATED,
      targetType: 'safeguarding_case',
      targetId: id,
      reason: input.reason,
      metadata: { action },
      ipAddress: context.ipAddress,
    });
  };

  switch (input.action) {
    case 'assign': {
      if (!input.assignToId) throw new ApiError(400, 'assignee_required', 'Choose a lead.');
      // A case may only be assigned to someone who is themselves permitted to
      // handle safeguarding.
      const assignee = await prisma.userRole.findFirst({
        where: {
          userId: input.assignToId,
          role: { key: { in: ['SAFEGUARDING_ADMIN', 'SENIOR_LEADERSHIP_ADMIN', 'SUPER_ADMIN'] } },
        },
      });
      if (!assignee) {
        throw new ApiError(
          400,
          'invalid_assignee',
          'Cases can only be assigned to a safeguarding lead or senior leadership.',
        );
      }
      await prisma.safeguardingCase.update({
        where: { id },
        data: { assignedToId: input.assignToId, status: 'UNDER_ASSESSMENT' },
      });
      await notify({
        userId: input.assignToId,
        category: 'SAFEGUARDING',
        title: 'A safeguarding case has been assigned to you',
        body: `Case ${safeguardingCase.reference} needs your assessment.`,
        link: '/admin/safeguarding',
        isCritical: true,
      });
      await record('ASSIGN');
      return ok({ message: 'Case assigned.' });
    }

    case 'set_risk': {
      if (!input.riskLevel) throw new ApiError(400, 'risk_required', 'Choose a risk level.');
      await prisma.safeguardingCase.update({ where: { id }, data: { riskLevel: input.riskLevel } });
      await record('SET_RISK');
      return ok({ message: `Risk level set to ${input.riskLevel}.` });
    }

    case 'escalate': {
      await prisma.safeguardingCase.update({
        where: { id },
        data: { status: 'ESCALATED', escalatedAt: new Date(), escalatedToId: context.user.id },
      });
      const leadership = await prisma.userRole.findMany({
        where: { role: { key: { in: ['SENIOR_LEADERSHIP_ADMIN', 'SUPER_ADMIN'] } } },
        select: { userId: true },
      });
      for (const leader of new Set(leadership.map((l) => l.userId))) {
        await notify({
          userId: leader,
          category: 'SAFEGUARDING',
          title: 'A safeguarding case has been escalated to leadership',
          body: `Case ${safeguardingCase.reference} requires senior review.`,
          link: '/admin/safeguarding',
          isCritical: true,
        });
      }
      await record('ESCALATE');
      return ok({ message: 'Case escalated to senior leadership.' });
    }

    case 'action_taken': {
      await prisma.safeguardingCase.update({ where: { id }, data: { status: 'ACTION_TAKEN' } });
      await record('ACTION_TAKEN');
      return ok({ message: 'Case marked as actioned.' });
    }

    case 'close': {
      await prisma.safeguardingCase.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closureSummary: input.closureSummary ?? input.reason,
        },
      });
      await record('CLOSE');
      return ok({ message: 'Case closed.' });
    }
  }
});
