import { prisma } from '@/lib/db';
import { route } from '@/lib/api';
import { requirePermission } from '@/lib/auth/context';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * A backup of the platform's data, as a file an administrator downloads.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT.
 * A backup that lives inside the thing it is backing up is not a backup. This
 * route therefore hands the data to a person, who keeps it somewhere else.
 * That is the part that makes it real; scheduling it away to object storage or
 * an email would need a destination this deployment does not have.
 *
 * WHAT IS DELIBERATELY LEFT OUT.
 * Counselling notes and safeguarding narratives are encrypted at rest under
 * DATA_ENCRYPTION_KEY, and are exported in that form — never decrypted here.
 * A backup file is exactly the artefact most likely to be copied onto a laptop
 * or a memory stick, and it must not be the one place those records exist in
 * plain text. Restoring them needs the key, which is why the deployment notes
 * say to keep it somewhere separate from the backups.
 *
 * Uploaded file bytes are omitted too — they would multiply the size of the
 * file by orders of magnitude, and their rows are exported so that a restore
 * knows what was missing.
 */
export const GET = route(async () => {
  const context = await requirePermission('data_governance.manage', {
    reason: 'Downloading a data backup.',
  });

  const [
    users,
    profiles,
    roles,
    userRoles,
    permissions,
    rolePermissions,
    userPermissionOverrides,
    hierarchy,
    ministryCenters,
    counsellors,
    counsellorAvailability,
    counsellingRequests,
    counsellingSessions,
    sessionParticipants,
    sessionNotes,
    conversations,
    conversationParticipants,
    messages,
    connectionRequests,
    blocks,
    reports,
    safeguardingCases,
    prayerRequests,
    courses,
    lessons,
    courseProgress,
    lessonProgress,
    resources,
    events,
    eventRegistrations,
    announcements,
    consents,
    policyVersions,
    dataRequests,
    auditLogs,
    securityEvents,
    storedFiles,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.profile.findMany(),
    prisma.role.findMany(),
    prisma.userRole.findMany(),
    prisma.permission.findMany(),
    prisma.rolePermission.findMany(),
    prisma.userPermissionOverride.findMany(),
    prisma.churchHierarchyNode.findMany(),
    prisma.ministryCenter.findMany(),
    prisma.counsellor.findMany(),
    prisma.counsellorAvailability.findMany(),
    prisma.counsellingRequest.findMany(),
    prisma.counsellingSession.findMany(),
    prisma.sessionParticipant.findMany(),
    prisma.sessionNote.findMany(),
    prisma.conversation.findMany(),
    prisma.conversationParticipant.findMany(),
    prisma.message.findMany(),
    prisma.connectionRequest.findMany(),
    prisma.block.findMany(),
    prisma.report.findMany(),
    prisma.safeguardingCase.findMany(),
    prisma.prayerRequest.findMany(),
    prisma.course.findMany(),
    prisma.lesson.findMany(),
    prisma.courseProgress.findMany(),
    prisma.lessonProgress.findMany(),
    prisma.resource.findMany(),
    prisma.event.findMany(),
    prisma.eventRegistration.findMany(),
    prisma.announcement.findMany(),
    prisma.consent.findMany(),
    prisma.policyVersion.findMany(),
    prisma.dataRequest.findMany(),
    prisma.auditLog.findMany(),
    prisma.securityEvent.findMany(),
    // Metadata only: the bytes are excluded on purpose.
    prisma.storedFile.findMany({
      select: {
        id: true,
        ownerId: true,
        conversationId: true,
        purpose: true,
        contentType: true,
        byteSize: true,
        fileName: true,
        createdAt: true,
      },
    }),
  ]);

  const backup = {
    format: 'ipastor.backup',
    formatVersion: 1,
    takenAt: new Date().toISOString(),
    takenBy: context.user.email,
    notes: [
      'Counselling notes and safeguarding narratives are included in their encrypted form.',
      'Restoring them requires DATA_ENCRYPTION_KEY, which is deliberately not in this file.',
      'Uploaded file contents are not included; their records are, so a restore knows what is missing.',
    ],
    data: {
      users,
      profiles,
      roles,
      userRoles,
      permissions,
      rolePermissions,
      userPermissionOverrides,
      hierarchy,
      ministryCenters,
      counsellors,
      counsellorAvailability,
      counsellingRequests,
      counsellingSessions,
      sessionParticipants,
      sessionNotes,
      conversations,
      conversationParticipants,
      messages,
      connectionRequests,
      blocks,
      reports,
      safeguardingCases,
      prayerRequests,
      courses,
      lessons,
      courseProgress,
      lessonProgress,
      resources,
      events,
      eventRegistrations,
      announcements,
      consents,
      policyVersions,
      dataRequests,
      auditLogs,
      securityEvents,
      storedFiles,
    },
  };

  // Taking a copy of everything is exactly the act that should never happen
  // unnoticed, so it is recorded like any other privileged action.
  await writeAudit({
    actorId: context.user.id,
    actorEmail: context.user.email,
    action: 'DATA_BACKUP_DOWNLOADED',
    targetType: 'platform',
    reason: 'Downloading a data backup.',
    ipAddress: context.ipAddress,
  });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return new Response(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="ipastor-backup-${stamp}.json"`,
    },
  });
});
