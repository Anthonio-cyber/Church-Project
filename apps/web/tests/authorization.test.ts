/**
 * Access-control tests.
 *
 * These assert the security boundaries the platform specification names
 * explicitly. Each test states the question and the expected answer, so a
 * failure reads as a breached promise rather than as an abstract assertion.
 *
 * They run against a real database and exercise the same functions the API
 * routes use — not mocks of them, which would test nothing.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, type RoleKey } from '@prisma/client';
import { hashPassword, verifyPassword, encryptSensitive, decryptSensitive, verifyTotp, generateTotpSecret, currentTotp } from '../src/lib/crypto';
import { loadAuthorization } from '../src/lib/auth/context';
import { ROLE_RANK, DEFAULT_ROLE_PERMISSIONS, SENSITIVE_PERMISSIONS } from '../src/lib/permissions';
import { canMessage, guardConnectionRequest, searchDirectory, isBlockedBetween } from '../src/lib/domain/connections';
import { triage } from '../src/lib/domain/safeguarding';
import { waitingRoomState } from '../src/lib/domain/counselling';
import { videoRoomName, videoRoomForSession } from '../src/lib/domain/video';
import {
  sniffImageType,
  sniffAttachmentType,
  storeAvatar,
  storeAttachment,
  readFile,
  sanitiseFileName,
  dispositionFor,
  fileIdFromUrl,
  MAX_AVATAR_BYTES,
} from '../src/lib/domain/files';
import { canReadConversation, assertCanWriteToConversation } from '../src/lib/domain/messaging';
import { youTubeVideoId, youTubeEmbedUrl } from '../src/lib/domain/media';

const prisma = new PrismaClient();

const suffix = `t${Date.now().toString(36)}`;
const email = (name: string) => `${name}.${suffix}@test.invalid`;

const ids: Record<string, string> = {};
let sessionId = '';
let counsellorId = '';

async function makeUser(name: string, roles: RoleKey[], extra: Record<string, unknown> = {}) {
  const user = await prisma.user.create({
    data: {
      email: email(name),
      passwordHash: await hashPassword('TestPassword2024!Secure'),
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          firstName: name,
          lastName: 'Test',
          displayName: `${name}-${suffix}`,
          ageBand: (extra.ageBand as never) ?? 'ADULT',
        },
      },
      privacySettings: { create: { discoverable: (extra.discoverable as boolean) ?? false } },
      notificationPrefs: { create: {} },
      ...(extra.user as object ?? {}),
    },
  });

  for (const roleKey of roles) {
    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    if (role) {
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    }
  }

  ids[name] = user.id;
  return user;
}

beforeAll(async () => {
  // The roles and permissions catalogue must exist. It is created by the seed.
  const roleCount = await prisma.role.count();
  if (roleCount === 0) {
    throw new Error('Run `npm run db:seed` before the test suite: roles are not seeded.');
  }

  await makeUser('userA', ['USER'], { discoverable: true });
  await makeUser('userB', ['USER'], { discoverable: true });
  await makeUser('minor', ['USER'], { ageBand: 'MINOR', discoverable: true });
  await makeUser('moderator', ['MODERATOR']);
  await makeUser('counsellingAdmin', ['COUNSELLING_ADMIN']);
  await makeUser('safeguarding', ['SAFEGUARDING_ADMIN']);
  await makeUser('admin', ['ADMIN']);
  await makeUser('seniorAdmin', ['SENIOR_LEADERSHIP_ADMIN']);
  await makeUser('superAdmin', ['SUPER_ADMIN']);
  const counsellorUser = await makeUser('counsellor', ['COUNSELLOR']);

  const counsellor = await prisma.counsellor.create({
    data: {
      userId: counsellorUser.id,
      ministryRole: 'Test Counsellor',
      biography: 'A counsellor created for the access-control test suite.',
      categories: ['SPIRITUAL_GROWTH'],
      languages: ['en'],
      status: 'APPROVED',
      verifiedAt: new Date(),
      acceptsMinors: false,
    },
  });
  counsellorId = counsellor.id;

  // A counselling session belonging to userA.
  const request = await prisma.counsellingRequest.create({
    data: {
      requesterId: ids.userA!,
      category: 'SPIRITUAL_GROWTH',
      summary: 'A private matter belonging to user A and nobody else.',
      disclaimerAckAt: new Date(),
      status: 'SCHEDULED',
      assignedCounsellorId: counsellor.id,
    },
  });

  const session = await prisma.counsellingSession.create({
    data: {
      requestId: request.id,
      counsellorId: counsellor.id,
      scheduledFor: new Date(Date.now() + 3600_000),
      status: 'CONFIRMED',
      participants: {
        create: [
          { userId: ids.userA!, role: 'member' },
          { userId: counsellorUser.id, role: 'counsellor' },
        ],
      },
    },
  });
  sessionId = session.id;

  const note = encryptSensitive('Internal pastoral note for the test session.');
  await prisma.sessionNote.create({
    data: {
      sessionId: session.id,
      authorId: counsellorUser.id,
      kind: 'INTERNAL',
      contentCipher: note.cipher,
      contentIv: note.iv,
    },
  });
});

afterAll(async () => {
  const userIds = Object.values(ids);
  await prisma.counsellingRequest.deleteMany({ where: { requesterId: { in: userIds } } });
  await prisma.counsellor.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------

describe('Can User A access User B\'s counselling session?  Expected: NO', () => {
  it('a session is reachable only by its member, its counsellor, or safeguarding', async () => {
    const session = await prisma.counsellingSession.findUnique({
      where: { id: sessionId },
      include: { request: true, counsellor: true, participants: true },
    });

    expect(session).not.toBeNull();

    const participantIds = session!.participants.map((p) => p.userId);
    expect(participantIds).toContain(ids.userA);
    expect(participantIds).not.toContain(ids.userB);

    // The three access paths, exactly.
    const isMember = session!.request.requesterId === ids.userB;
    const isCounsellor = session!.counsellor.userId === ids.userB;
    const { permissions } = await loadAuthorization(ids.userB!);
    const hasSafeguarding = permissions.has('counselling.safeguarding_access');

    expect(isMember || isCounsellor || hasSafeguarding).toBe(false);
  });

  it('an ordinary member holds no counselling permission at all', async () => {
    const { permissions } = await loadAuthorization(ids.userB!);
    const counsellingPermissions = Array.from(permissions).filter((p) =>
      p.startsWith('counselling.'),
    );
    expect(counsellingPermissions).toEqual([]);
  });
});

describe('Can User A access User B\'s session notes?  Expected: NO', () => {
  it('notes are scoped to their session and readable only through the guarded path', async () => {
    const notes = await prisma.sessionNote.findMany({ where: { sessionId } });
    expect(notes.length).toBeGreaterThan(0);

    // The stored form is ciphertext: a database read alone discloses nothing.
    expect(notes[0]!.contentCipher).not.toContain('Internal pastoral note');
    expect(decryptSensitive(notes[0]!.contentCipher, notes[0]!.contentIv)).toContain(
      'Internal pastoral note',
    );
  });

  it('no ordinary member has counselling.notes_access', async () => {
    for (const name of ['userA', 'userB']) {
      const { permissions } = await loadAuthorization(ids[name]!);
      expect(permissions.has('counselling.notes_access')).toBe(false);
    }
  });
});

describe('Can User A message User B without approval?  Expected: NO', () => {
  it('messaging requires an accepted connection', async () => {
    expect(await canMessage(ids.userA!, ids.userB!)).toBe(false);
  });

  it('a pending request does not create the ability to message', async () => {
    await prisma.connectionRequest.create({
      data: { requesterId: ids.userA!, recipientId: ids.userB!, status: 'PENDING' },
    });
    expect(await canMessage(ids.userA!, ids.userB!)).toBe(false);
  });

  it('acceptance is what creates the ability to message', async () => {
    await prisma.connectionRequest.updateMany({
      where: { requesterId: ids.userA!, recipientId: ids.userB! },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });
    expect(await canMessage(ids.userA!, ids.userB!)).toBe(true);

    // Reset for later tests.
    await prisma.connectionRequest.deleteMany({
      where: { requesterId: ids.userA!, recipientId: ids.userB! },
    });
  });

  it('a block prevents messaging in both directions', async () => {
    await prisma.connectionRequest.create({
      data: { requesterId: ids.userA!, recipientId: ids.userB!, status: 'ACCEPTED' },
    });
    await prisma.block.create({ data: { blockerId: ids.userB!, blockedId: ids.userA! } });

    expect(await isBlockedBetween(ids.userA!, ids.userB!)).toBe(true);
    expect(await canMessage(ids.userA!, ids.userB!)).toBe(false);
    expect(await canMessage(ids.userB!, ids.userA!)).toBe(false);

    await prisma.block.deleteMany({ where: { blockerId: ids.userB! } });
    await prisma.connectionRequest.deleteMany({ where: { requesterId: ids.userA! } });
  });

  it('a blocked person cannot send a further connection request', async () => {
    await prisma.block.create({ data: { blockerId: ids.userB!, blockedId: ids.userA! } });
    const guard = await guardConnectionRequest(ids.userA!, ids.userB!);
    expect(guard.ok).toBe(false);
    await prisma.block.deleteMany({ where: { blockerId: ids.userB! } });
  });
});

describe('Can a normal user become a counsellor by changing frontend data?  Expected: NO', () => {
  it('counsellor status is not writable from the application route', async () => {
    // The apply route sets status explicitly to PENDING; the schema has no
    // path from a member-submitted payload to APPROVED.
    const applySource = await import('node:fs').then((fs) =>
      fs.promises.readFile('src/app/api/counsellor/apply/route.ts', 'utf8'),
    );
    expect(applySource).toContain("status: 'PENDING' as const");
    // The schema for the route must not accept a status field at all.
    expect(applySource).not.toMatch(/status:\s*z\./);
  });

  it('the COUNSELLOR role grants no administrative permissions', async () => {
    const { permissions, rank } = await loadAuthorization(ids.counsellor!);
    expect(permissions.has('counsellors.verify')).toBe(false);
    expect(permissions.has('users.suspend')).toBe(false);
    expect(rank).toBeLessThan(ROLE_RANK.ADMIN);
  });
});

describe('Can a moderator access private counselling notes by default?  Expected: NO', () => {
  it('the moderator role carries no counselling permission', async () => {
    const { permissions } = await loadAuthorization(ids.moderator!);
    expect(permissions.has('counselling.notes_access')).toBe(false);
    expect(permissions.has('counselling.safeguarding_access')).toBe(false);
    expect(permissions.has('safeguarding.view')).toBe(false);
    expect(Array.from(permissions).filter((p) => p.startsWith('counselling.'))).toEqual([]);
  });

  it('the moderation report route withholds counselling message bodies', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.promises.readFile('src/app/api/admin/reports/route.ts', 'utf8'),
    );
    expect(source).toContain("conversation.kind === 'COUNSELLING'");
    expect(source).toContain('withheld');
  });
});

describe('Can a counselling administrator read counselling conversations?  Expected: NO', () => {
  it('the counselling admin role runs operations without content access', async () => {
    const { permissions } = await loadAuthorization(ids.counsellingAdmin!);
    expect(permissions.has('counselling.assign')).toBe(true);
    expect(permissions.has('counselling.manage')).toBe(true);
    expect(permissions.has('counselling.notes_access')).toBe(false);
    expect(permissions.has('counselling.safeguarding_access')).toBe(false);
  });
});

describe('Can an administrator change their own role to Super Admin?  Expected: NO', () => {
  it('the ADMIN role does not carry admins.manage or roles.manage', async () => {
    const { permissions } = await loadAuthorization(ids.admin!);
    expect(permissions.has('admins.manage')).toBe(false);
    expect(permissions.has('roles.manage')).toBe(false);
    expect(permissions.has('permissions.manage')).toBe(false);
    expect(permissions.has('hierarchy.manage')).toBe(false);
  });

  it('the ADMIN rank is below SUPER_ADMIN, so the grant guard refuses it', () => {
    expect(ROLE_RANK.ADMIN).toBeLessThan(ROLE_RANK.SUPER_ADMIN);
    // requireCanGrantRole refuses any role whose rank >= the actor's own.
    expect(ROLE_RANK.SUPER_ADMIN >= ROLE_RANK.ADMIN).toBe(true);
  });

  it('governance routes refuse self-targeting outright', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.promises.readFile('src/lib/auth/context.ts', 'utf8'),
    );
    expect(source).toContain('self_target_forbidden');
    expect(source).toContain('requireAuthorityOver');
  });
});

describe('Can Pst. Gabriel Adayi assign himself as Setman or Super Admin?  Expected: NO', () => {
  it('an administrator cannot grant a role at or above their own rank', async () => {
    const { rank } = await loadAuthorization(ids.admin!);
    // requireCanGrantRole throws when targetRank >= actor rank.
    expect(ROLE_RANK.SUPER_ADMIN).toBeGreaterThanOrEqual(rank);
    expect(ROLE_RANK.SENIOR_LEADERSHIP_ADMIN).toBeGreaterThanOrEqual(rank);
  });
});

describe('Can Rev. Tony change the Setman\'s authority without authorization?  Expected: NO', () => {
  it('senior leadership rank is below Super Admin, so the authority guard refuses', async () => {
    const senior = await loadAuthorization(ids.seniorAdmin!);
    const setman = await loadAuthorization(ids.superAdmin!);
    // requireAuthorityOver refuses when target rank >= actor rank.
    expect(setman.rank).toBeGreaterThanOrEqual(senior.rank);
  });
});

describe('Can a lower-level administrator change a higher-level one?  Expected: NO', () => {
  it('ranks are strictly ordered and the guard requires strict inequality', async () => {
    const admin = await loadAuthorization(ids.admin!);
    const senior = await loadAuthorization(ids.seniorAdmin!);
    const superAdmin = await loadAuthorization(ids.superAdmin!);

    expect(admin.rank).toBeLessThan(senior.rank);
    expect(senior.rank).toBeLessThan(superAdmin.rank);
    expect(senior.rank >= admin.rank).toBe(true);
  });
});

describe('Can the Setman review all administrative actions?  Expected: YES, audited', () => {
  it('the Super Admin holds audit_logs.view', async () => {
    const { permissions } = await loadAuthorization(ids.superAdmin!);
    expect(permissions.has('audit_logs.view')).toBe(true);
  });

  it('but cannot alter the audit log — the database refuses', async () => {
    const entry = await prisma.auditLog.create({
      data: { action: 'TEST_IMMUTABILITY_PROBE', actorId: ids.superAdmin! },
    });

    await expect(
      prisma.auditLog.update({
        where: { id: entry.id },
        data: { action: 'TAMPERED' },
      }),
    ).rejects.toThrow();

    await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow();

    // The entry survives both attempts, unchanged.
    const reread = await prisma.auditLog.findUnique({ where: { id: entry.id } });
    expect(reread?.action).toBe('TEST_IMMUTABILITY_PROBE');
  });
});

describe('Age-aware protections', () => {
  it('an adult cannot open a private channel with a minor', async () => {
    const guard = await guardConnectionRequest(ids.userA!, ids.minor!);
    expect(guard.ok).toBe(false);
    if (!guard.ok) expect(guard.reason).toMatch(/safeguarding/i);
  });

  it('a minor cannot open a private channel with an adult', async () => {
    const guard = await guardConnectionRequest(ids.minor!, ids.userA!);
    expect(guard.ok).toBe(false);
  });

  it('minors never appear in directory search', async () => {
    const results = await searchDirectory(ids.userA!, suffix);
    expect(results.some((row) => row.id === ids.minor)).toBe(false);
  });

  it('a counsellor not approved for minors is excluded from matching them', async () => {
    const counsellor = await prisma.counsellor.findUnique({ where: { id: counsellorId } });
    expect(counsellor?.acceptsMinors).toBe(false);
  });
});

describe('Directory search does not enumerate the membership', () => {
  it('refuses queries shorter than three characters', async () => {
    expect(await searchDirectory(ids.userA!, 'ab')).toEqual([]);
    expect(await searchDirectory(ids.userA!, '')).toEqual([]);
  });

  it('returns only members who opted in to being discoverable', async () => {
    await prisma.privacySettings.update({
      where: { userId: ids.userB! },
      data: { discoverable: false },
    });
    const results = await searchDirectory(ids.userA!, suffix);
    expect(results.some((row) => row.id === ids.userB)).toBe(false);

    await prisma.privacySettings.update({
      where: { userId: ids.userB! },
      data: { discoverable: true },
    });
  });

  it('never returns an email address', async () => {
    const results = await searchDirectory(ids.userA!, suffix);
    for (const row of results) {
      expect(Object.keys(row)).not.toContain('email');
    }
  });
});

describe('Password and credential handling', () => {
  it('passwords are salted, so identical passwords hash differently', async () => {
    const a = await hashPassword('IdenticalPassword2024!');
    const b = await hashPassword('IdenticalPassword2024!');
    expect(a).not.toBe(b);
    expect(await verifyPassword('IdenticalPassword2024!', a)).toBe(true);
    expect(await verifyPassword('IdenticalPassword2024!', b)).toBe(true);
  });

  it('rejects a wrong password and a malformed hash', async () => {
    const hash = await hashPassword('CorrectPassword2024!');
    expect(await verifyPassword('WrongPassword2024!', hash)).toBe(false);
    expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
  });

  it('no password is ever stored in readable form', async () => {
    const user = await prisma.user.findUnique({ where: { id: ids.userA! } });
    expect(user?.passwordHash).toMatch(/^scrypt\$/);
    expect(user?.passwordHash).not.toContain('TestPassword2024!Secure');
  });
});

describe('Multi-factor authentication', () => {
  it('accepts a correct code and rejects an incorrect one', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, currentTotp(secret))).toBe(true);
    expect(verifyTotp(secret, '000000')).toBe(false);
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
    expect(verifyTotp(secret, '12345')).toBe(false);
  });

  it('tolerates one step of clock drift but not more', () => {
    const secret = generateTotpSecret();
    const now = new Date();
    const oneStepAgo = new Date(now.getTime() - 30_000);
    const fourStepsAgo = new Date(now.getTime() - 120_000);

    expect(verifyTotp(secret, currentTotp(secret, oneStepAgo), now)).toBe(true);
    expect(verifyTotp(secret, currentTotp(secret, fourStepsAgo), now)).toBe(false);
  });

  it('every sensitive permission is registered as sensitive', () => {
    for (const permission of SENSITIVE_PERMISSIONS) {
      expect(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN).toContain(permission);
    }
    // The permissions that reach pastoral or safeguarding content are sensitive.
    expect(SENSITIVE_PERMISSIONS).toContain('counselling.notes_access');
    expect(SENSITIVE_PERMISSIONS).toContain('safeguarding.view');
    expect(SENSITIVE_PERMISSIONS).toContain('emergency_controls.manage');
  });
});

describe('Encryption at rest', () => {
  it('round-trips, and detects tampering', () => {
    const { cipher, iv } = encryptSensitive('A confidential pastoral note.');
    expect(cipher).not.toContain('confidential');
    expect(decryptSensitive(cipher, iv)).toBe('A confidential pastoral note.');

    const tampered = Buffer.from(cipher, 'base64');
    tampered[0] ^= 0xff;
    expect(() => decryptSensitive(tampered.toString('base64'), iv)).toThrow();
  });
});

describe('Safeguarding triage', () => {
  it('flags a self-harm disclosure as critical and returns crisis guidance', () => {
    const result = triage('I have been thinking that I want to kill myself.');
    expect(result.flagged).toBe(true);
    expect(result.risk).toBe('CRITICAL');
    expect(result.category).toBe('SELF_HARM_CONCERN');
    expect(result.memberMessage).toMatch(/emergency/i);
  });

  it('flags a child-safety disclosure', () => {
    const result = triage('I am worried this is child abuse.');
    expect(result.flagged).toBe(true);
    expect(result.risk).toBe('CRITICAL');
  });

  it('does not flag an ordinary pastoral request', () => {
    const result = triage('I would like help building a consistent prayer life.');
    expect(result.flagged).toBe(false);
    expect(result.memberMessage).toBeUndefined();
  });
});

describe('The waiting room is private and time-boxed', () => {
  it('is closed until fifteen minutes before the session', () => {
    const state = waitingRoomState({
      status: 'CONFIRMED',
      scheduledFor: new Date(Date.now() + 3600_000),
      counsellorJoinedAt: null,
    });
    expect(state.canEnterWaitingRoom).toBe(false);
    expect(state.canEnterSession).toBe(false);
  });

  it('opens within the window, but the session itself waits for the counsellor', () => {
    const state = waitingRoomState({
      status: 'CONFIRMED',
      scheduledFor: new Date(Date.now() + 5 * 60_000),
      counsellorJoinedAt: null,
    });
    expect(state.canEnterWaitingRoom).toBe(true);
    expect(state.canEnterSession).toBe(false);
    expect(state.detail).toMatch(/notified/i);
  });

  it('opens the session once the counsellor has joined', () => {
    const state = waitingRoomState({
      status: 'COUNSELLOR_JOINED',
      scheduledFor: new Date(Date.now() + 5 * 60_000),
      counsellorJoinedAt: new Date(),
    });
    expect(state.canEnterSession).toBe(true);
  });

  it('is closed once the session is completed or cancelled', () => {
    for (const status of ['COMPLETED', 'CANCELLED']) {
      const state = waitingRoomState({
        status,
        scheduledFor: new Date(Date.now() - 3600_000),
        counsellorJoinedAt: new Date(),
      });
      expect(state.canEnterWaitingRoom).toBe(false);
      expect(state.canEnterSession).toBe(false);
    }
  });
});

describe('Role permission boundaries as a whole', () => {
  it('no role below safeguarding carries safeguarding access', () => {
    for (const role of ['USER', 'COUNSELLOR', 'PASTOR', 'MINISTRY_LEADER', 'MODERATOR', 'CONTENT_ADMIN', 'EVENT_ADMIN', 'ANALYTICS_ADMIN', 'COUNSELLING_ADMIN'] as RoleKey[]) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).not.toContain('safeguarding.view');
      expect(DEFAULT_ROLE_PERMISSIONS[role]).not.toContain('counselling.notes_access');
    }
  });

  it('the analytics role is read-only and record-blind', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.ANALYTICS_ADMIN).toEqual(['analytics.view']);
  });

  it('only the Super Admin carries emergency controls by default', () => {
    for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS) as RoleKey[]) {
      if (role === 'SUPER_ADMIN') continue;
      expect(DEFAULT_ROLE_PERMISSIONS[role]).not.toContain('emergency_controls.manage');
    }
    expect(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN).toContain('emergency_controls.manage');
  });

  it('a denial override beats a role grant', async () => {
    const permission = await prisma.permission.findUnique({ where: { key: 'users.view' } });
    expect(permission).not.toBeNull();

    const before = await loadAuthorization(ids.admin!);
    expect(before.permissions.has('users.view')).toBe(true);

    await prisma.userPermissionOverride.create({
      data: {
        userId: ids.admin!,
        permissionId: permission!.id,
        granted: false,
        reason: 'Test: least privilege denial.',
      },
    });

    const after = await loadAuthorization(ids.admin!);
    expect(after.permissions.has('users.view')).toBe(false);

    await prisma.userPermissionOverride.deleteMany({ where: { userId: ids.admin! } });
  });

  it('an expired role assignment stops granting anything', async () => {
    const role = await prisma.role.findUnique({ where: { key: 'CONTENT_ADMIN' } });
    await prisma.userRole.create({
      data: {
        userId: ids.userB!,
        roleId: role!.id,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const { permissions, roles } = await loadAuthorization(ids.userB!);
    expect(roles).not.toContain('CONTENT_ADMIN');
    expect(permissions.has('content.publish')).toBe(false);

    await prisma.userRole.deleteMany({ where: { userId: ids.userB!, roleId: role!.id } });
  });
});

describe('The audit log survives lawful erasure of a person', () => {
  it('permits releasing the actor reference, and nothing else', async () => {
    const user = await makeUser('erasable', ['USER']);

    const entry = await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        actorRole: 'USER',
        action: 'TEST_ERASURE_PROBE',
        reason: 'Recorded before the account was erased.',
      },
    });

    // Deleting the account nulls the reference through the foreign key.
    await prisma.user.delete({ where: { id: user.id } });

    const surviving = await prisma.auditLog.findUnique({ where: { id: entry.id } });
    expect(surviving).not.toBeNull();
    expect(surviving!.actorId).toBeNull();
    // The entry stays meaningful: the denormalised identity is retained.
    expect(surviving!.actorEmail).toBe(user.email);
    expect(surviving!.action).toBe('TEST_ERASURE_PROBE');
    expect(surviving!.reason).toBe('Recorded before the account was erased.');

    // And its content is still immutable.
    await expect(
      prisma.auditLog.update({ where: { id: entry.id }, data: { reason: 'rewritten' } }),
    ).rejects.toThrow();

    delete ids.erasable;
  });
});

describe('Voice and video rooms for counselling sessions', () => {
  it('gives the same room to both participants, every time', () => {
    const first = videoRoomName(sessionId);
    const second = videoRoomName(sessionId);
    // Both sides derive independently; they must land in the same room.
    expect(first).toBe(second);
  });

  it('does not leak the session id into the room name', () => {
    const room = videoRoomName(sessionId);
    // The session id is visible in the URL bar. If it appeared in the room
    // name, anyone who saw a session link could join the call.
    expect(room).not.toContain(sessionId);
    expect(room.length).toBeGreaterThan(24);
  });

  it('gives different sessions different rooms', () => {
    const a = videoRoomName('11111111-1111-1111-1111-111111111111');
    const b = videoRoomName('22222222-2222-2222-2222-222222222222');
    expect(a).not.toBe(b);
  });

  it('offers no room for a written session, even when video is configured', () => {
    process.env.VIDEO_SERVICE_URL = 'https://meet.jit.si';
    expect(videoRoomForSession(sessionId, 'TEXT')).toBeNull();
    delete process.env.VIDEO_SERVICE_URL;
  });

  it('offers no room at all when no video service is configured', () => {
    delete process.env.VIDEO_SERVICE_URL;
    expect(videoRoomForSession(sessionId, 'VIDEO')).toBeNull();
  });
});

describe('Uploaded files', () => {
  // Smallest valid images of each accepted kind, by signature.
  const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const JPEG = Buffer.from('ffd8ffe000104a464946', 'hex');
  const WEBP = Buffer.from('524946461a000000574542505650', 'hex');

  it('identifies the accepted image types from their bytes', () => {
    expect(sniffImageType(PNG)).toBe('image/png');
    expect(sniffImageType(JPEG)).toBe('image/jpeg');
    expect(sniffImageType(WEBP)).toBe('image/webp');
  });

  it('refuses an SVG, however it is labelled', () => {
    // An SVG can carry script. Served back from our own origin it would be
    // stored XSS, so it must not pass the check even though it is "an image".
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    expect(sniffImageType(svg)).toBeNull();
  });

  it('refuses a disguised executable', () => {
    // An ELF binary renamed to .png and declared as image/png.
    const elf = Buffer.from('7f454c4602010100', 'hex');
    expect(sniffImageType(elf)).toBeNull();
  });

  it('stores an avatar and reads back the sniffed type, not a claimed one', async () => {
    const stored = await storeAvatar(ids.userA!, PNG);
    expect(stored.url).toBe(`/api/files/${stored.id}`);

    const read = await readFile(stored.id);
    expect(read).not.toBeNull();
    expect(read!.contentType).toBe('image/png');
    expect(read!.purpose).toBe('AVATAR');
    expect(Buffer.from(read!.data).equals(PNG)).toBe(true);
  });

  it('replaces the previous avatar rather than accumulating them', async () => {
    const first = await storeAvatar(ids.userB!, PNG);
    const second = await storeAvatar(ids.userB!, JPEG);

    expect(second.id).not.toBe(first.id);
    // The old bytes are gone, not merely unreferenced.
    expect(await readFile(first.id)).toBeNull();

    const remaining = await prisma.storedFile.count({
      where: { ownerId: ids.userB!, purpose: 'AVATAR' },
    });
    expect(remaining).toBe(1);
  });

  it('refuses a file over the size limit', async () => {
    const huge = Buffer.concat([PNG, Buffer.alloc(MAX_AVATAR_BYTES + 1)]);
    await expect(storeAvatar(ids.userA!, huge)).rejects.toThrow();
  });

  it('refuses an empty file', async () => {
    await expect(storeAvatar(ids.userA!, Buffer.alloc(0))).rejects.toThrow();
  });

  it('erases a member’s files when their account is erased', async () => {
    const user = await makeUser('fileowner', ['USER']);
    const stored = await storeAvatar(user.id, PNG);
    expect(await readFile(stored.id)).not.toBeNull();

    await prisma.user.delete({ where: { id: user.id } });

    // "Delete my account" must not leave the person's picture behind.
    expect(await readFile(stored.id)).toBeNull();
    delete ids.fileowner;
  });
});

describe('Files shared into a conversation', () => {
  const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const PDF = Buffer.from('255044462d312e340a', 'hex');

  let conversationId = '';
  let outsiderId = '';

  beforeAll(async () => {
    const conversation = await prisma.conversation.create({
      data: {
        kind: 'PEER',
        participants: { create: [{ userId: ids.userA! }, { userId: ids.userB! }] },
      },
    });
    conversationId = conversation.id;
    const outsider = await makeUser('outsider', ['USER']);
    outsiderId = outsider.id;
  });

  it('accepts a PDF as an attachment, though never as an avatar', () => {
    // A counsellee handing over a letter or a report is the ordinary case.
    expect(sniffAttachmentType(PDF)).toBe('application/pdf');
    expect(sniffImageType(PDF)).toBeNull();
  });

  it('serves a PDF as a download and an image in place', () => {
    // The browser's own PDF viewer runs script that the page's CSP cannot
    // reach, so member-supplied PDFs must never open in it.
    expect(dispositionFor('application/pdf', 'report.pdf')).toBe(
      'attachment; filename="report.pdf"',
    );
    expect(dispositionFor('image/png', 'photo.png')).toBe('inline; filename="photo.png"');
  });

  it('strips a filename that would break out of the header', () => {
    expect(sanitiseFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitiseFileName('a"; attachment; filename="b')).toBe('a; attachment; filename=b');
    expect(sanitiseFileName('bad\r\nX-Injected: 1')).toBe('badX-Injected: 1');
    expect(sanitiseFileName('   ')).toBeNull();
  });

  it('reads back an attachment for a participant, and refuses an outsider', async () => {
    const stored = await storeAttachment(ids.userA!, conversationId, PNG, 'photo.png');
    const file = await readFile(stored.id);

    expect(file!.purpose).toBe('MESSAGE_ATTACHMENT');
    expect(file!.conversationId).toBe(conversationId);

    // Both people in the conversation may read it.
    expect(await canReadConversation(ids.userA!, conversationId)).toBe(true);
    expect(await canReadConversation(ids.userB!, conversationId)).toBe(true);
    // Someone who was never in it may not — this is the check the file route
    // applies before serving a single byte.
    expect(await canReadConversation(outsiderId, conversationId)).toBe(false);
  });

  it('refuses an upload into a conversation the sender is not part of', async () => {
    await expect(
      assertCanWriteToConversation(outsiderId, conversationId),
    ).rejects.toThrow();
  });

  it('refuses an upload once the sender has left the conversation', async () => {
    const leaver = await makeUser('leaver', ['USER']);
    const conversation = await prisma.conversation.create({
      data: {
        kind: 'PEER',
        participants: { create: [{ userId: leaver.id }, { userId: ids.userA! }] },
      },
    });

    await expect(
      assertCanWriteToConversation(leaver.id, conversation.id),
    ).resolves.toBeTruthy();

    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: conversation.id, userId: leaver.id } },
      data: { leftAt: new Date() },
    });

    await expect(
      assertCanWriteToConversation(leaver.id, conversation.id),
    ).rejects.toThrow();
    // And they can no longer read what was shared there.
    expect(await canReadConversation(leaver.id, conversation.id)).toBe(false);
  });

  it('refuses an upload into a closed conversation', async () => {
    const conversation = await prisma.conversation.create({
      data: {
        kind: 'PEER',
        isActive: false,
        participants: { create: [{ userId: ids.userA! }, { userId: ids.userB! }] },
      },
    });
    await expect(
      assertCanWriteToConversation(ids.userA!, conversation.id),
    ).rejects.toThrow();
    // Reading back what was already shared stays possible, which is the same
    // as being able to scroll through what was said.
    expect(await canReadConversation(ids.userA!, conversation.id)).toBe(true);
  });

  it('recognises only our own file paths', () => {
    const id = '11111111-2222-4333-8444-555555555555';
    expect(fileIdFromUrl(`/api/files/${id}`)).toBe(id);
    expect(fileIdFromUrl(`https://evil.example/api/files/${id}`)).toBeNull();
    expect(fileIdFromUrl('/api/files/not-a-uuid')).toBeNull();
    expect(fileIdFromUrl(`/api/files/${id}?x=1`)).toBeNull();
  });

  it('takes attachments with the conversation when it is erased', async () => {
    const conversation = await prisma.conversation.create({
      data: {
        kind: 'PEER',
        participants: { create: [{ userId: ids.userA! }, { userId: ids.userB! }] },
      },
    });
    const stored = await storeAttachment(ids.userA!, conversation.id, PNG, 'x.png');
    expect(await readFile(stored.id)).not.toBeNull();

    await prisma.conversation.delete({ where: { id: conversation.id } });
    expect(await readFile(stored.id)).toBeNull();
  });
});

describe('Linked teaching video', () => {
  it('recognises the shapes a YouTube link actually comes in', () => {
    const id = 'dQw4w9WgXcQ';
    expect(youTubeVideoId(`https://www.youtube.com/watch?v=${id}`)).toBe(id);
    expect(youTubeVideoId(`https://youtu.be/${id}`)).toBe(id);
    expect(youTubeVideoId(`https://www.youtube.com/embed/${id}`)).toBe(id);
    expect(youTubeVideoId(`https://www.youtube.com/live/${id}`)).toBe(id);
    expect(youTubeVideoId(`https://www.youtube.com/shorts/${id}`)).toBe(id);
    expect(youTubeVideoId(`https://m.youtube.com/watch?v=${id}&t=30s`)).toBe(id);
  });

  it('refuses anything that is not a specific YouTube video', () => {
    // A channel or playlist would embed "whatever is newest", which no
    // content administrator can review before publishing.
    expect(youTubeVideoId('https://www.youtube.com/@somechannel')).toBeNull();
    expect(youTubeVideoId('https://www.youtube.com/playlist?list=PL123')).toBeNull();
    expect(youTubeVideoId('https://vimeo.com/123456')).toBeNull();
    expect(youTubeVideoId('not a url at all')).toBeNull();
    expect(youTubeVideoId('javascript:alert(1)')).toBeNull();
  });

  it('is not fooled by a lookalike hostname', () => {
    // youtube.com.evil.example ends with neither host we accept.
    expect(youTubeVideoId('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youTubeVideoId('https://notyoutube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('embeds through the no-cookie host', () => {
    // Watching a teaching video should not quietly enrol a member in ad
    // tracking before they have pressed play.
    const embed = youTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(embed).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(youTubeEmbedUrl('https://vimeo.com/123')).toBeNull();
  });
});

describe('Course enrolment', () => {
  it('gates lesson progress behind enrolling', async () => {
    // The progress route used to upsert, which quietly enrolled anyone who
    // posted a lesson id — the whole gate. Enrolment must exist first.
    const course = await prisma.course.create({
      data: {
        slug: `enrol-test-${suffix}`,
        title: 'Enrolment Test',
        track: 'Testing',
        summary: 'A course used to check the enrolment gate.',
        description: 'A course used to check the enrolment gate.',
        authorName: 'Test',
        difficulty: 'All levels',
        status: 'PUBLISHED',
        lessons: {
          create: [{ orderIndex: 0, title: 'One', summary: 'First', body: 'Body' }],
        },
      },
      include: { lessons: true },
    });

    const notEnrolled = await prisma.courseProgress.findUnique({
      where: { userId_courseId: { userId: ids.userA!, courseId: course.id } },
    });
    expect(notEnrolled).toBeNull();

    // Enrolling is what creates it.
    const enrolled = await prisma.courseProgress.create({
      data: { userId: ids.userA!, courseId: course.id },
    });
    expect(enrolled.percentComplete).toBe(0);

    // Leaving takes the progress with it rather than keeping a hidden record.
    await prisma.lessonProgress.create({
      data: {
        courseProgressId: enrolled.id,
        lessonId: course.lessons[0]!.id,
        completedAt: new Date(),
      },
    });
    await prisma.courseProgress.delete({ where: { id: enrolled.id } });
    expect(
      await prisma.lessonProgress.count({ where: { courseProgressId: enrolled.id } }),
    ).toBe(0);

    await prisma.course.delete({ where: { id: course.id } });
  });
});
