import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

const slotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  state: z.enum(['AVAILABLE', 'BUSY', 'BREAK', 'UNAVAILABLE']).default('AVAILABLE'),
});

const schema = z.object({
  availabilityState: z.enum(['AVAILABLE', 'BUSY', 'BREAK', 'UNAVAILABLE']).optional(),
  maxConcurrentCases: z.number().int().min(1).max(50).optional(),
  /** Recurring weekly slots. Sending this replaces the whole schedule. */
  slots: z.array(slotSchema).max(60).optional(),
});

export const GET = route(async () => {
  const context = await requireUser();
  const counsellor = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
    include: { availability: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] } },
  });
  if (!counsellor) {
    throw new ApiError(403, 'not_a_counsellor', 'You do not have a counsellor profile.');
  }
  return ok({
    availabilityState: counsellor.availabilityState,
    maxConcurrentCases: counsellor.maxConcurrentCases,
    slots: counsellor.availability,
  });
});

export const PUT = route(async (request: Request) => {
  assertSameOrigin(request);
  const context = await requireUser();
  const input = await parseBody(request, schema);

  const counsellor = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
    select: { id: true, status: true },
  });
  if (!counsellor) {
    throw new ApiError(403, 'not_a_counsellor', 'You do not have a counsellor profile.');
  }

  if (input.slots) {
    for (const slot of input.slots) {
      if (slot.endMinute <= slot.startMinute) {
        throw new ApiError(400, 'invalid_slot', 'Each slot must end after it starts.');
      }
    }
    await prisma.$transaction([
      prisma.counsellorAvailability.deleteMany({ where: { counsellorId: counsellor.id } }),
      prisma.counsellorAvailability.createMany({
        data: input.slots.map((slot) => ({ ...slot, counsellorId: counsellor.id })),
      }),
    ]);
  }

  const updated = await prisma.counsellor.update({
    where: { id: counsellor.id },
    data: {
      ...(input.availabilityState ? { availabilityState: input.availabilityState } : {}),
      ...(input.maxConcurrentCases ? { maxConcurrentCases: input.maxConcurrentCases } : {}),
    },
    include: { availability: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] } },
  });

  return ok({
    availabilityState: updated.availabilityState,
    maxConcurrentCases: updated.maxConcurrentCases,
    slots: updated.availability,
    message: 'Availability updated.',
  });
});
