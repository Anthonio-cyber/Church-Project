import type { Metadata } from 'next';
import { PolicyPage } from '@/components/site/PolicyPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What information this platform collects, why, who can reach it, and what rights you have over it.',
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="Privacy"
      title="Privacy Policy"
      description="What we collect, why we collect it, how it is protected, who can reach it, and the rights you have over it."
      version="1.0"
      effectiveFrom="platform launch"
      sections={[
        {
          heading: 'What we collect',
          paragraphs: [
            'We ask for as little as the platform genuinely needs. At registration that is your name, a display name, an email address, a password, your country and preferred language.',
          ],
          list: [
            'Account information: email address, password (stored only as a scrypt hash, never in readable form), account status and security settings.',
            'Profile information: display name, biography, country, language and interests — all of which you control and can change.',
            'Date of birth, only where age-based protections require it. If you are under 18, age-aware restrictions apply automatically.',
            'Counselling requests and sessions: the category, your summary, scheduling information and session status.',
            'Prayer requests, at the visibility you choose.',
            'Messages you send in conversations you are part of.',
            'Learning progress, event registrations and notification preferences.',
            'Security and operational records: sign-in events, device and session information, IP address and user agent, and an audit trail of administrative actions.',
          ],
        },
        {
          heading: 'Why we collect it',
          list: [
            'To provide counselling, prayer, discipleship, events and fellowship.',
            'To protect members: safeguarding, moderation, anti-abuse and account security.',
            'To meet legal obligations and to establish, exercise or defend legal claims.',
            'To operate and improve the platform using aggregated, anonymised statistics.',
          ],
          paragraphs: [
            'We do not sell personal information, and we do not use counselling content for analytics, product improvement, advertising or model training.',
          ],
        },
        {
          heading: 'How it is stored and protected',
          list: [
            'Transport is encrypted (HTTPS), with strict security headers and a content security policy.',
            'Passwords are hashed with scrypt and a per-password salt.',
            'Session tokens are stored only as HMACs, so a database leak does not hand over usable sessions.',
            'Internal counselling notes and safeguarding narratives are encrypted at rest with AES-256-GCM.',
            'Access follows least privilege: permissions are granular and granted individually, never implied by seniority.',
            'Sensitive actions require multi-factor authentication, fresh re-authentication and a written reason.',
            'The audit log is append-only and protected at the database level. No administrator, including the highest, can erase it through the platform.',
          ],
        },
        {
          heading: 'Counselling information',
          paragraphs: [
            'Counselling is treated as the most sensitive category of information on this platform, and is held behind its own boundary.',
            'Your counselling session is visible to you and to the counsellor assigned to you. A safeguarding lead may reach counselling records where there is a safeguarding concern, but only with a written reason, and that access is permanently recorded against the record itself.',
            'Counselling administrators run counselling operations — assignment, scheduling, availability — without access to your conversations or your counsellor’s notes. Moderators have no counselling access at all.',
            'Your counsellor may keep internal pastoral notes. These are their record, not yours, and are not shown to you; a counsellor may also write follow-up notes deliberately intended for you to read, and those you can see.',
          ],
        },
        {
          heading: 'Messaging and contact',
          paragraphs: [
            'No member can open a private conversation with you unless you have accepted their connection request. Before acceptance, no conversation exists.',
            'You can block any member at any time. Blocking hides existing private communication in both directions, stops notifications and prevents further requests.',
          ],
        },
        {
          heading: 'What we will not claim',
          paragraphs: [
            'We will not tell you that your information is “100% private” or that nobody can ever access it, because that would not be true of any system.',
            'What we can say honestly is this: your information is protected using encryption, access restrictions and recorded access. Authorised personnel may access information when necessary for platform operation, safeguarding, legal obligations or security — and when they do, there is a record of who, when and why.',
          ],
        },
        {
          heading: 'Cookies and similar technologies',
          paragraphs: [
            'We use a single essential cookie to keep you signed in. It is httpOnly, Secure and SameSite=Lax, and it carries no advertising or tracking function. The mobile applications use a device keychain instead of cookies.',
            'There is no third-party advertising or cross-site tracking on this platform.',
          ],
        },
        {
          heading: 'Data retention',
          list: [
            'Account and profile information is kept while your account is active.',
            'Counselling notes are retained under the retention period set by the organisation’s policy, and may carry a specific retention date set by the counsellor.',
            'Safeguarding records are retained in line with safeguarding obligations, which may be longer than ordinary records.',
            'Audit and security records are retained as a governance and legal requirement and are not deleted on request.',
          ],
        },
        {
          heading: 'Your rights',
          list: [
            'Access: download the personal data available to you from the Privacy Centre at any time.',
            'Correction: change your profile information directly, or request a correction.',
            'Deletion: request deletion of your account. Some records — safeguarding and audit in particular — may need to be retained under legal obligation, and we will tell you which.',
            'Consent: withdraw consent where processing relies on it, and manage your communication preferences.',
            'Devices: see every active session and sign out of any of them, or all of them.',
            'Complaint: raise a concern with the ministry office, or with your local data protection authority.',
          ],
        },
        {
          heading: 'Third-party services',
          paragraphs: [
            'Where configured, the platform uses a transactional email provider, a push notification service, file storage and a video or voice provider for counselling sessions. Which providers are used is a deployment decision made by the organisation, and the deployed platform should list them here.',
            'Counselling sessions are not recorded by default. If recording is ever introduced, it will require explicit consent, display an unmistakable recording indicator, carry a defined retention period, be encrypted, be access-restricted and be deletable — and every access will be logged.',
          ],
        },
        {
          heading: 'Contact',
          paragraphs: [
            'For privacy questions, data-rights requests or complaints, contact the ministry office through the Contact page, or submit a request directly from the Privacy Centre inside your account.',
          ],
        },
      ]}
    />
  );
}
