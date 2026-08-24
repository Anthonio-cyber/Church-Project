import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, assertSameOrigin, created, ok, parseBody, route } from '@/lib/api';
import { requireAuthorityOver, requirePermission, requireUser } from '@/lib/auth/context';
import { reasonSchema } from '@/lib/validation';
import { ROLE_RANK } from '@/lib/permissions';
import { AUDIT, writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * The church hierarchy.
 *
 * The tree records who holds which office, under whose supervision, in which
 * ministry centre, since when, and on whose authority. It is the church's own
 * governance record rather than a technical convenience — which is why every
 * change to it is written to an append-only hierarchy_changes trail alongside
 * the audit log.
 */
export const GET = route(async () => {
  await requirePermission('hierarchy.manage', {
    reason: 'Reviewing the church hierarchy.',
  });

  const nodes = await prisma.churchHierarchyNode.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    include: {
      user: { select: { id: true, email: true, status: true, mfaEnabled: true } },
      ministryCenter: { select: { id: true, name: true } },
      supervisor: { select: { id: true, personName: true, title: true } },
      reports: { select: { id: true, personName: true, title: true, status: true } },
      approvals: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  return ok({
    nodes: nodes.map((node) => ({
      id: node.id,
      userId: node.userId,
      personName: node.personName,
      title: node.title,
      ministryRole: node.ministryRole,
      administrativeRole: node.administrativeRole,
      rank: ROLE_RANK[node.administrativeRole] ?? 0,
      status: node.status,
      // Seed records stay visibly provisional until the organisation confirms
      // that the named person genuinely holds the office.
      isSeedPlaceholder: node.isSeedPlaceholder,
      organisationConfirmedAt: node.organisationConfirmedAt,
      startDate: node.startDate,
      endDate: node.endDate,
      notes: node.notes,
      supervisor: node.supervisor,
      reports: node.reports,
      ministryCenter: node.ministryCenter,
      account: node.user,
      recentChanges: node.approvals,
    })),
    notice:
      'Records flagged as seed placeholders are provisional. Confirm them with the organisation before treating them as an authorised statement of office.',
  });
});

const createSchema = z.object({
  userId: z.string().uuid().optional(),
  personName: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(120),
  ministryRole: z.string().trim().min(2).max(120),
  administrativeRole: z.enum([
    'USER', 'COUNSELLOR', 'PASTOR', 'MINISTRY_LEADER', 'MODERATOR',
    'COUNSELLING_ADMIN', 'CONTENT_ADMIN', 'EVENT_ADMIN', 'SAFEGUARDING_ADMIN',
    'ANALYTICS_ADMIN', 'ADMIN', 'SENIOR_LEADERSHIP_ADMIN', 'SUPER_ADMIN',
  ]),
  supervisorId: z.string().uuid().optional(),
  ministryCenterId: z.string().uuid().optional(),
  notes: z.string().trim().max(1000).optional(),
  reason: reasonSchema,
});

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const base = await requireUser();
  const input = await parseBody(request, createSchema);
  const context = await requirePermission('hierarchy.manage', {
    context: base,
    reason: input.reason,
  });

  // You may not create a position at or above your own level of authority.
  // This is the structural answer to "can a senior administrator quietly
  // create a second Super Admin?" — no, only the Setman can.
  if ((ROLE_RANK[input.administrativeRole] ?? 0) >= context.rank) {
    throw new ApiError(
      403,
      'insufficient_authority',
      'You cannot create a position at or above your own level of authority.',
    );
  }

  const node = await prisma.$transaction(async (tx) => {
    const createdNode = await tx.churchHierarchyNode.create({
      data: {
        userId: input.userId ?? null,
        personName: input.personName,
        title: input.title,
        ministryRole: input.ministryRole,
        administrativeRole: input.administrativeRole,
        supervisorId: input.supervisorId ?? null,
        ministryCenterId: input.ministryCenterId ?? null,
        notes: input.notes ?? null,
        status: 'PENDING_APPROVAL',
      },
    });
    await tx.hierarchyChange.create({
      data: {
        nodeId: createdNode.id,
        changeType: 'CREATED',
        newValue: {
          personName: input.personName,
          title: input.title,
          administrativeRole: input.administrativeRole,
        },
        reason: input.reason,
        actorId: context.user.id,
      },
    });
    return createdNode;
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.HIERARCHY_CHANGED,
    targetType: 'hierarchy_node',
    targetId: node.id,
    reason: input.reason,
    metadata: { changeType: 'CREATED', administrativeRole: input.administrativeRole },
    ipAddress: context.ipAddress,
  });

  return created({
    node,
    message:
      'Position created and awaiting approval. It does not confer any access until approved and a role is assigned.',
  });
});

const patchSchema = z.object({
  nodeId: z.string().uuid(),
  action: z.enum([
    'approve', 'suspend', 'reinstate', 'remove', 'archive',
    'set_supervisor', 'set_center', 'confirm_with_organisation',
  ]),
  supervisorId: z.string().uuid().nullable().optional(),
  ministryCenterId: z.string().uuid().nullable().optional(),
  reason: reasonSchema,
});

export const PATCH = route(async (request: Request) => {
  assertSameOrigin(request);
  const base = await requireUser();
  const input = await parseBody(request, patchSchema);
  const context = await requirePermission('hierarchy.manage', {
    context: base,
    reason: input.reason,
    targetType: 'hierarchy_node',
    targetId: input.nodeId,
  });

  const node = await prisma.churchHierarchyNode.findUnique({ where: { id: input.nodeId } });
  if (!node) throw new ApiError(404, 'not_found', 'That position could not be found.');

  // The rank guard again, this time on the existing position: a lower-ranking
  // administrator cannot suspend, remove or reassign someone above them.
  if ((ROLE_RANK[node.administrativeRole] ?? 0) >= context.rank) {
    throw new ApiError(
      403,
      'insufficient_authority',
      'This position holds equal or greater authority than you.',
    );
  }
  if (node.userId) {
    await requireAuthorityOver(context, node.userId);
  }

  const statusFor = {
    approve: 'ACTIVE',
    suspend: 'SUSPENDED',
    reinstate: 'ACTIVE',
    remove: 'REMOVED',
    archive: 'ARCHIVED',
  } as const;

  const data: Record<string, unknown> = {};
  let changeType = input.action.toUpperCase();

  if (input.action in statusFor) {
    data.status = statusFor[input.action as keyof typeof statusFor];
    if (input.action === 'remove') data.endDate = new Date();
  } else if (input.action === 'set_supervisor') {
    if (input.supervisorId === input.nodeId) {
      throw new ApiError(400, 'invalid_supervisor', 'A position cannot supervise itself.');
    }
    data.supervisorId = input.supervisorId ?? null;
    changeType = 'SET_SUPERVISOR';
  } else if (input.action === 'set_center') {
    data.ministryCenterId = input.ministryCenterId ?? null;
    changeType = 'SET_CENTER';
  } else if (input.action === 'confirm_with_organisation') {
    data.isSeedPlaceholder = false;
    data.organisationConfirmedAt = new Date();
    changeType = 'ORGANISATION_CONFIRMED';
  }

  await prisma.$transaction(async (tx) => {
    await tx.churchHierarchyNode.update({ where: { id: input.nodeId }, data });
    await tx.hierarchyChange.create({
      data: {
        nodeId: input.nodeId,
        changeType,
        previousValue: {
          status: node.status,
          supervisorId: node.supervisorId,
          ministryCenterId: node.ministryCenterId,
          isSeedPlaceholder: node.isSeedPlaceholder,
        },
        newValue: data as never,
        reason: input.reason,
        actorId: context.user.id,
      },
    });
  });

  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    actorRole: context.roles.join(','),
    action: AUDIT.HIERARCHY_CHANGED,
    targetType: 'hierarchy_node',
    targetId: input.nodeId,
    reason: input.reason,
    metadata: { changeType },
    ipAddress: context.ipAddress,
  });

  return ok({ message: 'Hierarchy updated and the change recorded.' });
});
