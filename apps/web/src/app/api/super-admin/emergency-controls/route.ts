import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertSameOrigin, ok, parseBody, route } from '@/lib/api';
import { requirePermission, requireUser } from '@/lib/auth/context';
import { reasonSchema } from '@/lib/validation';
import { FEATURE_FLAGS, getAllFlags, setFlag, type FeatureFlagKey } from '@/lib/domain/settings';
import { AUDIT, writeAudit, writeSecurityEvent } from '@/lib/audit';
import { channels, publish } from '@/lib/realtime';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requirePermission('emergency_controls.manage', {
    reason: 'Reviewing emergency control state.',
  });

  const flags = await getAllFlags();
  const recent = await prisma.auditLog.findMany({
    where: { action: AUDIT.EMERGENCY_CONTROL },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { createdAt: true, actorEmail: true, reason: true, metadata: true },
  });

  return ok({
    controls: (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map((key) => ({
      key,
      ...FEATURE_FLAGS[key],
      enabled: flags[key],
    })),
    recentActivations: recent,
  });
});

const schema = z.object({
  action: z.enum([
    'set_flag',
    'require_global_password_reset',
    'revoke_all_sessions',
    'disable_ministry_center',
    'disable_administrator',
  ]),
  flagKey: z.enum(Object.keys(FEATURE_FLAGS) as [FeatureFlagKey, ...FeatureFlagKey[]]).optional(),
  enabled: z.boolean().optional(),
  targetId: z.string().uuid().optional(),
  /** Typed confirmation, so an emergency control cannot be triggered by a stray click. */
  confirmation: z.literal('CONFIRM'),
  reason: reasonSchema,
});

/**
 * Emergency controls.
 *
 * Each of these is a blunt instrument that exists so leadership can contain an
 * incident in minutes. Every one requires the emergency_controls.manage
 * permission (sensitive: MFA plus fresh re-authentication), a typed
 * confirmation, a written reason, and it is announced to senior leadership so
 * no one can act alone unnoticed.
 */
export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const base = await requireUser();
  const input = await parseBody(request, schema);

  const context = await requirePermission('emergency_controls.manage', {
    context: base,
    reason: input.reason,
    targetType: 'platform',
    targetId: input.targetId,
  });

  const auditBase = {
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.EMERGENCY_CONTROL,
    reason: input.reason,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  };

  let summary = '';

  switch (input.action) {
    case 'set_flag': {
      if (!input.flagKey || input.enabled === undefined) {
        return ok({ message: 'Nothing to change.' });
      }
      await setFlag(input.flagKey, input.enabled, context.user.id);
      summary = `${FEATURE_FLAGS[input.flagKey].label} ${input.enabled ? 'enabled' : 'DISABLED'}`;
      await writeAudit({
        ...auditBase,
        targetType: 'platform_setting',
        targetId: input.flagKey,
        metadata: { flag: input.flagKey, enabled: input.enabled },
      });
      break;
    }

    case 'require_global_password_reset': {
      const result = await prisma.user.updateMany({
        where: { status: { in: ['ACTIVE', 'PENDING_VERIFICATION'] } },
        data: { mustChangePassword: true },
      });
      await prisma.session.updateMany({
        where: { revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'global_password_reset' },
      });
      summary = `Global password reset required for ${result.count} account(s); all sessions revoked`;
      await writeAudit({ ...auditBase, metadata: { accounts: result.count } });
      break;
    }

    case 'revoke_all_sessions': {
      const result = await prisma.session.updateMany({
        where: { revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'emergency_revocation' },
      });
      summary = `All ${result.count} active session(s) revoked`;
      await writeAudit({ ...auditBase, metadata: { sessions: result.count } });
      break;
    }

    case 'disable_ministry_center': {
      if (!input.targetId) return ok({ message: 'Choose a ministry centre.' });
      await prisma.ministryCenter.update({
        where: { id: input.targetId },
        data: { isActive: false, disabledReason: input.reason },
      });
      summary = 'A ministry centre was disabled';
      await writeAudit({
        ...auditBase,
        targetType: 'ministry_center',
        targetId: input.targetId,
      });
      break;
    }

    case 'disable_administrator': {
      if (!input.targetId) return ok({ message: 'Choose an administrator.' });
      // Even in an emergency the hierarchy holds: you cannot disable someone at
      // or above your own level of authority.
      const { targetRank } = await import('@/lib/auth/context').then((m) =>
        m.requireAuthorityOver(context, input.targetId!),
      );
      await prisma.user.update({
        where: { id: input.targetId },
        data: { status: 'DISABLED', statusReason: `Emergency control: ${input.reason}` },
      });
      await prisma.session.updateMany({
        where: { userId: input.targetId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'emergency_disable' },
      });
      summary = 'An administrator account was disabled';
      await writeAudit({
        ...auditBase,
        targetType: 'user',
        targetId: input.targetId,
        metadata: { targetRank },
      });
      break;
    }
  }

  await writeSecurityEvent({
    userId: context.user.id,
    kind: 'ADMIN_ELEVATION',
    severity: 'critical',
    detail: `Emergency control used: ${summary}`,
    ipAddress: context.ipAddress,
  });

  publish(channels.securityAlerts(), 'emergency.control', {
    summary,
    actor: context.user.email,
    at: new Date().toISOString(),
  });

  // Leadership visibility: an emergency action is never silent.
  const leadership = await prisma.userRole.findMany({
    where: { role: { key: { in: ['SENIOR_LEADERSHIP_ADMIN', 'SUPER_ADMIN'] } } },
    select: { userId: true },
  });
  for (const leader of new Set(leadership.map((l) => l.userId))) {
    if (leader === context.user.id) continue;
    await notify({
      userId: leader,
      category: 'SECURITY',
      title: 'An emergency platform control was used',
      body: `${summary}. Reason recorded in the audit log.`,
      link: '/super-admin/emergency',
      isCritical: true,
      email: {
        subject: 'An emergency platform control was used',
        text: `${summary}\n\nBy: ${context.user.email}\nReason: ${input.reason}`,
      },
    });
  }

  return ok({ message: `${summary}. The action has been recorded and leadership notified.` });
});
