import { z } from 'zod';

/** Shared request schemas. Every API route validates its input through these. */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(254);

export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(200, 'That password is too long.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Display name is too short.')
  .max(40, 'Display name is too long.')
  .regex(
    /^[\p{L}\p{N} '._-]+$/u,
    'Display names may contain letters, numbers, spaces and . _ - only.',
  );

export const nameSchema = z.string().trim().min(1).max(60);

export const uuidSchema = z.string().uuid('Invalid identifier.');

export const registerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  country: z.string().trim().min(2).max(60),
  preferredLanguage: z.string().trim().min(2).max(10).default('en'),
  dateOfBirth: z.string().datetime().optional().or(z.literal('')).optional(),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'UNSPECIFIED']).default('UNSPECIFIED'),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Use.' }),
  }),
  acceptPrivacy: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Privacy Policy.' }),
  }),
  acknowledgeCounsellingDisclaimer: z.literal(true, {
    errorMap: () => ({ message: 'Please acknowledge the counselling disclaimer.' }),
  }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
  mfaCode: z.string().trim().regex(/^\d{6}$/).optional().or(z.literal('')),
  deviceLabel: z.string().trim().max(60).optional(),
});

export const counsellingRequestSchema = z.object({
  category: z.enum([
    'SPIRITUAL_GROWTH',
    'PRAYER_AND_FAITH',
    'FAMILY',
    'MARRIAGE',
    'RELATIONSHIPS',
    'PURPOSE_AND_CALLING',
    'DISCIPLESHIP',
    'PERSONAL_STRUGGLES',
    'YOUTH_GUIDANCE',
    'MINISTRY',
    'BEREAVEMENT',
    'LIFE_DECISIONS',
    'OTHER',
  ]),
  summary: z
    .string()
    .trim()
    .min(10, 'Please tell us a little about what you would like to talk about.')
    .max(500),
  details: z.string().trim().max(4000).optional().or(z.literal('')),
  preferredGender: z.enum(['MALE', 'FEMALE', 'UNSPECIFIED']).default('UNSPECIFIED'),
  preferredDate: z.string().datetime().optional().or(z.literal('')),
  preferredTimeLabel: z.string().trim().max(40).optional().or(z.literal('')),
  urgency: z.enum(['ROUTINE', 'SOON', 'URGENT']).default('ROUTINE'),
  preferredMethod: z.enum(['TEXT', 'VOICE', 'VIDEO', 'IN_PERSON']).default('TEXT'),
  language: z.string().trim().min(2).max(10).default('en'),
  acknowledgeDisclaimer: z.literal(true, {
    errorMap: () => ({
      message: 'Please acknowledge the counselling disclaimer before continuing.',
    }),
  }),
});

export const connectionRequestSchema = z.object({
  recipientId: uuidSchema,
  introMessage: z
    .string()
    .trim()
    .max(300, 'Keep your introduction to 300 characters.')
    .optional()
    .or(z.literal('')),
});

export const messageSchema = z.object({
  conversationId: uuidSchema,
  // A message carrying a file may have no words of its own.
  body: z.string().trim().max(4000),
  kind: z.enum(['TEXT', 'SCRIPTURE', 'RESOURCE']).default('TEXT'),
  scriptureRef: z.string().trim().max(80).optional().or(z.literal('')),
  // Only a file this platform is hosting. The send route additionally checks
  // that this sender uploaded it into this conversation.
  attachmentUrl: z
    .string()
    .regex(
      /^\/api\/files\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      'That attachment could not be found.',
    )
    .optional(),
})
  // Something must actually be sent.
  .refine((value) => value.body.trim().length > 0 || value.attachmentUrl, {
    message: 'Write a message or attach a file.',
    path: ['body'],
  });

export const prayerRequestSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(2000),
  category: z
    .enum([
      'SPIRITUAL_LIFE',
      'FAMILY',
      'WORK_OR_SCHOOL',
      'HEALTH',
      'RELATIONSHIPS',
      'MINISTRY',
      'THANKSGIVING',
      'OTHER',
    ])
    .default('OTHER'),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'MINISTRY_TEAM_ONLY']).default('PRIVATE'),
  isAnonymous: z.boolean().default(false),
});

export const reportSchema = z.object({
  reportedUserId: uuidSchema.optional(),
  messageId: uuidSchema.optional(),
  category: z.enum([
    'HARASSMENT',
    'SPAM',
    'IMPERSONATION',
    'INAPPROPRIATE_BEHAVIOUR',
    'MANIPULATION',
    'FINANCIAL_SOLICITATION',
    'SEXUAL_MISCONDUCT',
    'THREATS',
    'OTHER',
  ]),
  description: z.string().trim().min(10, 'Please describe what happened.').max(2000),
});

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: z.string().trim().max(600).optional().or(z.literal('')),
  country: z.string().trim().max(60).optional().or(z.literal('')),
  timezone: z.string().trim().max(60).optional(),
  preferredLanguage: z.string().trim().min(2).max(10).optional(),
  interests: z.array(z.string().trim().max(40)).max(12).optional(),
  // Only a file this platform is hosting, never an arbitrary external URL.
  // An off-site avatar would make every member who merely loads the
  // connections list or the counsellor directory fetch a third-party image,
  // handing that third party their IP address and a view count — a tracking
  // pixel wearing a profile picture. Uploads go through /api/files/avatar.
  avatarUrl: z
    .string()
    .regex(
      /^\/api\/files\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      'A profile picture must be uploaded rather than linked.',
    )
    .optional()
    .or(z.literal('')),
});

export const privacySettingsSchema = z.object({
  discoverable: z.boolean().optional(),
  whoCanRequestConnection: z.enum(['NOBODY', 'MINISTRY_CENTER', 'MEMBERS']).optional(),
  publicProfile: z.boolean().optional(),
  allowPrayerInteraction: z.boolean().optional(),
  showOnlineStatus: z.boolean().optional(),
  allowCounsellorFollowUp: z.boolean().optional(),
  allowCenterDiscovery: z.boolean().optional(),
});

export const notificationPreferenceSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  counsellingEnabled: z.boolean().optional(),
  connectionEnabled: z.boolean().optional(),
  prayerEnabled: z.boolean().optional(),
  learningEnabled: z.boolean().optional(),
  eventEnabled: z.boolean().optional(),
  announcementEnabled: z.boolean().optional(),
});

/** Sensitive administrative actions must always carry a written reason. */
export const reasonSchema = z
  .string()
  .trim()
  .min(8, 'A written reason of at least 8 characters is required.')
  .max(500);
