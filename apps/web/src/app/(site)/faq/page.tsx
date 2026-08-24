import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/site/SiteChrome';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description: 'Straight answers about counselling, privacy, contact, safeguarding and how the platform is governed.',
};

const FAQS = [
  {
    q: 'Can another member message me without my permission?',
    a: 'No. They must send a connection request, and no private conversation exists until you accept it. They may include one short introduction message and nothing more. You can accept, decline or block, and a decline prevents a repeat request for a cooling-off period.',
  },
  {
    q: 'Can administrators read my counselling conversations?',
    a: 'Not by virtue of being administrators. A counselling session is visible to you and to your assigned counsellor. A safeguarding lead may reach counselling records where there is a safeguarding concern, but only with a written reason, and that access is recorded permanently against the record. Moderators have no counselling access at all, and counselling administrators manage operations without reading conversations.',
  },
  {
    q: 'Can I see my counsellor’s notes?',
    a: 'You see follow-up notes your counsellor deliberately wrote for you. Their internal pastoral notes are their own record and are not shown to you — they are encrypted, and every access to them is logged.',
  },
  {
    q: 'Is my counselling really confidential?',
    a: 'It is protected by encryption, strict access rules and recorded access — and it is not absolute, which we would rather say plainly. Where there is a serious risk of harm, or where the law requires disclosure, a safeguarding lead may access the record and act.',
  },
  {
    q: 'Is this an emergency service?',
    a: 'No. Online pastoral counselling is not an emergency service. If you are in immediate danger, or thinking of harming yourself or someone else, contact your local emergency services or a crisis line now.',
  },
  {
    q: 'Who can see my prayer request?',
    a: 'Whoever you choose. Public requests appear on the prayer wall — anonymously if you select that, in which case your identity is withheld by the system itself. Private requests are visible only to you. Ministry-team requests go to pastors, counsellors and ministry leaders only.',
  },
  {
    q: 'Can I become a counsellor?',
    a: 'You can apply from within the platform. Applying grants nothing: an authorised administrator must verify and approve the application before any counselling request can reach you, and approval brings a standing multi-factor authentication requirement.',
  },
  {
    q: 'What protections apply to young people?',
    a: 'Accounts recorded as under 18 carry a protected age band. Adults and minors cannot open private conversations through ordinary connection requests, minors do not appear in directory search, and a counselling request from a young person can only be taken by a counsellor specifically approved for that work.',
  },
  {
    q: 'Can an administrator promote themselves?',
    a: 'No. Governance actions refuse self-targeting outright, no one can act on a person of equal or greater rank, and no one can grant a role or permission they do not themselves hold. These are enforced on the server for every request, not in the interface.',
  },
  {
    q: 'Can the audit log be edited or deleted?',
    a: 'No. It is append-only and the database itself rejects updates and deletions. There is no route in the application that modifies it, and that applies to the highest administrator as much as to anyone else.',
  },
  {
    q: 'Is this an official Remnant Christian Network product?',
    a: 'No. The platform draws on ministry principles publicly associated with RCN and uses an original visual identity created for it. No claim of official status, endorsement or affiliation is made unless and until the organisation authorises it in writing.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'Yes — Android and iOS applications built on the same backend, the same accounts and the same permissions, with push notifications and biometric sign-in where the device supports it. The web application can also be installed as a progressive web app.',
  },
];

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Questions people actually ask"
        description="Plain answers, including to the awkward ones."
      />

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <dl className="space-y-8">
          {FAQS.map((faq) => (
            <div key={faq.q} className="border-l-2 border-gold-400 pl-5">
              <dt className="font-serif text-lg font-semibold">{faq.q}</dt>
              <dd className="mt-2.5 text-base leading-relaxed text-ink-700 dark:text-parchment-200">
                {faq.a}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-12 text-sm text-ink-600 dark:text-parchment-300">
          Still unsure?{' '}
          <Link href="/contact" className="font-medium text-gold-700 underline underline-offset-4 dark:text-gold-400">
            Get in touch
          </Link>
          .
        </p>
      </section>
    </>
  );
}
