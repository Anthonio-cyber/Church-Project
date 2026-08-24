import { prisma } from '@/lib/db';
import {
  assertSameOrigin,
  created,
  enforceRateLimit,
  parseBody,
  route,
} from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { counsellingRequestSchema } from '@/lib/validation';
import { assertFeatureEnabled } from '@/lib/domain/settings';
import { findMatchingCounsellors } from '@/lib/domain/counselling';
import { triage } from '@/lib/domain/safeguarding';
import { encryptSensitive, humanReference } from '@/lib/crypto';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';
import { channels, publish } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  await assertFeatureEnabled('counselling.intake_enabled');
  const context = await requireUser();
  await enforceRateLimit('counsellingRequest', `user:${context.user.id}`);

  const input = await parseBody(request, counsellingRequestSchema);
  const profile = await prisma.profile.findUnique({ where: { userId: context.user.id } });
  const isMinor = profile?.ageBand === 'MINOR';

  // Safeguarding triage runs before anything else. If someone has described
  // danger, they get the crisis message immediately and a safeguarding lead is
  // notified — the request is never quietly queued behind routine work.
  const triageResult = triage(`${input.summary}\n${input.details ?? ''}`);

  const counsellingRequest = await prisma.counsellingRequest.create({
    data: {
      requesterId: context.user.id,
      category: input.category,
      summary: input.summary,
      details: input.details && input.details.length > 0 ? input.details : null,
      preferredGender: input.preferredGender,
      preferredDate:
        input.preferredDate && input.preferredDate.length > 0
          ? new Date(input.preferredDate)
          : null,
      preferredTimeLabel: input.preferredTimeLabel || null,
      urgency: triageResult.risk === 'CRITICAL' ? 'URGENT' : input.urgency,
      preferredMethod: input.preferredMethod,
      language: input.language,
      ministryCenterId: context.user.ministryCenterId,
      disclaimerAckAt: new Date(),
      safeguardingFlagged: triageResult.flagged,
      status: 'SUBMITTED',
    },
  });

  if (triageResult.flagged && triageResult.category && triageResult.risk) {
    const narrative = encryptSensitive(
      `Automatically raised from a counselling request.\n\nCategory: ${input.category}\nSummary: ${input.summary}\n\nDetails: ${input.details ?? '(none)'}`,
    );
    await prisma.safeguardingCase.create({
      data: {
        reference: humanReference('SG'),
        subjectUserId: context.user.id,
        raisedById: context.user.id,
        category: triageResult.category,
        riskLevel: triageResult.risk,
        narrativeCipher: narrative.cipher,
        narrativeIv: narrative.iv,
        involvesMinor: isMinor,
        status: 'OPEN',
      },
    });

    // Safeguarding leads are notified by role, never by broadcasting the
    // content of the concern.
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
  }

  // Preliminary matching. Nothing is assigned automatically — a counselling
  // administrator confirms the assignment, or the counsellor accepts it.
  const matches = await findMatchingCounsellors({
    category: input.category,
    language: input.language,
    preferredGender: input.preferredGender,
    ministryCenterId: context.user.ministryCenterId,
    requesterIsMinor: isMinor,
    limit: 3,
  });

  if (matches.length > 0) {
    await prisma.counsellingRequest.update({
      where: { id: counsellingRequest.id },
      data: { status: 'MATCHING' },
    });
    for (const match of matches) {
      publish(channels.counsellorQueue(match.counsellor.id), 'request.available', {
        requestId: counsellingRequest.id,
        category: input.category,
        urgency: counsellingRequest.urgency,
      });
      await notify({
        userId: match.counsellor.userId,
        category: 'COUNSELLING',
        title: 'A counselling request is awaiting a counsellor',
        body: 'A new request matching your areas of service is waiting in your portal.',
        link: '/counsellor/requests',
        push: true,
      });
    }
  }

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.COUNSELLING_REQUEST_CREATED,
    targetType: 'counselling_request',
    targetId: counsellingRequest.id,
    // The audit log records that a request was made and its category — never
    // the pastoral content of it.
    metadata: { category: input.category, urgency: counsellingRequest.urgency, safeguardingFlagged: triageResult.flagged },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  await notify({
    userId: context.user.id,
    category: 'COUNSELLING',
    title: 'We have received your request',
    body: 'The counselling team is reviewing your request. You will be notified when a counsellor is assigned.',
    link: '/app/counselling',
    email: {
      subject: 'We have received your counselling request',
      text: 'Your request has been received and is being reviewed by the counselling team.',
    },
  });

  return created({
    request: {
      id: counsellingRequest.id,
      status: matches.length > 0 ? 'MATCHING' : 'SUBMITTED',
      category: counsellingRequest.category,
      urgency: counsellingRequest.urgency,
      createdAt: counsellingRequest.createdAt,
    },
    matchesFound: matches.length,
    safeguarding: triageResult.flagged
      ? { flagged: true, message: triageResult.memberMessage }
      : { flagged: false },
    message:
      matches.length > 0
        ? 'Your request has been received and sent to available counsellors.'
        : 'Your request has been received. A counselling administrator will assign a counsellor shortly.',
  });
});
