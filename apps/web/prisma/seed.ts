/**
 * Seed data for 𝒾Pastor.
 *
 * Everything created here is FICTIONAL DEMONSTRATION DATA. No real person's
 * private information appears in this file.
 *
 * Two categories of account are created:
 *
 *   DEMO ACCOUNTS — fictional members, counsellors, a moderator and
 *   administrators, flagged `isDemoAccount` so they are visibly marked
 *   throughout the interface. Their passwords are printed at the end of the
 *   seed run and are documented in the README. They exist so the platform can
 *   be explored end to end.
 *
 *   ADMINISTRATIVE SEED PLACEHOLDERS — the Setman, Rev. Tony and
 *   Pst. Gabriel Adayi hierarchy records named in the specification. These are
 *   flagged `isSeedPlaceholder` and their hierarchy nodes are created
 *   PENDING_APPROVAL and unconfirmed, so they never appear on the public
 *   leadership page and are visibly provisional in the Super Admin portal until
 *   the organisation confirms that those named people genuinely hold those
 *   offices.
 *
 * Run with: npm run db:seed
 */

import { PrismaClient, type RoleKey } from '@prisma/client';
import { hashPassword, encryptSensitive, humanReference } from '../src/lib/crypto';
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
 * Demo passwords.
 *
 * Deliberately long and obviously demonstration-only. Override with
 * SEED_DEMO_PASSWORD when seeding anything reachable from the internet, and
 * change or disable these accounts before a real launch.
 */
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'DemoPassword2024!Ministry';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'AdminDemo2024!Ministry';

type SeedPerson = {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  country: string;
  gender: 'MALE' | 'FEMALE' | 'UNSPECIFIED';
  roles: RoleKey[];
  password: string;
  isDemoAccount?: boolean;
  isSeedPlaceholder?: boolean;
  bio?: string;
  ageBand?: 'MINOR' | 'YOUNG_ADULT' | 'ADULT';
  discoverable?: boolean;
};

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
  // Ministry centres
  // -------------------------------------------------------------------------
  console.log('  · ministry centres');
  const centres = await Promise.all(
    [
      {
        name: 'Central Ministry Centre',
        slug: 'central',
        country: 'Nigeria',
        city: 'Abuja',
        description:
          'The central ministry centre, hosting teaching, prayer gatherings and counselling.',
        timezone: 'Africa/Lagos',
        contactEmail: 'central@example.org',
      },
      {
        name: 'Lagos Ministry Centre',
        slug: 'lagos',
        country: 'Nigeria',
        city: 'Lagos',
        description: 'Serving believers across Lagos with discipleship and pastoral care.',
        timezone: 'Africa/Lagos',
        contactEmail: 'lagos@example.org',
      },
      {
        name: 'London Ministry Centre',
        slug: 'london',
        country: 'United Kingdom',
        city: 'London',
        description: 'A diaspora centre offering counselling, teaching and online gatherings.',
        timezone: 'Europe/London',
        contactEmail: 'london@example.org',
      },
    ].map((centre) =>
      prisma.ministryCenter.upsert({
        where: { slug: centre.slug },
        create: centre,
        update: centre,
      }),
    ),
  );

  const [central, lagos, london] = centres;

  // -------------------------------------------------------------------------
  // People
  // -------------------------------------------------------------------------
  console.log('  · accounts');

  const people: SeedPerson[] = [
    // --- Administrative seed placeholders (see the file header) -------------
    {
      email: 'setman@example.org',
      firstName: 'Demo',
      lastName: 'Setman',
      displayName: 'Setman (Demo)',
      country: 'Nigeria',
      gender: 'UNSPECIFIED',
      roles: ['SUPER_ADMIN'],
      password: ADMIN_PASSWORD,
      isDemoAccount: true,
      isSeedPlaceholder: true,
      bio: 'Placeholder Super Admin account for the Setman office.',
    },
    {
      email: 'rev.tony@example.org',
      firstName: 'Demo',
      lastName: 'Tony',
      displayName: 'Rev. Tony (Demo)',
      country: 'Nigeria',
      gender: 'MALE',
      roles: ['SENIOR_LEADERSHIP_ADMIN'],
      password: ADMIN_PASSWORD,
      isDemoAccount: true,
      isSeedPlaceholder: true,
      bio: 'Placeholder Senior Leadership Administrator account.',
    },
    {
      email: 'pst.gabriel@example.org',
      firstName: 'Demo',
      lastName: 'Adayi',
      displayName: 'Pst. Gabriel Adayi (Demo)',
      country: 'Nigeria',
      gender: 'MALE',
      roles: ['ADMIN'],
      password: ADMIN_PASSWORD,
      isDemoAccount: true,
      isSeedPlaceholder: true,
      bio: 'Placeholder Administrator account.',
    },

    // --- Demo working administrators ---------------------------------------
    {
      email: 'admin@example.org',
      firstName: 'Adaeze',
      lastName: 'Okonkwo',
      displayName: 'Adaeze (Demo Admin)',
      country: 'Nigeria',
      gender: 'FEMALE',
      roles: ['ADMIN'],
      password: ADMIN_PASSWORD,
      isDemoAccount: true,
      bio: 'Demo administrator for exploring the admin portal.',
    },
    {
      email: 'counselling.admin@example.org',
      firstName: 'Emeka',
      lastName: 'Nwosu',
      displayName: 'Emeka (Demo Counselling Admin)',
      country: 'Nigeria',
      gender: 'MALE',
      roles: ['COUNSELLING_ADMIN'],
      password: ADMIN_PASSWORD,
      isDemoAccount: true,
      bio: 'Runs counselling operations without access to counselling content.',
    },
    {
      email: 'safeguarding@example.org',
      firstName: 'Naomi',
      lastName: 'Bello',
      displayName: 'Naomi (Demo Safeguarding Lead)',
      country: 'Nigeria',
      gender: 'FEMALE',
      roles: ['SAFEGUARDING_ADMIN'],
      password: ADMIN_PASSWORD,
      isDemoAccount: true,
      bio: 'Demo safeguarding lead.',
    },
    {
      email: 'moderator@example.org',
      firstName: 'Tunde',
      lastName: 'Alabi',
      displayName: 'Tunde (Demo Moderator)',
      country: 'Nigeria',
      gender: 'MALE',
      roles: ['MODERATOR'],
      password: ADMIN_PASSWORD,
      isDemoAccount: true,
      bio: 'Demo moderator. Has no access to counselling content.',
    },
    {
      email: 'content.admin@example.org',
      firstName: 'Ruth',
      lastName: 'Mensah',
      displayName: 'Ruth (Demo Content Admin)',
      country: 'Ghana',
      gender: 'FEMALE',
      roles: ['CONTENT_ADMIN', 'EVENT_ADMIN'],
      password: ADMIN_PASSWORD,
      isDemoAccount: true,
      bio: 'Manages teaching resources, courses and events.',
    },

    // --- Demo counsellors ---------------------------------------------------
    {
      email: 'pastor.daniel@example.org',
      firstName: 'Daniel',
      lastName: 'Okafor',
      displayName: 'Pastor Daniel (Demo)',
      country: 'Nigeria',
      gender: 'MALE',
      roles: ['COUNSELLOR', 'PASTOR'],
      password: DEMO_PASSWORD,
      isDemoAccount: true,
      bio: 'Pastoral counsellor serving in marriage, family and spiritual growth.',
    },
    {
      email: 'minister.grace@example.org',
      firstName: 'Grace',
      lastName: 'Adeyemi',
      displayName: 'Minister Grace (Demo)',
      country: 'Nigeria',
      gender: 'FEMALE',
      roles: ['COUNSELLOR'],
      password: DEMO_PASSWORD,
      isDemoAccount: true,
      bio: 'Counsellor serving women, young adults and those walking through grief.',
    },
    {
      email: 'brother.samuel@example.org',
      firstName: 'Samuel',
      lastName: 'Etim',
      displayName: 'Brother Samuel (Demo)',
      country: 'United Kingdom',
      gender: 'MALE',
      roles: ['COUNSELLOR'],
      password: DEMO_PASSWORD,
      isDemoAccount: true,
      bio: 'Counsellor focused on purpose, calling and discipleship.',
    },
    {
      email: 'sister.ruth@example.org',
      firstName: 'Ruth',
      lastName: 'Danjuma',
      displayName: 'Sister Ruth (Demo)',
      country: 'Nigeria',
      gender: 'FEMALE',
      roles: ['COUNSELLOR'],
      password: DEMO_PASSWORD,
      isDemoAccount: true,
      bio: 'Counsellor approved to work with young people, under supervision.',
    },

    // --- Demo members -------------------------------------------------------
    {
      email: 'member@example.org',
      firstName: 'Chidi',
      lastName: 'Eze',
      displayName: 'Chidi (Demo Member)',
      country: 'Nigeria',
      gender: 'MALE',
      roles: ['USER'],
      password: DEMO_PASSWORD,
      isDemoAccount: true,
      bio: 'Growing in faith, learning to pray.',
      discoverable: true,
    },
    {
      email: 'member2@example.org',
      firstName: 'Blessing',
      lastName: 'Ojo',
      displayName: 'Blessing (Demo Member)',
      country: 'Nigeria',
      gender: 'FEMALE',
      roles: ['USER'],
      password: DEMO_PASSWORD,
      isDemoAccount: true,
      bio: 'Serving in the prayer ministry.',
      discoverable: true,
    },
    {
      email: 'member3@example.org',
      firstName: 'Josiah',
      lastName: 'Mwangi',
      displayName: 'Josiah (Demo Member)',
      country: 'Kenya',
      gender: 'MALE',
      roles: ['USER'],
      password: DEMO_PASSWORD,
      isDemoAccount: true,
      ageBand: 'YOUNG_ADULT',
      discoverable: false,
    },
    {
      email: 'ministry.leader@example.org',
      firstName: 'Deborah',
      lastName: 'Ayodele',
      displayName: 'Deborah (Demo Ministry Leader)',
      country: 'Nigeria',
      gender: 'FEMALE',
      roles: ['MINISTRY_LEADER'],
      password: DEMO_PASSWORD,
      isDemoAccount: true,
      bio: 'Leads the young adults ministry at the Lagos centre.',
    },
  ];

  const created = new Map<string, string>();
  const centreFor = (email: string) =>
    email.includes('london') || email.includes('samuel')
      ? london!.id
      : email.includes('member2') || email.includes('grace') || email.includes('leader')
        ? lagos!.id
        : central!.id;

  for (const person of people) {
    const passwordHash = await hashPassword(person.password);
    const ageBand = person.ageBand ?? 'ADULT';

    const user = await prisma.user.upsert({
      where: { email: person.email },
      create: {
        email: person.email,
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        isDemoAccount: person.isDemoAccount ?? false,
        isSeedPlaceholder: person.isSeedPlaceholder ?? false,
        ministryCenterId: centreFor(person.email),
        // Staff roles carry a standing MFA requirement. The demo accounts are
        // seeded with the requirement set but MFA not yet enrolled, which is
        // exactly the state a newly appointed administrator is in: they can
        // sign in, and every sensitive action stays blocked until they enrol.
        mfaRequired: person.roles.some((role) => role !== 'USER'),
        profile: {
          create: {
            firstName: person.firstName,
            lastName: person.lastName,
            displayName: person.displayName,
            country: person.country,
            gender: person.gender,
            ageBand,
            bio: person.bio,
            timezone: person.country === 'United Kingdom' ? 'Europe/London' : 'Africa/Lagos',
          },
        },
        privacySettings: {
          create: {
            discoverable: person.discoverable ?? false,
            publicProfile: false,
          },
        },
        notificationPrefs: { create: {} },
      },
      update: { passwordHash, status: 'ACTIVE' },
    });

    created.set(person.email, user.id);

    for (const roleKey of person.roles) {
      const role = await prisma.role.findUnique({ where: { key: roleKey } });
      if (!role) continue;
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id, reason: 'Seeded demonstration account.' },
        update: {},
      });
    }

    await prisma.consent.createMany({
      data: ['terms', 'privacy', 'counselling_disclaimer'].map((policyKey) => ({
        userId: user.id,
        policyKey,
        policyVersion: '1.0',
      })),
      skipDuplicates: true,
    });
  }

  // -------------------------------------------------------------------------
  // Church hierarchy — provisional until the organisation confirms
  // -------------------------------------------------------------------------
  console.log('  · church hierarchy (provisional)');

  const setmanNode = await prisma.churchHierarchyNode.upsert({
    where: { userId: created.get('setman@example.org')! },
    create: {
      userId: created.get('setman@example.org')!,
      personName: 'Setman',
      title: 'Setman — Super Admin',
      ministryRole: 'Highest platform authority; church hierarchy and governance oversight.',
      administrativeRole: 'SUPER_ADMIN',
      ministryCenterId: central!.id,
      status: 'PENDING_APPROVAL',
      isSeedPlaceholder: true,
      notes:
        'Seeded from the platform specification. Provisional until the organisation confirms that this person holds this office.',
    },
    update: {},
  });

  const tonyNode = await prisma.churchHierarchyNode.upsert({
    where: { userId: created.get('rev.tony@example.org')! },
    create: {
      userId: created.get('rev.tony@example.org')!,
      personName: 'Rev. Tony',
      title: 'Senior Leadership Administrator',
      ministryRole: 'Senior leadership oversight of ministry and counselling operations.',
      administrativeRole: 'SENIOR_LEADERSHIP_ADMIN',
      supervisorId: setmanNode.id,
      ministryCenterId: central!.id,
      status: 'PENDING_APPROVAL',
      isSeedPlaceholder: true,
      notes: 'Seeded from the platform specification. Provisional until confirmed.',
    },
    update: {},
  });

  await prisma.churchHierarchyNode.upsert({
    where: { userId: created.get('pst.gabriel@example.org')! },
    create: {
      userId: created.get('pst.gabriel@example.org')!,
      personName: 'Pst. Gabriel Adayi',
      title: 'Administrator',
      ministryRole: 'Day-to-day platform administration under senior leadership.',
      administrativeRole: 'ADMIN',
      supervisorId: tonyNode.id,
      ministryCenterId: central!.id,
      status: 'PENDING_APPROVAL',
      isSeedPlaceholder: true,
      notes: 'Seeded from the platform specification. Provisional until confirmed.',
    },
    update: {},
  });

  // -------------------------------------------------------------------------
  // Counsellor profiles
  // -------------------------------------------------------------------------
  console.log('  · counsellor profiles');

  const counsellorSeeds = [
    {
      email: 'pastor.daniel@example.org',
      ministryRole: 'Pastor',
      biography:
        'Pastor Daniel has served in pastoral ministry for over a decade, walking with couples and families through difficulty, and helping believers build a life of prayer. He counsels in English and Igbo.',
      categories: ['MARRIAGE', 'FAMILY', 'SPIRITUAL_GROWTH', 'PRAYER_AND_FAITH'] as const,
      languages: ['en'],
      experienceYears: 12,
      acceptsMinors: false,
      centreId: central!.id,
    },
    {
      email: 'minister.grace@example.org',
      ministryRole: 'Minister',
      biography:
        'Minister Grace serves women and young adults, with particular care for those walking through bereavement, and for believers seeking clarity about calling and purpose.',
      categories: ['BEREAVEMENT', 'RELATIONSHIPS', 'PURPOSE_AND_CALLING', 'SPIRITUAL_GROWTH'] as const,
      languages: ['en'],
      experienceYears: 8,
      acceptsMinors: false,
      centreId: lagos!.id,
    },
    {
      email: 'brother.samuel@example.org',
      ministryRole: 'Ministry Worker',
      biography:
        'Brother Samuel works with believers on discipleship, ministry preparation and the ordinary discipline of walking with God over years rather than moments.',
      categories: ['DISCIPLESHIP', 'MINISTRY', 'PURPOSE_AND_CALLING', 'LIFE_DECISIONS'] as const,
      languages: ['en'],
      experienceYears: 6,
      acceptsMinors: false,
      centreId: london!.id,
    },
    {
      email: 'sister.ruth@example.org',
      ministryRole: 'Youth Minister',
      biography:
        'Sister Ruth serves young people and young adults under the safeguarding supervision of the ministry centre leadership. She is approved to work with minors.',
      categories: ['YOUTH_GUIDANCE', 'SPIRITUAL_GROWTH', 'PERSONAL_STRUGGLES', 'FAMILY'] as const,
      languages: ['en'],
      experienceYears: 5,
      acceptsMinors: true,
      centreId: central!.id,
    },
  ];

  const counsellorIds = new Map<string, string>();

  for (const seed of counsellorSeeds) {
    const userId = created.get(seed.email)!;
    const counsellor = await prisma.counsellor.upsert({
      where: { userId },
      create: {
        userId,
        ministryRole: seed.ministryRole,
        biography: seed.biography,
        categories: [...seed.categories],
        languages: seed.languages,
        experienceYears: seed.experienceYears,
        acceptsMinors: seed.acceptsMinors,
        ministryCenterId: seed.centreId,
        sessionTypes: ['TEXT', 'VOICE', 'VIDEO'],
        status: 'APPROVED',
        verifiedAt: new Date(),
        availabilityState: 'AVAILABLE',
        maxConcurrentCases: 8,
        policiesAcceptedAt: new Date(),
        safeguardingAcknowledgedAt: new Date(),
      },
      update: { status: 'APPROVED', availabilityState: 'AVAILABLE' },
    });

    counsellorIds.set(seed.email, counsellor.id);

    // Weekday mornings and evenings.
    await prisma.counsellorAvailability.deleteMany({ where: { counsellorId: counsellor.id } });
    await prisma.counsellorAvailability.createMany({
      data: [1, 2, 3, 4, 5].flatMap((weekday) => [
        { counsellorId: counsellor.id, weekday, startMinute: 9 * 60, endMinute: 12 * 60 },
        { counsellorId: counsellor.id, weekday, startMinute: 18 * 60, endMinute: 20 * 60 },
      ]),
    });
  }

  // One application still awaiting verification, so the verification queue is
  // not empty when an administrator first opens it.
  const leaderId = created.get('ministry.leader@example.org')!;
  await prisma.counsellor.upsert({
    where: { userId: leaderId },
    create: {
      userId: leaderId,
      ministryRole: 'Ministry Leader',
      biography:
        'Applying to serve as a counsellor for young adults, having led the young adults ministry at the Lagos centre for three years.',
      categories: ['YOUTH_GUIDANCE', 'DISCIPLESHIP'],
      languages: ['en'],
      experienceYears: 3,
      acceptsMinors: false,
      ministryCenterId: lagos!.id,
      sessionTypes: ['TEXT', 'VOICE'],
      status: 'PENDING',
      policiesAcceptedAt: new Date(),
      safeguardingAcknowledgedAt: new Date(),
    },
    update: {},
  });

  // -------------------------------------------------------------------------
  // Courses and lessons
  // -------------------------------------------------------------------------
  console.log('  · discipleship courses');

  const courseSeeds = [
    {
      slug: 'foundations-of-christian-faith',
      title: 'Foundations of Christian Faith',
      track: 'Foundations of Faith',
      summary: 'The bedrock: repentance, faith, the new birth, and assurance of salvation.',
      description:
        'A course for new believers and for anyone who wants to lay the foundation again properly. We move slowly through repentance, faith toward God, the new birth and the assurance a believer can rightly have.',
      authorName: 'Pastor Daniel',
      difficulty: 'Foundational',
      scriptureRefs: ['Hebrews 6:1-2', 'John 3:1-8', '1 John 5:11-13'],
      lessons: [
        {
          title: 'Repentance from dead works',
          summary: 'What repentance is, and what it is not.',
          body: 'Repentance is not merely regret. It is a change of mind that issues in a change of direction...\n\nConsider how the New Testament describes it, and what it looked like in the lives of those who first heard the gospel preached.',
          scriptureRefs: ['Acts 2:37-38', 'Hebrews 6:1'],
        },
        {
          title: 'Faith toward God',
          summary: 'Trusting a Person, not a proposition.',
          body: 'Faith in Scripture is directed toward God Himself, not toward faith as an abstraction...\n\nWe look at Abraham, at the centurion, and at what Jesus called great faith.',
          scriptureRefs: ['Hebrews 11:6', 'Romans 4:20-21'],
        },
        {
          title: 'The new birth',
          summary: 'Why Jesus told Nicodemus he must be born again.',
          body: 'Nicodemus was religious, moral, learned and sincere. Jesus told him none of it was enough...\n\nWhat is the new birth, and how does someone know it has happened?',
          scriptureRefs: ['John 3:1-8', '2 Corinthians 5:17'],
        },
        {
          title: 'Assurance',
          summary: 'How a believer can know.',
          body: 'Assurance is not presumption. Scripture speaks plainly about how a believer may know they have passed from death to life...',
          scriptureRefs: ['1 John 5:11-13', 'Romans 8:16'],
        },
      ],
    },
    {
      slug: 'a-life-of-prayer',
      title: 'A Life of Prayer',
      track: 'Prayer',
      summary: 'Learning to pray: intercession, fasting, and praying the Scriptures.',
      description:
        'Prayer is learned, not merely felt. This course works through the practice of prayer as the Bible teaches it, and as the church has practised it.',
      authorName: 'Minister Grace',
      difficulty: 'All levels',
      scriptureRefs: ['Luke 11:1-13', '1 Thessalonians 5:16-18'],
      lessons: [
        {
          title: 'Lord, teach us to pray',
          summary: 'The disciples asked to be taught. So should we.',
          body: 'The disciples had seen Jesus pray. What they asked for was not a feeling but an instruction...',
          scriptureRefs: ['Luke 11:1-4'],
        },
        {
          title: 'Praying the Scriptures',
          summary: 'Letting the Word shape the prayer.',
          body: 'When we do not know what to pray, the Scriptures give us words that are already true...',
          scriptureRefs: ['Psalm 119:105', 'Ephesians 1:15-23'],
        },
        {
          title: 'Intercession',
          summary: 'Standing in the gap for others.',
          body: 'Intercession is prayer that carries the weight of someone else. It is the work of a priesthood...',
          scriptureRefs: ['Ezekiel 22:30', '1 Timothy 2:1-4'],
        },
      ],
    },
    {
      slug: 'christian-character',
      title: 'Christian Character',
      track: 'Christian Character',
      summary: 'The fruit of the Spirit, and the slow shaping of a life.',
      description:
        'Character is formed over years, in ordinary circumstances, mostly when nobody is watching. This course looks at the fruit of the Spirit as the shape of a Christlike life.',
      authorName: 'Brother Samuel',
      difficulty: 'Intermediate',
      scriptureRefs: ['Galatians 5:22-23', 'Romans 5:3-5'],
      certificateEnabled: true,
      lessons: [
        {
          title: 'Fruit, not achievement',
          summary: 'Why the Bible speaks of fruit rather than accomplishment.',
          body: 'Fruit grows. It is not manufactured, and it cannot be rushed...',
          scriptureRefs: ['Galatians 5:22-23', 'John 15:1-8'],
        },
        {
          title: 'Patience in trouble',
          summary: 'What suffering produces, and what it does not.',
          body: 'Scripture does not romanticise suffering. It does say what God intends to produce through it...',
          scriptureRefs: ['Romans 5:3-5', 'James 1:2-4'],
        },
      ],
    },
  ];

  for (const seed of courseSeeds) {
    const course = await prisma.course.upsert({
      where: { slug: seed.slug },
      create: {
        slug: seed.slug,
        title: seed.title,
        track: seed.track,
        summary: seed.summary,
        description: seed.description,
        authorName: seed.authorName,
        difficulty: seed.difficulty,
        scriptureRefs: seed.scriptureRefs,
        status: 'PUBLISHED',
        visibility: 'MEMBERS_ONLY',
        certificateEnabled: seed.certificateEnabled ?? false,
        publishedAt: new Date(),
      },
      update: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    for (const [index, lesson] of seed.lessons.entries()) {
      await prisma.lesson.upsert({
        where: { courseId_orderIndex: { courseId: course.id, orderIndex: index } },
        create: {
          courseId: course.id,
          orderIndex: index,
          title: lesson.title,
          summary: lesson.summary,
          body: lesson.body,
          scriptureRefs: lesson.scriptureRefs,
          estimatedMinutes: 15,
        },
        update: { title: lesson.title, summary: lesson.summary, body: lesson.body },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Resources
  // -------------------------------------------------------------------------
  console.log('  · resources');

  const resourceSeeds = [
    {
      slug: 'the-god-who-hears',
      title: 'The God Who Hears',
      description:
        'A message on the confidence a believer can have that God attends to their prayer.',
      type: 'SERMON' as const,
      topic: 'Prayer',
      speaker: 'Pastor Daniel',
      scriptureRefs: ['Psalm 34:15-18', '1 John 5:14-15'],
      durationMinutes: 42,
      visibility: 'PUBLIC' as const,
    },
    {
      slug: 'walking-through-grief',
      title: 'Walking Through Grief',
      description:
        'Biblical encouragement for believers in bereavement, and honest words about lament.',
      type: 'ARTICLE' as const,
      topic: 'Bereavement',
      speaker: 'Minister Grace',
      scriptureRefs: ['Psalm 23', '1 Thessalonians 4:13-18'],
      visibility: 'PUBLIC' as const,
      body: 'Grief is not a failure of faith. Scripture gives believers permission to lament, and a hope that does not depend on the lament ending quickly...',
    },
    {
      slug: 'daily-devotional-psalms',
      title: 'Thirty Days in the Psalms',
      description: 'A month of short daily readings and prayers drawn from the Psalter.',
      type: 'DEVOTIONAL' as const,
      topic: 'Devotion',
      speaker: 'Sister Ruth',
      scriptureRefs: ['Psalm 1', 'Psalm 23', 'Psalm 51'],
      visibility: 'PUBLIC' as const,
    },
    {
      slug: 'praying-for-your-family',
      title: 'Praying for Your Family',
      description: 'A prayer guide for households, with scripture to pray over each member.',
      type: 'PRAYER_GUIDE' as const,
      topic: 'Family',
      speaker: 'Pastor Daniel',
      scriptureRefs: ['Joshua 24:15', 'Ephesians 6:1-4'],
      visibility: 'MEMBERS_ONLY' as const,
    },
    {
      slug: 'foundations-study-notes',
      title: 'Foundations Study Notes',
      description: 'Written notes accompanying the Foundations of Christian Faith course.',
      type: 'BIBLE_STUDY' as const,
      topic: 'Foundations',
      speaker: 'Pastor Daniel',
      scriptureRefs: ['Hebrews 6:1-2'],
      visibility: 'MEMBERS_ONLY' as const,
    },
    {
      slug: 'the-sending-church',
      title: 'The Sending Church',
      description: 'On missions: why the church exists to be sent, and what that costs.',
      type: 'SERMON' as const,
      topic: 'Missions',
      speaker: 'Brother Samuel',
      scriptureRefs: ['Matthew 28:18-20', 'Romans 10:14-15'],
      durationMinutes: 38,
      visibility: 'PUBLIC' as const,
    },
  ];

  for (const seed of resourceSeeds) {
    await prisma.resource.upsert({
      where: { slug: seed.slug },
      create: {
        ...seed,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        tags: [seed.topic.toLowerCase()],
      },
      update: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------
  console.log('  · events');

  const inDays = (days: number, hour = 18) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  const eventSeeds = [
    {
      slug: 'midweek-prayer-gathering',
      title: 'Midweek Prayer Gathering',
      description:
        'We gather to pray for the church, our ministry centres and the nations. All are welcome.',
      category: 'Prayer',
      startsAt: inDays(3, 18),
      mode: 'HYBRID' as const,
      location: 'Central Ministry Centre, Abuja',
      onlineUrl: 'https://example.org/stream/midweek-prayer',
      speaker: 'Pastor Daniel',
      ministryCenterId: central!.id,
      visibility: 'PUBLIC' as const,
    },
    {
      slug: 'discipleship-intensive',
      title: 'Discipleship Intensive',
      description:
        'A full day of teaching on Christian maturity, ministry preparation and the life of prayer.',
      category: 'Teaching',
      startsAt: inDays(14, 9),
      mode: 'PHYSICAL' as const,
      location: 'Lagos Ministry Centre',
      speaker: 'Brother Samuel',
      capacity: 120,
      ministryCenterId: lagos!.id,
      visibility: 'PUBLIC' as const,
    },
    {
      slug: 'young-adults-evening',
      title: 'Young Adults Evening',
      description: 'Teaching, worship and honest conversation for young adults.',
      category: 'Young Adults',
      startsAt: inDays(7, 19),
      mode: 'PHYSICAL' as const,
      location: 'Lagos Ministry Centre',
      speaker: 'Sister Ruth',
      capacity: 60,
      ministryCenterId: lagos!.id,
      visibility: 'MEMBERS_ONLY' as const,
    },
    {
      slug: 'london-teaching-evening',
      title: 'London Teaching Evening',
      description: 'Midweek teaching for believers across London and online.',
      category: 'Teaching',
      startsAt: inDays(10, 19),
      mode: 'HYBRID' as const,
      location: 'London Ministry Centre',
      onlineUrl: 'https://example.org/stream/london-teaching',
      speaker: 'Brother Samuel',
      ministryCenterId: london!.id,
      visibility: 'PUBLIC' as const,
    },
  ];

  for (const seed of eventSeeds) {
    await prisma.event.upsert({
      where: { slug: seed.slug },
      create: { ...seed, status: 'PUBLISHED', publishedAt: new Date() },
      update: { status: 'PUBLISHED', startsAt: seed.startsAt },
    });
  }

  // -------------------------------------------------------------------------
  // Prayer requests
  // -------------------------------------------------------------------------
  console.log('  · prayer requests');

  const prayerSeeds = [
    {
      email: 'member@example.org',
      title: 'Wisdom for a decision at work',
      body: 'I have a decision to make about a role and I want to choose what honours God rather than what is easiest. Please pray for clarity.',
      category: 'WORK_OR_SCHOOL' as const,
      visibility: 'PUBLIC' as const,
      isAnonymous: false,
    },
    {
      email: 'member2@example.org',
      title: 'Healing for my mother',
      body: 'My mother has been unwell for some weeks. Please pray for her healing and for strength for our family as we care for her.',
      category: 'HEALTH' as const,
      visibility: 'PUBLIC' as const,
      isAnonymous: false,
    },
    {
      email: 'member3@example.org',
      title: 'Consistency in prayer',
      body: 'I start well and then drift. Please pray that I would become steady in prayer rather than sporadic.',
      category: 'SPIRITUAL_LIFE' as const,
      visibility: 'PUBLIC' as const,
      isAnonymous: true,
    },
    {
      email: 'member@example.org',
      title: 'Thanksgiving',
      body: 'God answered a prayer I had almost given up on. Giving thanks.',
      category: 'THANKSGIVING' as const,
      visibility: 'PUBLIC' as const,
      isAnonymous: false,
    },
    {
      email: 'member2@example.org',
      title: 'A private matter',
      body: 'Something I am carrying that I do not want to write publicly. Praying about it here.',
      category: 'OTHER' as const,
      visibility: 'PRIVATE' as const,
      isAnonymous: false,
    },
  ];

  for (const seed of prayerSeeds) {
    const authorId = created.get(seed.email)!;
    const existing = await prisma.prayerRequest.findFirst({
      where: { authorId, title: seed.title },
    });
    if (existing) continue;

    await prisma.prayerRequest.create({
      data: {
        authorId,
        title: seed.title,
        body: seed.body,
        category: seed.category,
        visibility: seed.visibility,
        isAnonymous: seed.isAnonymous,
        prayerCount: seed.visibility === 'PUBLIC' ? Math.floor(Math.random() * 12) + 1 : 0,
      },
    });
  }

  // -------------------------------------------------------------------------
  // A worked counselling example, so the flow is visible immediately
  // -------------------------------------------------------------------------
  console.log('  · counselling example');

  const chidiId = created.get('member@example.org')!;
  const danielCounsellorId = counsellorIds.get('pastor.daniel@example.org')!;
  const danielUserId = created.get('pastor.daniel@example.org')!;

  const existingRequest = await prisma.counsellingRequest.findFirst({
    where: { requesterId: chidiId },
  });

  if (!existingRequest) {
    const request = await prisma.counsellingRequest.create({
      data: {
        requesterId: chidiId,
        category: 'SPIRITUAL_GROWTH',
        summary:
          'I would like to talk about building a steadier walk with God — prayer, the Word, and consistency.',
        preferredMethod: 'TEXT',
        urgency: 'ROUTINE',
        language: 'en',
        ministryCenterId: central!.id,
        disclaimerAckAt: new Date(),
        status: 'SCHEDULED',
        assignedCounsellorId: danielCounsellorId,
        assignedAt: new Date(),
      },
    });

    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 1);
    scheduledFor.setHours(18, 0, 0, 0);

    const session = await prisma.counsellingSession.create({
      data: {
        requestId: request.id,
        counsellorId: danielCounsellorId,
        scheduledFor,
        durationMinutes: 45,
        method: 'TEXT',
        status: 'CONFIRMED',
        participants: {
          create: [
            { userId: chidiId, role: 'member' },
            { userId: danielUserId, role: 'counsellor' },
          ],
        },
      },
    });

    await prisma.conversation.create({
      data: {
        kind: 'COUNSELLING',
        sessionId: session.id,
        participants: {
          create: [
            { userId: chidiId, role: 'member' },
            { userId: danielUserId, role: 'counsellor' },
          ],
        },
      },
    });

    // A second, completed session with both kinds of note, so the boundary
    // between internal and shared notes is demonstrable.
    const pastRequest = await prisma.counsellingRequest.create({
      data: {
        requesterId: created.get('member2@example.org')!,
        category: 'PRAYER_AND_FAITH',
        summary: 'Struggling to pray during a difficult season and wanting help to begin again.',
        preferredMethod: 'TEXT',
        urgency: 'ROUTINE',
        language: 'en',
        disclaimerAckAt: new Date(),
        status: 'CLOSED',
        assignedCounsellorId: counsellorIds.get('minister.grace@example.org')!,
        assignedAt: new Date(),
      },
    });

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);

    const pastSession = await prisma.counsellingSession.create({
      data: {
        requestId: pastRequest.id,
        counsellorId: counsellorIds.get('minister.grace@example.org')!,
        scheduledFor: pastDate,
        durationMinutes: 45,
        method: 'TEXT',
        status: 'COMPLETED',
        startedAt: pastDate,
        endedAt: new Date(pastDate.getTime() + 45 * 60_000),
        followUpRequired: true,
      },
    });

    const graceUserId = created.get('minister.grace@example.org')!;

    const sharedNote = encryptSensitive(
      'Thank you for meeting. Psalm 62 is worth sitting with this week — read it slowly, once a day. Begin with five minutes rather than an hour; consistency will serve you better than intensity right now. We will speak again in a fortnight.',
    );
    await prisma.sessionNote.create({
      data: {
        sessionId: pastSession.id,
        authorId: graceUserId,
        kind: 'SHARED_FOLLOW_UP',
        contentCipher: sharedNote.cipher,
        contentIv: sharedNote.iv,
        lastModifiedById: graceUserId,
      },
    });

    const internalNote = encryptSensitive(
      'Pastoral record. Presenting concern is difficulty praying in a season of loss rather than doubt about God. No safeguarding concern identified. Suggested a short daily rhythm rather than a long one. Follow up in two weeks; if the low mood persists or worsens, encourage seeking professional support alongside pastoral care.',
    );
    await prisma.sessionNote.create({
      data: {
        sessionId: pastSession.id,
        authorId: graceUserId,
        kind: 'INTERNAL',
        contentCipher: internalNote.cipher,
        contentIv: internalNote.iv,
        lastModifiedById: graceUserId,
      },
    });
  }

  // -------------------------------------------------------------------------
  // An accepted connection, so messaging is explorable
  // -------------------------------------------------------------------------
  console.log('  · connections');

  const memberA = created.get('member@example.org')!;
  const memberB = created.get('member2@example.org')!;

  const existingConnection = await prisma.connectionRequest.findFirst({
    where: { requesterId: memberA, recipientId: memberB },
  });

  if (!existingConnection) {
    const conversation = await prisma.conversation.create({
      data: {
        kind: 'PEER',
        participants: { create: [{ userId: memberA }, { userId: memberB }] },
      },
    });

    await prisma.connectionRequest.create({
      data: {
        requesterId: memberA,
        recipientId: memberB,
        introMessage: 'We met at the midweek prayer gathering — would be good to keep praying together.',
        status: 'ACCEPTED',
        respondedAt: new Date(),
        conversationId: conversation.id,
      },
    });

    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          senderId: memberA,
          body: 'Grace and peace. Thank you for accepting — I have been praying about that decision at work.',
        },
        {
          conversationId: conversation.id,
          senderId: memberB,
          body: 'Praying with you. Psalm 25:12 has been an encouragement to me this week.',
        },
      ],
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    // A pending request too, so the connection decision screen is not empty.
    await prisma.connectionRequest.create({
      data: {
        requesterId: created.get('member3@example.org')!,
        recipientId: memberA,
        introMessage: 'Hello — I am new to the Abuja centre and would value fellowship.',
        status: 'PENDING',
      },
    });
  }

  // -------------------------------------------------------------------------
  // One open moderation report and one safeguarding case
  // -------------------------------------------------------------------------
  console.log('  · moderation and safeguarding examples');

  const existingReport = await prisma.report.findFirst({ where: { status: 'OPEN' } });
  if (!existingReport) {
    await prisma.report.create({
      data: {
        reference: humanReference('RP'),
        reporterId: memberB,
        reportedUserId: created.get('member3@example.org')!,
        category: 'SPAM',
        description:
          'This account sent me an unsolicited message about an investment scheme after we connected.',
        status: 'OPEN',
      },
    });
  }

  const existingCase = await prisma.safeguardingCase.findFirst();
  if (!existingCase) {
    const narrative = encryptSensitive(
      'DEMONSTRATION CASE — fictional. Raised from a moderation report about financial solicitation directed at a member. Assess whether the account is being used to target vulnerable members, and whether other members have received similar approaches.',
    );
    await prisma.safeguardingCase.create({
      data: {
        reference: humanReference('SG'),
        subjectUserId: created.get('member3@example.org')!,
        raisedById: created.get('moderator@example.org')!,
        category: 'FINANCIAL_EXPLOITATION',
        riskLevel: 'MEDIUM',
        narrativeCipher: narrative.cipher,
        narrativeIv: narrative.iv,
        status: 'OPEN',
      },
    });
  }

  // -------------------------------------------------------------------------
  // Policy versions
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
  // Summary
  // -------------------------------------------------------------------------
  const counts = {
    users: await prisma.user.count(),
    counsellors: await prisma.counsellor.count(),
    courses: await prisma.course.count(),
    resources: await prisma.resource.count(),
    events: await prisma.event.count(),
    prayers: await prisma.prayerRequest.count(),
  };

  console.log('\nSeed complete.\n');
  console.log(
    `  ${counts.users} accounts · ${counts.counsellors} counsellors · ${counts.courses} courses · ` +
      `${counts.resources} resources · ${counts.events} events · ${counts.prayers} prayer requests\n`,
  );

  console.log('DEMO ACCOUNTS — all fictional, all flagged as demo in the interface.');
  console.log('─'.repeat(78));
  console.log(`  Super Admin (Setman)      setman@example.org              ${ADMIN_PASSWORD}`);
  console.log(`  Senior Leadership Admin   rev.tony@example.org            ${ADMIN_PASSWORD}`);
  console.log(`  Administrator             pst.gabriel@example.org         ${ADMIN_PASSWORD}`);
  console.log(`  Administrator (demo)      admin@example.org               ${ADMIN_PASSWORD}`);
  console.log(`  Counselling Admin         counselling.admin@example.org   ${ADMIN_PASSWORD}`);
  console.log(`  Safeguarding Lead         safeguarding@example.org        ${ADMIN_PASSWORD}`);
  console.log(`  Moderator                 moderator@example.org           ${ADMIN_PASSWORD}`);
  console.log(`  Content / Event Admin     content.admin@example.org       ${ADMIN_PASSWORD}`);
  console.log(`  Counsellor                pastor.daniel@example.org       ${DEMO_PASSWORD}`);
  console.log(`  Counsellor                minister.grace@example.org      ${DEMO_PASSWORD}`);
  console.log(`  Counsellor                brother.samuel@example.org      ${DEMO_PASSWORD}`);
  console.log(`  Counsellor (minors)       sister.ruth@example.org         ${DEMO_PASSWORD}`);
  console.log(`  Member                    member@example.org              ${DEMO_PASSWORD}`);
  console.log(`  Member                    member2@example.org             ${DEMO_PASSWORD}`);
  console.log(`  Member                    member3@example.org             ${DEMO_PASSWORD}`);
  console.log(`  Ministry Leader           ministry.leader@example.org     ${DEMO_PASSWORD}`);
  console.log('─'.repeat(78));
  console.log(
    '\nStaff accounts are seeded with multi-factor authentication REQUIRED but not yet\n' +
      'enrolled — the state a newly appointed administrator is really in. They can sign\n' +
      'in and browse; every sensitive action stays blocked until they enrol from\n' +
      'Privacy & Security. That is the platform working correctly, not a seed defect.\n',
  );
  console.log(
    'The Setman, Rev. Tony and Pst. Gabriel Adayi hierarchy records are PROVISIONAL:\n' +
      'created pending approval, flagged as seed placeholders, and deliberately NOT\n' +
      'published on the public leadership page until the organisation confirms that\n' +
      'those named people hold those offices.\n',
  );
  console.log('CHANGE OR REMOVE THESE ACCOUNTS BEFORE A REAL LAUNCH.\n');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
