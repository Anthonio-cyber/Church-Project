import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { StaffShell } from '@/components/app/StaffShell';
import { requirePageUser, viewerFrom } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/counsellor', label: 'Dashboard' },
  { href: '/counsellor/requests', label: 'Client Requests' },
  { href: '/counsellor/sessions', label: 'Sessions' },
  { href: '/counsellor/availability', label: 'Availability' },
  { href: '/app/privacy', label: 'Security' },
];

export default async function CounsellorLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePageUser('/counsellor');

  // A counsellor profile is required to be here at all. Holding the role
  // without an approved profile is handled inside the dashboard, which shows
  // the application state instead of any caseload.
  const counsellor = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
    select: { id: true },
  });
  if (!counsellor) redirect('/app/dashboard?denied=1');

  const viewer = await viewerFrom(context);

  return (
    <StaffShell
      portal="Counsellor Portal"
      roleLabel="Counsellor"
      nav={NAV}
      displayName={viewer.displayName}
    >
      {children}
    </StaffShell>
  );
}
