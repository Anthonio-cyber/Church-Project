import { env } from './env';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Transactional email.
 *
 * Subjects and bodies must never carry counselling specifics — see
 * `templates` below and docs/SECURITY.md. When EMAIL_API_KEY is absent the
 * adapter logs the message and reports `not_configured` so the admin system
 * monitor shows an honest state rather than pretending mail was delivered.
 */
export async function sendMail(message: MailMessage): Promise<{
  delivered: boolean;
  reason?: string;
}> {
  if (!env.emailApiKey) {
    console.info(
      `[mail:not-configured] to=${message.to} subject="${message.subject}"`,
    );
    return { delivered: false, reason: 'not_configured' };
  }

  try {
    // Provider-agnostic HTTP send. Point EMAIL_API_URL at the transactional
    // provider of the organisation's choice; the payload below matches the
    // common { from, to, subject, text, html } shape.
    const response = await fetch(process.env.EMAIL_API_URL ?? 'https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.emailApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) {
      return { delivered: false, reason: `provider_error_${response.status}` };
    }
    return { delivered: true };
  } catch (error) {
    console.error('[mail] send failed', error);
    return { delivered: false, reason: 'transport_error' };
  }
}

/**
 * Email templates.
 *
 * Every counselling-related subject line is deliberately generic. A subject
 * such as "Your session about your marriage" would disclose sensitive pastoral
 * information to anyone who glances at a notification on a lock screen.
 */
export const templates = {
  verifyEmail: (name: string, link: string) => ({
    subject: 'Confirm your email address',
    text: `Hello ${name},\n\nPlease confirm your email address to finish setting up your account:\n${link}\n\nThis link expires in 24 hours. If you did not create an account, you can ignore this message.`,
  }),
  resetPassword: (name: string, link: string) => ({
    subject: 'Reset your password',
    text: `Hello ${name},\n\nA password reset was requested for your account:\n${link}\n\nThis link expires in one hour. If this was not you, please sign in and review your active devices.`,
  }),
  counsellingRequestReceived: (name: string) => ({
    subject: 'We have received your counselling request',
    text: `Hello ${name},\n\nYour request has been received and is being reviewed by the counselling team. You will be notified when a counsellor is assigned.\n\nIf your situation becomes urgent, please contact your local emergency or professional services.`,
  }),
  counsellingConfirmed: (name: string, whenLocal: string) => ({
    subject: 'Your private pastoral session is confirmed',
    text: `Hello ${name},\n\nYour private pastoral session is confirmed for ${whenLocal}.\n\nSign in shortly before the session and open the waiting room from your dashboard.`,
  }),
  counsellingReminder: (name: string, whenLocal: string) => ({
    subject: 'You have an upcoming private pastoral session',
    text: `Hello ${name},\n\nThis is a reminder of your upcoming private pastoral session at ${whenLocal}.\n\nYou can enter the waiting room from your dashboard.`,
  }),
  connectionRequest: (name: string) => ({
    subject: 'You have a new connection request',
    text: `Hello ${name},\n\nSomeone has asked permission to connect with you. You can accept, decline or block the request from your Connections page.\n\nNo private conversation exists unless you accept.`,
  }),
  connectionAccepted: (name: string) => ({
    subject: 'Your connection request was accepted',
    text: `Hello ${name},\n\nYour connection request was accepted. You can now message each other from the Messages page.`,
  }),
  securityAlert: (name: string, detail: string) => ({
    subject: 'Security alert on your account',
    text: `Hello ${name},\n\n${detail}\n\nIf this was not you, change your password and revoke your active devices from Privacy & Security immediately.`,
  }),
  eventReminder: (name: string, title: string, whenLocal: string) => ({
    subject: `Reminder: ${title}`,
    text: `Hello ${name},\n\nThis is a reminder about ${title} on ${whenLocal}.`,
  }),
};
