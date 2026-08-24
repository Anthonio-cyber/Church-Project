import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requirePermission, requireUser } from '@/lib/auth/context';
import { reasonSchema } from '@/lib/validation';
import { encryptSensitive, humanReference } from '@/lib/crypto';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(['claim', 'resolve', 'dismiss', 'escalate', 'mark_action_required']),
  reason: reasonSchema,
  safeguardingCategory: z
    .enum([
      'ABUSE', 'THREATS', 'EXPLOITATION', 'HARASSMENT', 'SELF_HARM_CONCERN',
      'CHILD_SAFETY', 'SEXUAL_MISCONDUCT', 'FINANCIAL_EXPLOITATION',
    ])
    .optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

export const PATCH = route(async (request: Request, { params }: Params) => {
  assertSameOrigin(request);
  const { id } = await params;
  const base = await requireUser();
  const input = await parseBody(request, schema);

  const permission =
    input.action === 'escalate'
      ? 'reports.escalate'
      : input.action === 'claim' || input.action === 'mark_action_required'
        ? 'reports.view'
        : 'reports.resolve';

  const context = await requirePermission(permission, {
    context: base,
    reason: input.reason,
    targetType: 'report',
    targetId: id,
  });

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) throw new ApiError(404, 'not_found', 'That report could not be found.');

  const auditBase = {
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    targetType: 'report',
    targetId: id,
    reason: input.reason,
    ipAddress: context.ipAddress,
  };

  switch (input.action) {
    case 'claim': {
      await prisma.report.update({
        where: { id },
        data: { status: 'UNDER_REVIEW', assignedModeratorId: context.user.id },
      });
      await writeAudit({ ...auditBase, action: 'MODERATION_REPORT_CLAIMED' });
      return ok({ message: 'Report claimed and marked under review.' });
    }

    case 'mark_action_required': {
      await prisma.report.update({ where: { id }, data: { status: 'ACTION_REQUIRED' } });
      await writeAudit({ ...auditBase, action: 'MODERATION_ACTION_REQUIRED' });
      return ok({ message: 'Report marked as requiring action.' });
    }

    case 'resolve':
    case 'dismiss': {
      await prisma.report.update({
        where: { id },
        data: {
          status: input.action === 'resolve' ? 'RESOLVED' : 'DISMISSED',
          resolution: input.reason,
          resolvedAt: new Date(),
          resolvedById: context.user.id,
        },
      });
      await writeAudit({ ...auditBase, action: AUDIT.REPORT_RESOLVED, metadata: { outcome: input.action } });
      await notify({
        userId: report.reporterId,
        category: 'ADMINISTRATIVE',
        title: `Your report ${report.reference} has been reviewed`,
        body:
          input.action === 'resolve'
            ? 'Thank you. A moderator has reviewed your report and taken action.'
            : 'A moderator has reviewed your report. No further action was needed on this occasion.',
        link: '/app/help',
      });
      return ok({ message: `Report ${input.action === 'resolve' ? 'resolved' : 'dismissed'}.` });
    }

    case 'escalate': {
      // Escalation creates a safeguarding case, whose narrative is encrypted and
      // whose visibility is limited to safeguarding permission holders. The
      // escalating moderator does not gain access to it by escalating.
      const existing = await prisma.safeguardingCase.findUnique({ where: { reportId: id } });
      if (!existing) {
        const narrative = encryptSensitive(
          `Escalated from moderation report ${report.reference} by ${context.user.email}.\n\nModerator reason: ${input.reason}\n\nOriginal report: ${report.description}`,
        );
        await prisma.safeguardingCase.create({
          data: {
            reference: humanReference('SG'),
            reportId: id,
            subjectUserId: report.reportedUserId,
            raisedById: context.user.id,
            category: input.safeguardingCategory ?? 'HARASSMENT',
            riskLevel: input.riskLevel ?? 'HIGH',
            narrativeCipher: narrative.cipher,
            narrativeIv: narrative.iv,
            status: 'OPEN',
          },
        });
      }

      await prisma.report.update({
        where: { id },
        data: {
          status: 'ESCALATED',
          escalatedAt: new Date(),
          escalatedToId: context.user.id,
        },
      });

      const leads = await prisma.userRole.findMany({
        where: { role: { key: { in: ['SAFEGUARDING_ADMIN', 'SENIOR_LEADERSHIP_ADMIN', 'SUPER_ADMIN'] } } },
        select: { userId: true },
      });
      for (const lead of new Set(leads.map((l) => l.userId))) {
        await notify({
          userId: lead,
          category: 'SAFEGUARDING',
          title: 'A report has been escalated to safeguarding',
          body: 'A case is waiting for assessment in the safeguarding portal.',
          link: '/admin/safeguarding',
          isCritical: true,
        });
      }

      await writeAudit({ ...auditBase, action: AUDIT.REPORT_ESCALATED });
      return ok({
        message:
          'Escalated to safeguarding. The case is now visible only to safeguarding leads and senior leadership.',
      });
    }
  }
});
