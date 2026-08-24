import { prisma } from '@/lib/db';
import { integrationStatus } from '@/lib/env';
import { subscriberCount } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

/**
 * Health check for load balancers, uptime monitoring and the admin system
 * monitor. Reports honest states — a service that is not configured says so
 * rather than claiming to be online.
 */
export async function GET() {
  const startedAt = Date.now();
  let database: 'online' | 'offline' = 'offline';
  let databaseLatencyMs: number | null = null;

  try {
    const probeStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    databaseLatencyMs = Date.now() - probeStart;
    database = 'online';
  } catch (error) {
    console.error('[health] database probe failed', error);
  }

  const services = {
    database,
    authentication: database === 'online' ? 'online' : 'degraded',
    realtime: 'online',
    api: 'online',
    email: integrationStatus('email') === 'configured' ? 'online' : 'not_configured',
    push: integrationStatus('push') === 'configured' ? 'online' : 'not_configured',
    storage: integrationStatus('storage') === 'configured' ? 'online' : 'not_configured',
    video: integrationStatus('video') === 'configured' ? 'online' : 'not_configured',
  } as const;

  const healthy = database === 'online';

  return Response.json(
    {
      status: healthy ? 'ok' : 'degraded',
      version: process.env.npm_package_version ?? '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
      databaseLatencyMs,
      realtimeSubscribers: subscriberCount(),
      services,
    },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
