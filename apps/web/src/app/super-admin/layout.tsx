import { StaffShell } from '@/components/app/StaffShell';
import { requirePagePermission, viewerFrom } from '@/lib/auth/guard';
import { ROLE_LABEL } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/super-admin', label: 'System Overview' },
  { href: '/super-admin/hierarchy', label: 'Church Hierarchy' },
  { href: '/super-admin/admins', label: 'Administrators' },
  { href: '/super-admin/permissions', label: 'Permissions' },
  { href: '/super-admin/emergency', label: 'Emergency Controls' },
  { href: '/admin/audit', label: 'Audit Log' },
  { href: '/admin/security', label: 'Security' },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePagePermission(
    ['hierarchy.manage', 'admins.manage', 'emergency_controls.manage'],
    '/super-admin',
  );
  const viewer = await viewerFrom(context);

  const roleLabel = context.roles.includes('SUPER_ADMIN')
    ? ROLE_LABEL.SUPER_ADMIN
    : context.roles.includes('SENIOR_LEADERSHIP_ADMIN')
      ? ROLE_LABEL.SENIOR_LEADERSHIP_ADMIN
      : ROLE_LABEL.ADMIN;

  return (
    <StaffShell
      portal="Super Admin Portal"
      roleLabel={roleLabel}
      nav={NAV.filter((item) => {
        if (item.href === '/super-admin/emergency') {
          return context.permissions.has('emergency_controls.manage');
        }
        if (item.href === '/super-admin/permissions') {
          return context.permissions.has('permissions.manage');
        }
        if (item.href === '/super-admin/admins') {
          return context.permissions.has('admins.manage');
        }
        if (item.href === '/super-admin/hierarchy') {
          return context.permissions.has('hierarchy.manage');
        }
        if (item.href === '/admin/audit') return context.permissions.has('audit_logs.view');
        if (item.href === '/admin/security') return context.permissions.has('security.manage');
        return true;
      })}
      displayName={viewer.displayName}
      accent="crimson"
    >
      {children}
    </StaffShell>
  );
}
