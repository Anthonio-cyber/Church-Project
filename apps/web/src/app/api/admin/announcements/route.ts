import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertSameOrigin, created, ok, parseBody, route } from '@/lib/api';
import { requirePermission } from '@/lib/auth/context';
import { AUDIT, writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requirePermission('announcements.send');
  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { ministryCenter: { select: { name: true } } },
  });
  return ok({ announcements });
});

const schema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(10).max(4000),
  audienceRole: z
    .enum([
      'USER', 'COUNSELLOR', 'PASTOR', 'MINISTRY_LEADER', 'MODERATOR',
      'COUNSELLING_ADMIN', 'CONTENT_ADMIN', 'EVENT_ADMIN', 'SAFEGUARDING_ADMIN',
      'ANALYTICS_ADMIN', 'ADMIN', 'SENIOR_LEADERSHIP_ADMIN', 'SUPER_ADMIN',
    ])
    .optional(),
  audienceCountry: z.string().trim().max(60).optional(),
  ministryCenterId: z.string().uuid().optional(),
  channels: z.array(z.enum(['IN_APP', 'EMAIL', 'PUSH'])).min(1).default(['IN_APP']),
  scheduledFor: z.string().datetime().optional().or(z.literal('')),
});

/**
 * Ministry announcements.
 *
 * Announcements are an ANNOUNCEMENT-category notification, which every member
 * can switch off in their preferences — they are ministry communication, not
 * security notices, and treating them as unmuteable would train people to
 * ignore the notices that do matter.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requirePermission('announcements.send');
  const input = await parseBody(request, schema);

  const scheduledFor =
    input.scheduledFor && input.scheduledFor.length > 0 ? new Date(input.scheduledFor) : null;

  const announcement = await prisma.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      audienceRole: input.audienceRole ?? null,
      audienceCountry: input.audienceCountry ?? null,
      ministryCenterId: input.ministryCenterId ?? null,
      channels: input.channels,
      scheduledFor,
      status: scheduledFor ? 'REVIEW' : 'PUBLISHED',
      sentAt: scheduledFor ? null : new Date(),
      createdById: context.user.id,
    },
  });

  let recipients = 0;

  if (!scheduledFor) {
    const audience = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(input.audienceRole ? { roles: { some: { role: { key: input.audienceRole } } } } : {}),
        ...(input.audienceCountry ? { profile: { country: input.audienceCountry } } : {}),
        ...(input.ministryCenterId ? { ministryCenterId: input.ministryCenterId } : {}),
      },
      select: { id: true },
    });

    for (const member of audience) {
      await notify({
        userId: member.id,
        category: 'ANNOUNCEMENT',
        title: input.title,
        body: input.body.slice(0, 240),
        link: '/app/dashboard',
        push: input.channels.includes('PUSH'),
        email: input.channels.includes('EMAIL')
          ? { subject: input.title, text: input.body }
          : undefined,
      });
    }
    recipients = audience.length;
  }

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.ANNOUNCEMENT_SENT,
    targetType: 'announcement',
    targetId: announcement.id,
    metadata: {
      recipients,
      scheduled: Boolean(scheduledFor),
      audienceRole: input.audienceRole ?? 'all',
    },
    ipAddress: context.ipAddress,
  });

  return created({
    announcement,
    recipients,
    message: scheduledFor
      ? `Scheduled. It will be sent at ${scheduledFor.toISOString()}.`
      : `Sent to ${recipients} member(s).`,
  });
});
