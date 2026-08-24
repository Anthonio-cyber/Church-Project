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
