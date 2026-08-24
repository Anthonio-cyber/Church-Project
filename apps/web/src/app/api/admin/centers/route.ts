import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, created, ok, parseBody, route } from '@/lib/api';
import { requirePermission } from '@/lib/auth/context';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requirePermission('centers.manage');
  const centers = await prisma.ministryCenter.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { members: true, counsellors: true, events: true, hierarchy: true } },
    },
  });
  return ok({ centers });
});

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  country: z.string().trim().min(2).max(60),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  address: z.string().trim().max(240).optional().or(z.literal('')),
  contactEmail: z.string().email().max(254).optional().or(z.literal('')),
  contactPhone: z.string().trim().max(40).optional().or(z.literal('')),
  timezone: z.string().trim().max(60).default('UTC'),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requirePermission('centers.manage');
  const input = await parseBody(request, schema);

  const existing = await prisma.ministryCenter.findUnique({ where: { slug: input.slug } });
  if (existing) throw new ApiError(409, 'slug_taken', 'That web address is already in use.');

  const center = await prisma.ministryCenter.create({
    data: {
      name: input.name,
      slug: input.slug,
      country: input.country,
      city: input.city || null,
      address: input.address || null,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone || null,
      timezone: input.timezone,
      description: input.description || null,
    },
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: 'ADMIN_CENTER_CREATED',
    targetType: 'ministry_center',
    targetId: center.id,
    ipAddress: context.ipAddress,
  });

  return created({ center, message: 'Ministry centre created.' });
});
