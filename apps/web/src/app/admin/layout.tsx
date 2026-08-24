import { StaffShell } from '@/components/app/StaffShell';
import { requirePagePermission, viewerFrom } from '@/lib/auth/guard';
import { ROLE_LABEL, type PermissionKey } from '@/lib/permissions';
import type { AuthContext } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/**
 * Admin navigation is assembled from the viewer's own permissions.
 *
 * A content administrator sees content and nothing else; a counselling
 * administrator sees counselling operations but no safeguarding. The pages
 * themselves re-check, so this only decides what is worth showing.
 */
const NAV: { href: string; label: string; permission: PermissionKey }[] = [
  { href: '/admin', label: 'Overview', permission: 'analytics.view' },
  { href: '/admin/users', label: 'Users', permission: 'users.view' },
  { href: '/admin/counsellors', label: 'Counsellors', permission: 'counsellors.manage' },
  { href: '/admin/counselling', label: 'Counselling', permission: 'counselling.view' },
  { href: '/admin/content', label: 'Content', permission: 'content.edit' },
  { href: '/admin/events', label: 'Events', permission: 'events.edit' },
  { href: '/admin/announcements', label: 'Announcements', permission: 'announcements.send' },
  { href: '/admin/centers', label: 'Ministry Centers', permission: 'centers.manage' },
  { href: '/admin/safeguarding', label: 'Safeguarding', permission: 'safeguarding.view' },
  { href: '/admin/data-governance', label: 'Data Governance', permission: 'data_governance.manage' },
  { href: '/admin/security', label: 'Security', permission: 'security.manage' },
  { href: '/admin/audit', label: 'Audit Log', permission: 'audit_logs.view' },
];

const ENTRY_PERMISSIONS: PermissionKey[] = [
  'analytics.view',
  'users.view',
  'counselling.view',
  'counsellors.manage',
  'content.edit',
  'events.edit',
  'announcements.send',
  'centers.manage',
  'safeguarding.view',
  'audit_logs.view',
  'security.manage',
  'data_governance.manage',
];

function highestRoleLabel(context: AuthContext): string {
  const ordered = [...context.roles].sort(
    (a, b) => (ROLE_LABEL[b] ? 1 : 0) - (ROLE_LABEL[a] ? 1 : 0),
  );
  const adminRole = context.roles.find((role) =>
    [
      'SUPER_ADMIN',
      'SENIOR_LEADERSHIP_ADMIN',
      'ADMIN',
      'SAFEGUARDING_ADMIN',
      'COUNSELLING_ADMIN',
      'CONTENT_ADMIN',
      'EVENT_ADMIN',
      'ANALYTICS_ADMIN',
    ].includes(role),
  );
  return ROLE_LABEL[adminRole ?? ordered[0] ?? 'USER'];
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePagePermission(ENTRY_PERMISSIONS, '/admin');
  const viewer = await viewerFrom(context);

  const nav = NAV.filter((item) => context.permissions.has(item.permission));
  if (context.permissions.has('hierarchy.manage') || context.permissions.has('admins.manage')) {
    nav.push({ href: '/super-admin', label: 'Super Admin', permission: 'hierarchy.manage' });
  }

  return (
    <StaffShell
      portal="Admin Portal"
      roleLabel={highestRoleLabel(context)}
      nav={nav}
      displayName={viewer.displayName}
    >
      {children}
    </StaffShell>
  );
}
