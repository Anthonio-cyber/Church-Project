import { StaffShell } from '@/components/app/StaffShell';
import { requirePagePermission, viewerFrom } from '@/lib/auth/guard';
import { ROLE_LABEL } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/moderation', label: 'Dashboard' },
  { href: '/moderation/reports', label: 'Reports' },
  { href: '/community-guidelines', label: 'Community Guidelines' },
  { href: '/app/privacy', label: 'Security' },
];

export default async function ModerationLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePagePermission(['reports.view'], '/moderation');
  const viewer = await viewerFrom(context);
  const roleLabel = context.roles.includes('MODERATOR')
    ? ROLE_LABEL.MODERATOR
    : ROLE_LABEL[context.roles[0] ?? 'USER'];

  return (
    <StaffShell
      portal="Moderator Portal"
      roleLabel={roleLabel}
      nav={NAV}
      displayName={viewer.displayName}
    >
      {children}
    </StaffShell>
  );
}
