import { prisma } from '@/lib/db';
import {
  ApiError,
  assertSameOrigin,
  created,
  enforceRateLimit,
  ok,
  parseBody,
  route,
} from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { reportSchema } from '@/lib/validation';
import { humanReference, encryptSensitive } from '@/lib/crypto';
import { triage } from '@/lib/domain/safeguarding';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/** The reports the caller has filed, so they can see what happened to them. */
export const GET = route(async () => {
  const context = await requireUser();
  const reports = await prisma.report.findMany({
    where: { reporterId: context.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      reference: true,
      category: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
    },
  });
  return ok({ reports });
});

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  await enforceRateLimit('report', `user:${context.user.id}`);
  const input = await parseBody(request, reportSchema);

  if (!input.reportedUserId && !input.messageId) {
    throw new ApiError(400, 'target_required', 'Tell us who or what you are reporting.');
  }
  if (input.reportedUserId === context.user.id) {
    throw new ApiError(400, 'invalid_target', 'You cannot report yourself.');
  }

  const report = await prisma.report.create({
    data: {
      reference: humanReference('RP'),
      reporterId: context.user.id,
      reportedUserId: input.reportedUserId ?? null,
      messageId: input.messageId ?? null,
      category: input.category,
      description: input.description,
      status: 'OPEN',
    },
  });

  // Some categories are safeguarding matters by definition and must not sit in
  // the ordinary moderation queue where general moderators would handle them.
  const alwaysSafeguarding = ['SEXUAL_MISCONDUCT', 'THREATS'];
  const triageResult = triage(input.description);
  const needsSafeguarding =
    alwaysSafeguarding.includes(input.category) || triageResult.flagged;

  if (needsSafeguarding) {
    const narrative = encryptSensitive(
      `Raised from moderation report ${report.reference}.\n\nCategory: ${input.category}\n\n${input.description}`,
    );
    await prisma.$transaction([
      prisma.safeguardingCase.create({
        data: {
          reference: humanReference('SG'),
          reportId: report.id,
          subjectUserId: input.reportedUserId ?? null,
          raisedById: context.user.id,
          category: triageResult.category ?? 'HARASSMENT',
          riskLevel: triageResult.risk ?? 'HIGH',
          narrativeCipher: narrative.cipher,
          narrativeIv: narrative.iv,
          status: 'OPEN',
        },
      }),
      prisma.report.update({
        where: { id: report.id },
        data: { status: 'ESCALATED', escalatedAt: new Date() },
      }),
    ]);

    const leads = await prisma.userRole.findMany({
      where: { role: { key: { in: ['SAFEGUARDING_ADMIN', 'SUPER_ADMIN'] } } },
      select: { userId: true },
    });
    for (const lead of new Set(leads.map((l) => l.userId))) {
      await notify({
        userId: lead,
        category: 'SAFEGUARDING',
        title: 'A safeguarding case has been opened',
        body: 'A new case requires review in the safeguarding portal.',
        link: '/admin/safeguarding',
        isCritical: true,
      });
    }
  } else {
    const moderators = await prisma.userRole.findMany({
      where: { role: { key: 'MODERATOR' } },
      select: { userId: true },
    });
    for (const moderator of new Set(moderators.map((m) => m.userId))) {
      await notify({
        userId: moderator,
        category: 'ADMINISTRATIVE',
        title: 'A new report needs review',
        body: `Report ${report.reference} is waiting in the moderation queue.`,
        link: '/moderation/reports',
      });
    }
  }

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    action: AUDIT.REPORT_FILED,
    targetType: 'report',
    targetId: report.id,
    metadata: { category: input.category, escalated: needsSafeguarding },
    ipAddress: context.ipAddress,
  });

  return created({
    report: { id: report.id, reference: report.reference, status: needsSafeguarding ? 'ESCALATED' : 'OPEN' },
    message: needsSafeguarding
      ? 'Thank you. Because of what you described, this has been sent directly to a safeguarding lead.'
      : 'Thank you. A moderator will review this report.',
    safeguarding: triageResult.flagged ? { message: triageResult.memberMessage } : undefined,
  });
});
