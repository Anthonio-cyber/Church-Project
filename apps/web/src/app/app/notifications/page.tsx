import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { NotificationList } from '@/components/app/NotificationList';
import { PushNotificationToggle } from '@/components/app/PushNotificationToggle';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const context = await requirePageUser('/app/notifications');

  const [notifications, preferences] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: context.user.id },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.notificationPreference.upsert({
      where: { userId: context.user.id },
      create: { userId: context.user.id },
      update: {},
    }),
  ]);

  return (
    <>
      <AppPageHeader eyebrow="Notifications" title="What you have missed" />

      <div className="mb-8">
        {/* The public key is public by design — it is what the browser
            encrypts to, and it identifies this platform to the push service. */}
        <PushNotificationToggle vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null} />
      </div>

      <NotificationList
        notifications={notifications.map((notification) => ({
          id: notification.id,
          category: notification.category,
          title: notification.title,
          body: notification.body,
          link: notification.link,
          isCritical: notification.isCritical,
          readAt: notification.readAt?.toISOString() ?? null,
          createdAt: notification.createdAt.toISOString(),
        }))}
        preferences={{
          emailEnabled: preferences.emailEnabled,
          pushEnabled: preferences.pushEnabled,
          counsellingEnabled: preferences.counsellingEnabled,
          connectionEnabled: preferences.connectionEnabled,
          prayerEnabled: preferences.prayerEnabled,
          learningEnabled: preferences.learningEnabled,
          eventEnabled: preferences.eventEnabled,
          announcementEnabled: preferences.announcementEnabled,
        }}
      />
    </>
  );
}
