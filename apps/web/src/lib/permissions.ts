import type { RoleKey } from '@prisma/client';

/**
 * The complete permission catalogue.
 *
 * Permissions are granular on purpose: an administrator receives only what
 * their office actually requires. Nothing in this catalogue is granted
 * implicitly by holding a senior role — every grant is an explicit row in
 * role_permissions or user_permission_overrides.
 */
export const PERMISSIONS = {
  'users.view': 'View member accounts and account status.',
  'users.edit': 'Edit member account details.',
  'users.suspend': 'Suspend or reinstate a member account.',
  'users.delete': 'Delete a member account under the retention policy.',
  'users.export': 'Export member records.',
  'users.force_logout': 'Revoke a member’s active sessions.',
  'users.require_mfa': 'Require multi-factor authentication on an account.',
  'users.assign_role': 'Assign or remove non-administrative roles.',

  'counselling.view': 'View counselling requests and session status.',
  'counselling.assign': 'Assign or reassign a counsellor to a request.',
  'counselling.manage': 'Manage counselling categories, scheduling and cancellations.',
  'counselling.notes_access': 'Access internal counselling notes for a stated operational reason.',
  'counselling.safeguarding_access': 'Access safeguarding records attached to counselling.',

  'counsellors.verify': 'Approve or reject counsellor applications.',
  'counsellors.manage': 'Manage counsellor profiles and availability.',
  'counsellors.suspend': 'Suspend a counsellor from receiving requests.',

  'messages.moderate': 'Review reported messages.',
  'reports.view': 'View moderation reports.',
  'reports.resolve': 'Resolve or dismiss moderation reports.',
  'reports.escalate': 'Escalate a report to safeguarding or senior leadership.',

  'safeguarding.view': 'View safeguarding cases.',
  'safeguarding.manage': 'Assess, action and close safeguarding cases.',
  'safeguarding.escalate': 'Escalate a safeguarding case to senior leadership.',

  'content.create': 'Create resources, courses and lessons.',
  'content.edit': 'Edit existing content.',
  'content.publish': 'Publish content to members or the public.',
  'content.delete': 'Archive or delete content.',

  'events.create': 'Create events.',
  'events.edit': 'Edit events.',
  'events.publish': 'Publish events.',
  'events.cancel': 'Cancel events and notify registrants.',
  'events.export': 'Export event registrations.',

  'announcements.send': 'Send announcements and notifications.',

  'centers.manage': 'Manage ministry centre records.',

  'analytics.view': 'View aggregated, anonymised platform analytics.',

  'settings.manage': 'Change platform configuration.',
  'hierarchy.manage': 'Manage the church hierarchy and reporting lines.',
  'admins.manage': 'Appoint or remove administrators.',
  'roles.manage': 'Create and edit roles.',
  'permissions.manage': 'Grant or revoke permissions.',
  'audit_logs.view': 'Read the audit log.',
  'security.manage': 'Use the security centre controls.',
  'emergency_controls.manage': 'Activate platform emergency controls.',
  'support_mode.use': 'Enter recorded support mode on a member account.',
  'data_governance.manage': 'Manage retention, exports and data-rights requests.',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

/**
 * Sensitive permissions require multi-factor authentication and a fresh
 * re-authentication before the action is allowed to proceed, and the action is
 * always written to the audit log with a stated reason.
 */
export const SENSITIVE_PERMISSIONS: PermissionKey[] = [
  'users.delete',
  'users.export',
  'counselling.notes_access',
  'counselling.safeguarding_access',
  'safeguarding.view',
  'safeguarding.manage',
  'safeguarding.escalate',
  'hierarchy.manage',
  'admins.manage',
  'roles.manage',
  'permissions.manage',
  'security.manage',
  'emergency_controls.manage',
  'support_mode.use',
  'data_governance.manage',
  'settings.manage',
];

export function isSensitive(permission: PermissionKey): boolean {
  return SENSITIVE_PERMISSIONS.includes(permission);
}

/**
 * Role ranks. Authority increases with the number.
 *
 * The guard rule that follows from this is simple and enforced server-side in
 * every administrative route: an actor may only act on a principal of strictly
 * lower rank than their own, and may never grant a permission they do not
 * themselves hold. That is what makes "can Pst. Gabriel Adayi assign himself as
 * Super Admin?" answer NO structurally rather than by convention.
 */
export const ROLE_RANK: Record<RoleKey, number> = {
  USER: 0,
  COUNSELLOR: 20,
  PASTOR: 25,
  MINISTRY_LEADER: 30,
  MODERATOR: 40,
  CONTENT_ADMIN: 50,
  EVENT_ADMIN: 50,
  ANALYTICS_ADMIN: 50,
  COUNSELLING_ADMIN: 55,
  SAFEGUARDING_ADMIN: 60,
  ADMIN: 70,
  SENIOR_LEADERSHIP_ADMIN: 85,
  SUPER_ADMIN: 100,
};

export const ROLE_LABEL: Record<RoleKey, string> = {
  USER: 'Member',
  COUNSELLOR: 'Counsellor',
  PASTOR: 'Pastor',
  MINISTRY_LEADER: 'Ministry Leader',
  MODERATOR: 'Moderator',
  CONTENT_ADMIN: 'Content Administrator',
  EVENT_ADMIN: 'Event Administrator',
  ANALYTICS_ADMIN: 'Analytics Administrator',
  COUNSELLING_ADMIN: 'Counselling Administrator',
  SAFEGUARDING_ADMIN: 'Safeguarding Administrator',
  ADMIN: 'Administrator',
  SENIOR_LEADERSHIP_ADMIN: 'Senior Leadership Administrator',
  SUPER_ADMIN: 'Super Admin (Setman)',
};

export const ROLE_DESCRIPTION: Record<RoleKey, string> = {
  USER: 'A member of the fellowship using counselling, prayer and discipleship.',
  COUNSELLOR: 'An approved counsellor who receives assigned counselling requests.',
  PASTOR: 'A pastor serving members pastorally, including counselling when approved.',
  MINISTRY_LEADER: 'Leads a ministry area or ministry centre activity.',
  MODERATOR: 'Reviews community reports. Has no access to counselling content.',
  CONTENT_ADMIN: 'Manages teaching resources, courses and lessons.',
  EVENT_ADMIN: 'Manages events, registrations and attendance.',
  ANALYTICS_ADMIN: 'Reads aggregated statistics only. No record-level access.',
  COUNSELLING_ADMIN: 'Runs counselling operations without browsing private conversations.',
  SAFEGUARDING_ADMIN: 'Handles safeguarding cases under approved church policy.',
  ADMIN: 'General platform administrator operating under senior leadership.',
  SENIOR_LEADERSHIP_ADMIN: 'Senior leadership oversight of ministry operations.',
  SUPER_ADMIN: 'Highest platform authority. Every action is audited.',
};

/**
 * Default permission grants per role.
 *
 * Note what is deliberately absent: no administrative role below
 * SAFEGUARDING_ADMIN receives safeguarding access, no role except
 * SAFEGUARDING_ADMIN and SUPER_ADMIN receives counselling.notes_access, and
 * MODERATOR receives nothing from the counselling namespace at all.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  USER: [],

  COUNSELLOR: [],

  PASTOR: [],

  MINISTRY_LEADER: ['events.create', 'events.edit', 'analytics.view'],

  MODERATOR: [
    'users.view',
    'messages.moderate',
    'reports.view',
    'reports.resolve',
    'reports.escalate',
  ],

  CONTENT_ADMIN: ['content.create', 'content.edit', 'content.publish', 'content.delete'],

  EVENT_ADMIN: [
    'events.create',
    'events.edit',
    'events.publish',
    'events.cancel',
    'events.export',
    'announcements.send',
  ],

  ANALYTICS_ADMIN: ['analytics.view'],

  COUNSELLING_ADMIN: [
    'users.view',
    'counselling.view',
    'counselling.assign',
    'counselling.manage',
    'counsellors.verify',
    'counsellors.manage',
    'counsellors.suspend',
    'analytics.view',
  ],

  SAFEGUARDING_ADMIN: [
    'users.view',
    'reports.view',
    'reports.escalate',
    'safeguarding.view',
    'safeguarding.manage',
    'safeguarding.escalate',
    'counselling.safeguarding_access',
    'counselling.notes_access',
  ],

  ADMIN: [
    'users.view',
    'users.edit',
    'users.suspend',
    'users.force_logout',
    'users.require_mfa',
    'users.assign_role',
    'counselling.view',
    'counselling.assign',
    'counselling.manage',
    'counsellors.verify',
    'counsellors.manage',
    'counsellors.suspend',
    'reports.view',
    'reports.resolve',
    'reports.escalate',
    'messages.moderate',
    'content.create',
    'content.edit',
    'content.publish',
    'content.delete',
    'events.create',
    'events.edit',
    'events.publish',
    'events.cancel',
    'events.export',
    'announcements.send',
    'centers.manage',
    'analytics.view',
    'audit_logs.view',
  ],

  SENIOR_LEADERSHIP_ADMIN: [
    'users.view',
    'users.suspend',
    'counselling.view',
    'counselling.manage',
    'counsellors.verify',
    'counsellors.manage',
    'counsellors.suspend',
    'reports.view',
    'reports.resolve',
    'reports.escalate',
    'safeguarding.view',
    'safeguarding.escalate',
    'content.create',
    'content.edit',
    'content.publish',
    'events.create',
    'events.edit',
    'events.publish',
    'events.cancel',
    'announcements.send',
    'centers.manage',
    'analytics.view',
    'audit_logs.view',
    'admins.manage',
    'security.manage',
  ],

  // The Super Admin holds the full catalogue, but holding a permission is not
  // the same as using it without accountability: sensitive permissions still
  // demand MFA, fresh re-authentication and a recorded reason, and the audit
  // log is append-only at the database level.
  SUPER_ADMIN: ALL_PERMISSIONS,
};

export const STAFF_ROLES: RoleKey[] = [
  'COUNSELLOR',
  'PASTOR',
  'MINISTRY_LEADER',
  'MODERATOR',
  'CONTENT_ADMIN',
  'EVENT_ADMIN',
  'ANALYTICS_ADMIN',
  'COUNSELLING_ADMIN',
  'SAFEGUARDING_ADMIN',
  'ADMIN',
  'SENIOR_LEADERSHIP_ADMIN',
  'SUPER_ADMIN',
];

export const ADMIN_ROLES: RoleKey[] = [
  'CONTENT_ADMIN',
  'EVENT_ADMIN',
  'ANALYTICS_ADMIN',
  'COUNSELLING_ADMIN',
  'SAFEGUARDING_ADMIN',
  'ADMIN',
  'SENIOR_LEADERSHIP_ADMIN',
  'SUPER_ADMIN',
];

/** Roles that must always carry multi-factor authentication. */
export const MFA_REQUIRED_ROLES: RoleKey[] = [
  'COUNSELLOR',
  'PASTOR',
  'MODERATOR',
  ...ADMIN_ROLES,
];
