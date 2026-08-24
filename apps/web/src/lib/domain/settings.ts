import { prisma } from '../db';
import { ApiError } from '../api';

/**
 * Platform feature switches and emergency controls.
 *
 * Emergency controls exist so that leadership can contain an incident in
 * minutes — stop new registrations, freeze messaging, close counselling intake
 * — without a deployment. Every one of them is checked server-side at the point
 * of use, never merely hidden in the interface.
 */
export const FEATURE_FLAGS = {
  'registration.enabled': {
    label: 'New registrations',
    description: 'Allow new members to create accounts.',
    default: true,
  },
  'messaging.enabled': {
    label: 'Private messaging',
    description: 'Allow members to exchange private messages.',
    default: true,
  },
  'connections.enabled': {
    label: 'Connection requests',
    description: 'Allow members to request to connect with each other.',
    default: true,
  },
  'counselling.intake_enabled': {
    label: 'Counselling intake',
    description: 'Accept new counselling requests.',
    default: true,
  },
  'uploads.enabled': {
    label: 'File uploads',
    description: 'Allow files to be shared on the platform.',
    default: true,
  },
  'maintenance.enabled': {
    label: 'Maintenance mode',
    description: 'Place the member application in maintenance mode.',
    default: false,
  },
  'prayer.public_enabled': {
    label: 'Public prayer wall',
    description: 'Allow prayer requests to be shared publicly.',
    default: true,
  },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export async function getFlag(key: FeatureFlagKey): Promise<boolean> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  if (!row) return FEATURE_FLAGS[key].default;
  return Boolean(row.value);
}

export async function getAllFlags(): Promise<Record<FeatureFlagKey, boolean>> {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: Object.keys(FEATURE_FLAGS) } },
  });
  const map = new Map(rows.map((row) => [row.key, Boolean(row.value)]));
  const result = {} as Record<FeatureFlagKey, boolean>;
  for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]) {
    result[key] = map.get(key) ?? FEATURE_FLAGS[key].default;
  }
  return result;
}

export async function setFlag(
  key: FeatureFlagKey,
  value: boolean,
  actorId: string,
): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    create: {
      key,
      value,
      description: FEATURE_FLAGS[key].description,
      updatedById: actorId,
    },
    update: { value, updatedById: actorId },
  });
}

/** Throws a clear, honest error when a capability has been switched off. */
export async function assertFeatureEnabled(key: FeatureFlagKey): Promise<void> {
  if (!(await getFlag(key))) {
    throw new ApiError(
      503,
      'feature_disabled',
      `${FEATURE_FLAGS[key].label} is temporarily unavailable. Please try again later.`,
    );
  }
}
