import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { AvailabilityEditor } from '@/components/app/AvailabilityEditor';
import { PermissionDenied } from '@/components/ui';

export const metadata: Metadata = { title: 'Availability' };
export const dynamic = 'force-dynamic';

export default async function AvailabilityPage() {
  const context = await requirePageUser('/counsellor/availability');

  const counsellor = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
    include: { availability: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] } },
  });

  if (!counsellor) return <PermissionDenied what="counsellor availability" />;

  return (
    <div className="mx-auto max-w-3xl">
      <AppPageHeader
        eyebrow="Counsellor Portal"
        title="Your availability"
        description="When you are available, and how many people you can walk with at once."
      />
      <AvailabilityEditor
        initialState={counsellor.availabilityState}
        initialCapacity={counsellor.maxConcurrentCases}
        initialSlots={counsellor.availability.map((slot) => ({
          weekday: slot.weekday,
          startMinute: slot.startMinute,
          endMinute: slot.endMinute,
          state: slot.state,
        }))}
      />
    </div>
  );
}
