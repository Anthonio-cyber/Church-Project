import type { AuditOutcome, Prisma, SecurityEventKind } from '@prisma/client';
import { prisma } from './db';

export type AuditInput = {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  reason?: string | null;
  outcome?: AuditOutcome;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Write an audit entry.
 *
 * Audit writes must never break the user-facing action they describe, but they
 * must also never be silently lost — a failure is surfaced on the server log so
 * an operator can investigate.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        reason: input.reason ?? null,
        outcome: input.outcome ?? 'SUCCESS',
        metadata: input.metadata,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] failed to persist audit entry', input.action, error);
  }
}

export async function writeSecurityEvent(input: {
  userId?: string | null;
  kind: SecurityEventKind;
  severity?: 'info' | 'warning' | 'critical';
  detail?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        userId: input.userId ?? null,
        kind: input.kind,
        severity: input.severity ?? 'info',
        detail: input.detail,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error('[security] failed to persist security event', input.kind, error);
  }
}

/** Audit action names used across the platform, kept in one place. */
export const AUDIT = {
  LOGIN: 'AUTH_LOGIN',
  LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  LOGOUT: 'AUTH_LOGOUT',
  REGISTER: 'AUTH_REGISTER',
  PASSWORD_CHANGED: 'AUTH_PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'AUTH_PASSWORD_RESET_REQUESTED',
  MFA_ENABLED: 'AUTH_MFA_ENABLED',
  MFA_DISABLED: 'AUTH_MFA_DISABLED',
  REAUTH: 'AUTH_REAUTHENTICATED',
  SESSION_REVOKED: 'AUTH_SESSION_REVOKED',
  PERMISSION_DENIED: 'ACCESS_DENIED',

  COUNSELLING_REQUEST_CREATED: 'COUNSELLING_REQUEST_CREATED',
  COUNSELLING_ASSIGNED: 'COUNSELLING_ASSIGNED',
  COUNSELLING_ACCEPTED: 'COUNSELLING_ACCEPTED',
  COUNSELLING_DECLINED: 'COUNSELLING_DECLINED',
  COUNSELLING_SESSION_JOINED: 'COUNSELLING_SESSION_JOINED',
  COUNSELLING_SESSION_ENDED: 'COUNSELLING_SESSION_ENDED',
  COUNSELLING_SESSION_CANCELLED: 'COUNSELLING_SESSION_CANCELLED',
  SESSION_NOTE_CREATED: 'SESSION_NOTE_CREATED',
  SESSION_NOTE_ACCESSED: 'SESSION_NOTE_ACCESSED',

  CONNECTION_REQUESTED: 'CONNECTION_REQUESTED',
  CONNECTION_ACCEPTED: 'CONNECTION_ACCEPTED',
  CONNECTION_DECLINED: 'CONNECTION_DECLINED',
  USER_BLOCKED: 'USER_BLOCKED',
  USER_UNBLOCKED: 'USER_UNBLOCKED',
  REPORT_FILED: 'REPORT_FILED',
  REPORT_RESOLVED: 'REPORT_RESOLVED',
  REPORT_ESCALATED: 'REPORT_ESCALATED',

  SAFEGUARDING_CASE_OPENED: 'SAFEGUARDING_CASE_OPENED',
  SAFEGUARDING_CASE_ACCESSED: 'SAFEGUARDING_CASE_ACCESSED',
  SAFEGUARDING_CASE_UPDATED: 'SAFEGUARDING_CASE_UPDATED',

  USER_SUSPENDED: 'ADMIN_USER_SUSPENDED',
  USER_REINSTATED: 'ADMIN_USER_REINSTATED',
  USER_DELETED: 'ADMIN_USER_DELETED',
  USER_SESSIONS_REVOKED: 'ADMIN_USER_SESSIONS_REVOKED',
  DATA_EXPORTED: 'ADMIN_DATA_EXPORTED',

  COUNSELLOR_VERIFIED: 'ADMIN_COUNSELLOR_VERIFIED',
  COUNSELLOR_REJECTED: 'ADMIN_COUNSELLOR_REJECTED',
  COUNSELLOR_SUSPENDED: 'ADMIN_COUNSELLOR_SUSPENDED',

  CONTENT_PUBLISHED: 'ADMIN_CONTENT_PUBLISHED',
  CONTENT_ARCHIVED: 'ADMIN_CONTENT_ARCHIVED',
  EVENT_PUBLISHED: 'ADMIN_EVENT_PUBLISHED',
  EVENT_CANCELLED: 'ADMIN_EVENT_CANCELLED',
  ANNOUNCEMENT_SENT: 'ADMIN_ANNOUNCEMENT_SENT',

  ROLE_ASSIGNED: 'GOVERNANCE_ROLE_ASSIGNED',
  ROLE_REMOVED: 'GOVERNANCE_ROLE_REMOVED',
  PERMISSION_GRANTED: 'GOVERNANCE_PERMISSION_GRANTED',
  PERMISSION_REVOKED: 'GOVERNANCE_PERMISSION_REVOKED',
  HIERARCHY_CHANGED: 'GOVERNANCE_HIERARCHY_CHANGED',
  ADMIN_APPOINTED: 'GOVERNANCE_ADMIN_APPOINTED',
  ADMIN_REMOVED: 'GOVERNANCE_ADMIN_REMOVED',
  SETTING_CHANGED: 'GOVERNANCE_SETTING_CHANGED',
  EMERGENCY_CONTROL: 'GOVERNANCE_EMERGENCY_CONTROL',
  SUPPORT_MODE_STARTED: 'SUPPORT_MODE_STARTED',
  SUPPORT_MODE_ENDED: 'SUPPORT_MODE_ENDED',
} as const;
