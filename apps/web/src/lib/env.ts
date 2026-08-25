/**
 * Environment configuration.
 *
 * Secrets are read once, validated at boot and never exposed to the client.
 * Anything the browser is allowed to see must be prefixed NEXT_PUBLIC_.
 */

function required(name: string, devFallback?: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  if (devFallback) return devFallback;
  throw new Error(`Missing required environment variable ${name}.`);
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  databaseUrl: required('DATABASE_URL', 'postgresql://localhost:5432/remnant_dev'),
  authSecret: required('AUTH_SECRET', 'development-only-auth-secret-value-32ch'),
  dataEncryptionKey: required(
    'DATA_ENCRYPTION_KEY',
    'development-only-data-encryption-key-32c',
  ),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',

  // Optional integrations. Every one of these has a documented "not configured"
  // state so the platform degrades honestly instead of pretending to work.
  emailApiKey: optional('EMAIL_API_KEY'),
  emailFrom: process.env.EMAIL_FROM ?? 'no-reply@example.org',
  pushKey: optional('PUSH_NOTIFICATION_KEY'),
  realtimeSecret: optional('REALTIME_SECRET'),
  videoServiceKey: optional('VIDEO_SERVICE_KEY'),
  videoServiceUrl: optional('VIDEO_SERVICE_URL'),
  storageKey: optional('STORAGE_KEY'),
  storageBucket: optional('STORAGE_BUCKET'),
} as const;

export type IntegrationName =
  | 'email'
  | 'push'
  | 'realtime'
  | 'video'
  | 'storage';

/** Used by the admin system monitor to report honest service states. */
export function integrationStatus(name: IntegrationName): 'configured' | 'not_configured' {
  const map: Record<IntegrationName, string | undefined> = {
    email: env.emailApiKey,
    push: env.pushKey,
    realtime: env.realtimeSecret,
    // The service URL, not the key, is what actually makes calls work: a
    // public Jitsi instance needs no key at all. Reporting on the key would
    // have shown "configured" for a deployment where video does nothing.
    // Read at call time to match lib/domain/video.ts.
    video: process.env.VIDEO_SERVICE_URL || undefined,
    storage: env.storageKey,
  };
  return map[name] ? 'configured' : 'not_configured';
}
