import type { NotificationCategory } from '@prisma/client';
import { prisma } from './db';
import { channels, publish } from './realtime';
import { sendMail } from './mail';
import { sendPush } from './push';

export type NotifyInput = {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  link?: string;
  /**
   * Critical notifications (security and safeguarding) are always delivered
   * in-app and by email regardless of preference, because suppressing them
   * would leave a member unable to react to a compromise of their own account.
   */
  isCritical?: boolean;
  email?: { subject: string; text: string };
  push?: boolean;
};

function categoryEnabled(
  prefs: Awaited<ReturnType<typeof prisma.notificationPreference.findUnique>>,
  category: NotificationCategory,
): boolean {
  if (!prefs) return true;
  switch (category) {
    case 'COUNSELLING':
      return prefs.counsellingEnabled;
    case 'CONNECTION':
      return prefs.connectionEnabled;
    case 'PRAYER':
      return prefs.prayerEnabled;
    case 'LEARNING':
      return prefs.learningEnabled;
    case 'EVENT':
      return prefs.eventEnabled;
    case 'ANNOUNCEMENT':
      return prefs.announcementEnabled;
    default:
      return true;
  }
}

/**
 * Deliver a notification across the channels the member has agreed to.
 *
 * Notification titles and bodies must remain non-disclosing: they say that a
 * pastoral session is starting, never what the session concerns.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: input.userId },
  });

  const critical = input.isCritical ?? false;
  if (!critical && !categoryEnabled(prefs, input.category)) return;

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      category: input.category,
      title: input.title,
      body: input.body,
      link: input.link,
      isCritical: critical,
    },
  });

  publish(channels.user(input.userId), 'notification', {
    id: notification.id,
    category: notification.category,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    createdAt: notification.createdAt.toISOString(),
  });

  if (input.email && (critical || prefs?.emailEnabled !== false)) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });
    if (user) {
      await sendMail({
        to: user.email,
        subject: input.email.subject,
        text: input.email.text,
      });
    }
  }

  if (input.push && (critical || prefs?.pushEnabled !== false)) {
    await sendPush({
      userId: input.userId,
      title: input.title,
      body: input.body,
      data: input.link ? { link: input.link } : undefined,
    });
  }
}

export async function notifyMany(
  userIds: string[],
  input: Omit<NotifyInput, 'userId'>,
): Promise<number> {
  let sent = 0;
  for (const userId of userIds) {
    await notify({ ...input, userId });
    sent += 1;
  }
  return sent;
}
