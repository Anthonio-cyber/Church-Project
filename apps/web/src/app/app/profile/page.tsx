import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { ProfileForm, PrivacyForm } from '@/components/app/ProfileForm';
import { AvatarUploader } from '@/components/app/AvatarUploader';
import { Badge, Card } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/permissions';

export const metadata: Metadata = { title: 'My Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const context = await requirePageUser('/app/profile');

  const [profile, privacy, courseCount, ministryCenter] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: context.user.id } }),
    prisma.privacySettings.upsert({
      where: { userId: context.user.id },
      create: { userId: context.user.id },
      update: {},
    }),
    prisma.courseProgress.count({ where: { userId: context.user.id } }),
    context.ministryCenterId
      ? prisma.ministryCenter.findUnique({
          where: { id: context.ministryCenterId },
          select: { name: true, country: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <AppPageHeader
        eyebrow="Account"
        title="My profile"
        description="What other members see, and what stays yours."
      />

      <div className="mb-8 flex flex-wrap items-center gap-2">
        {context.roles.map((role) => (
          <Badge key={role} tone={role === 'USER' ? 'neutral' : 'gold'}>
            {ROLE_LABEL[role]}
          </Badge>
        ))}
        {profile?.ageBand === 'MINOR' ? (
          <Badge tone="caution">Protected account (under 18)</Badge>
        ) : null}
        {ministryCenter ? <Badge>{ministryCenter.name}</Badge> : null}
        {courseCount > 0 ? (
          <Badge tone="positive">
            {courseCount} course{courseCount === 1 ? '' : 's'} started
          </Badge>
        ) : null}
      </div>

      <div className="mb-8">
        <AvatarUploader initialUrl={profile?.avatarUrl ?? null} />
      </div>

      <Card className="mb-8">
        <h2 className="mb-5 font-serif text-xl font-semibold">Profile</h2>
        <ProfileForm
          initial={{
            displayName: profile?.displayName ?? '',
            bio: profile?.bio ?? '',
            country: profile?.country ?? '',
            timezone: profile?.timezone ?? 'UTC',
            preferredLanguage: profile?.preferredLanguage ?? 'en',
            interests: profile?.interests ?? [],
          }}
        />
      </Card>

      <Card>
        <h2 className="mb-2 font-serif text-xl font-semibold">Privacy controls</h2>
        <p className="mb-5 text-sm text-ink-600 dark:text-parchment-300">
          These take effect immediately, everywhere — in search, in connection requests and in the
          mobile applications.
        </p>
        <PrivacyForm
          initial={{
            discoverable: privacy.discoverable,
            whoCanRequestConnection: privacy.whoCanRequestConnection,
            publicProfile: privacy.publicProfile,
            allowPrayerInteraction: privacy.allowPrayerInteraction,
            showOnlineStatus: privacy.showOnlineStatus,
            allowCounsellorFollowUp: privacy.allowCounsellorFollowUp,
            allowCenterDiscovery: privacy.allowCenterDiscovery,
          }}
        />
      </Card>
    </div>
  );
}
