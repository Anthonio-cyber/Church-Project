import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { Card } from '@/components/ui';
import { DataRightsPanel, DevicePanel, MfaPanel } from '@/components/app/SecurityPanel';
import { MFA_REQUIRED_ROLES } from '@/lib/permissions';

export const metadata: Metadata = { title: 'Privacy & Security' };
export const dynamic = 'force-dynamic';

export default async function PrivacyCentrePage() {
  const context = await requirePageUser('/app/privacy');

  const [sessions, dataRequests, consents] = await Promise.all([
    prisma.session.findMany({
      where: { userId: context.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
    }),
    prisma.dataRequest.findMany({
      where: { userId: context.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.consent.findMany({
      where: { userId: context.user.id },
      orderBy: { grantedAt: 'desc' },
    }),
  ]);

  const mfaRequired =
    context.user.mfaRequired || context.roles.some((role) => MFA_REQUIRED_ROLES.includes(role));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <AppPageHeader
        eyebrow="Account"
        title="Privacy & Security"
        description="Your devices, your second factor, your consents and your data."
      />

      <Card>
        <h2 className="mb-4 font-serif text-xl font-semibold">Multi-factor authentication</h2>
        <MfaPanel
          enabled={context.user.mfaEnabled}
          required={mfaRequired}
          email={context.user.email}
        />
      </Card>

      <Card>
        <h2 className="mb-2 font-serif text-xl font-semibold">Devices signed in</h2>
        <p className="mb-5 text-sm text-ink-600 dark:text-parchment-300">
          If you see something you do not recognise, sign it out and change your password.
        </p>
        <DevicePanel
          sessions={sessions.map((session) => ({
            id: session.id,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            deviceLabel: session.deviceLabel,
            createdAt: session.createdAt.toISOString(),
            lastSeenAt: session.lastSeenAt.toISOString(),
            isCurrent: session.id === context.session.id,
          }))}
        />
      </Card>

      <Card>
        <h2 className="mb-2 font-serif text-xl font-semibold">Your consents</h2>
        <p className="mb-5 text-sm text-ink-600 dark:text-parchment-300">
          Each consent is recorded against the specific policy version you agreed to, so amending a
          policy does not silently rewrite what you previously accepted.
        </p>
        <ul className="space-y-2">
          {consents.map((consent) => (
            <li
              key={consent.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-200 px-4 py-3 text-sm dark:border-ink-800"
            >
              <span className="capitalize">{consent.policyKey.replace(/_/g, ' ')}</span>
              <span className="text-ink-500 dark:text-parchment-400">
                version {consent.policyVersion} ·{' '}
                {consent.withdrawnAt
                  ? `withdrawn ${consent.withdrawnAt.toLocaleDateString()}`
                  : `granted ${consent.grantedAt.toLocaleDateString()}`}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 font-serif text-xl font-semibold">Your data</h2>
        <DataRightsPanel
          requests={dataRequests.map((request) => ({
            id: request.id,
            kind: request.kind,
            status: request.status,
            createdAt: request.createdAt.toISOString(),
            handledAt: request.handledAt?.toISOString() ?? null,
          }))}
        />
      </Card>

      <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <h2 className="font-serif text-lg font-semibold text-amber-900 dark:text-amber-100">
          What we can and cannot promise
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
          Your information is protected using encryption, access restrictions and recorded access.
          Authorised personnel may access information when necessary for platform operation,
          safeguarding, legal obligations or security — and when they do, there is a permanent
          record of who, when and why.
        </p>
        <p className="mt-3 text-sm text-amber-900 dark:text-amber-100">
          <Link href="/privacy" className="font-medium underline underline-offset-4">
            Read the full Privacy Policy
          </Link>
        </p>
      </Card>
    </div>
  );
}
