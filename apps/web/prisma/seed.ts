/**
 * Bootstrap data for 𝒾Pastor.
 *
 * This creates only what the platform needs to be usable by a real
 * organisation: the permission catalogue, the roles built from it, the
 * placeholder legal policies, and one Super Admin account so someone can
 * actually sign in and take it from there.
 *
 * It does not create any fictional people, churches, counsellors, courses,
 * events or content. Everything beyond the Super Admin account is created
 * from inside the platform itself, by the people who run it.
 *
 * Run with: npm run db:seed
 */

import { PrismaClient, type RoleKey } from '@prisma/client';
import { hashPassword } from '../src/lib/crypto';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  ROLE_RANK,
  SENSITIVE_PERMISSIONS,
  STAFF_ROLES,
} from '../src/lib/permissions';

const prisma = new PrismaClient();

/**
 * The first Super Admin account. Deliberately overridable — a real
 * deployment should set these via environment variables rather than trust a
 * value committed to source control, and MUST change this password (and
 * enrol MFA) on first sign-in.
 */
const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'tony@rcnglobal.com';
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'Tony1234';

async function main() {
  console.log('Seeding 𝒾Pastor…\n');

  // -------------------------------------------------------------------------
  // Permissions and roles
  // -------------------------------------------------------------------------
  console.log('  · permissions');
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: {
        key,
        description: PERMISSIONS[key],
        isSensitive: SENSITIVE_PERMISSIONS.includes(key),
      },
      update: {
        description: PERMISSIONS[key],
        isSensitive: SENSITIVE_PERMISSIONS.includes(key),
      },
    });
  }

  console.log('  · roles');
  for (const roleKey of Object.keys(ROLE_RANK) as RoleKey[]) {
    const role = await prisma.role.upsert({
      where: { key: roleKey },
      create: {
        key: roleKey,
        name: ROLE_LABEL[roleKey],
        description: ROLE_DESCRIPTION[roleKey],
        rank: ROLE_RANK[roleKey],
        isStaffRole: STAFF_ROLES.includes(roleKey),
      },
      update: {
        name: ROLE_LABEL[roleKey],
        description: ROLE_DESCRIPTION[roleKey],
        rank: ROLE_RANK[roleKey],
      },
    });

    // Role permissions are reconciled rather than appended, so removing a
    // permission from the catalogue actually removes it from the role.
    const desired = DEFAULT_ROLE_PERMISSIONS[roleKey];
    const permissions = await prisma.permission.findMany({
      where: { key: { in: desired } },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Policy versions — placeholder text; replace before real launch
  // -------------------------------------------------------------------------
  console.log('  · policy versions');

  for (const policy of [
    { key: 'terms', title: 'Terms of Use' },
    { key: 'privacy', title: 'Privacy Policy' },
    { key: 'safeguarding', title: 'Safeguarding Policy' },
    { key: 'counselling_disclaimer', title: 'Counselling Disclaimer' },
    { key: 'community_guidelines', title: 'Community Guidelines' },
  ]) {
    await prisma.policyVersion.upsert({
      where: { key_version: { key: policy.key, version: '1.0' } },
      create: {
        key: policy.key,
        version: '1.0',
        title: policy.title,
        body: `Initial version of the ${policy.title}. The deploying organisation's legal and privacy advisers should review and replace this text before launch.`,
      },
      update: {},
    });
  }

  // -------------------------------------------------------------------------
  // The first Super Admin
  // -------------------------------------------------------------------------
  console.log('  · super admin account');

  const passwordHash = await hashPassword(SUPER_ADMIN_PASSWORD);

  const superAdmin = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    create: {
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      isDemoAccount: false,
      isSeedPlaceholder: false,
      // MFA is required but not yet enrolled — the state a newly appointed
      // administrator is genuinely in. Every sensitive action stays blocked
      // until they enrol from Privacy & Security, by design.
      mfaRequired: true,
      profile: {
        create: {
          firstName: 'Tony',
          lastName: '',
          displayName: 'Tony',
        },
      },
      privacySettings: {
        create: { discoverable: false, publicProfile: false },
      },
      notificationPrefs: { create: {} },
    },
    update: { passwordHash, status: 'ACTIVE' },
  });

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { key: 'SUPER_ADMIN' },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: superAdminRole.id } },
    create: {
      userId: superAdmin.id,
      roleId: superAdminRole.id,
      reason: 'Seeded as the platform’s first Super Admin.',
    },
    update: {},
  });

  await prisma.consent.createMany({
    data: ['terms', 'privacy', 'counselling_disclaimer'].map((policyKey) => ({
      userId: superAdmin.id,
      policyKey,
      policyVersion: '1.0',
    })),
    skipDuplicates: true,
  });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\nSeed complete.\n');
  console.log('─'.repeat(78));
  console.log(`  Super Admin      ${SUPER_ADMIN_EMAIL}      ${SUPER_ADMIN_PASSWORD}`);
  console.log('─'.repeat(78));
  console.log(
    '\nThis is a temporary password. Sign in, then immediately:\n' +
      '  1. Privacy & Security → change the password.\n' +
      '  2. Privacy & Security → Multi-factor authentication → set up. Until you\n' +
      '     do, every sensitive action (hierarchy changes, appointments,\n' +
      '     emergency controls) stays blocked — that is deliberate.\n' +
      '  3. Super Admin → Church Hierarchy → add the real leadership structure.\n' +
      '  4. Super Admin → Administrators → appoint the real administrators.\n',
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
