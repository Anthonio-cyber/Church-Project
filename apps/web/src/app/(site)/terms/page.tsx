import type { Metadata } from 'next';
import { PolicyPage } from '@/components/site/PolicyPage';

export const metadata: Metadata = { title: 'Terms of Use' };

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="Terms"
      title="Terms of Use"
      description="The agreement between you and the ministry about how this platform may be used."
      version="1.0"
      effectiveFrom="platform launch"
      sections={[
        {
          heading: 'Who may use the platform',
          list: [
            'You must provide accurate registration information and keep your account secure.',
            'You may not share your account or sign in on another person’s behalf.',
            'Accounts for people under 18 carry additional protections and restrictions, and require the safeguards set by the organisation.',
          ],
        },
        {
          heading: 'What the platform is',
          paragraphs: [
            'This is a ministry platform offering pastoral counselling, prayer, discipleship, resources, events and consent-based fellowship. It is not a medical, psychological, psychiatric, emergency or legal service, and must not be used as one.',
          ],
        },
        {
          heading: 'Expected conduct',
          list: [
            'Treat every person here with the dignity owed to someone made in God’s image.',
            'Do not harass, threaten, impersonate, manipulate or exploit anyone.',
            'Do not solicit money, investments or gifts from members.',
            'Do not share another person’s private information, or anything from a counselling session.',
            'Do not present yourself as a counsellor, pastor or leader unless the organisation has verified you as one.',
            'Do not attempt to access accounts, records or areas you are not authorised to reach.',
          ],
        },
        {
          heading: 'Counselling',
          list: [
            'Counselling is offered by counsellors verified by the organisation. Verification is a check of suitability, not a professional clinical licence.',
            'You must acknowledge the counselling disclaimer before your first request.',
            'Counsellors may end a session, decline a request or refer you to professional services where that is the right thing to do.',
            'Sessions are not recorded by default. Any future recording will require your explicit consent.',
          ],
        },
        {
          heading: 'Content you submit',
          paragraphs: [
            'You keep ownership of what you write. You grant the ministry the permission needed to operate the platform — to store your content, show it to the people you chose to show it to, and retain it as required by policy and law.',
            'Content that breaches these terms may be removed, and accounts may be suspended or disabled.',
          ],
        },
        {
          heading: 'Suspension and termination',
          list: [
            'Accounts may be suspended or disabled for breaches of these terms, safeguarding concerns or security reasons.',
            'Where an account is suspended you will be told, unless telling you would itself create a safeguarding risk.',
            'You may request deletion of your account at any time, subject to records that must be retained under legal obligation.',
          ],
        },
        {
          heading: 'Availability and changes',
          paragraphs: [
            'The platform is provided as it stands. Features may be added, changed or withdrawn, and maintenance or emergency controls may make parts of it temporarily unavailable.',
            'Where a capability has been switched off, the platform will say so plainly rather than failing silently.',
          ],
        },
        {
          heading: 'Governing terms',
          paragraphs: [
            'The governing law, jurisdiction, liability limits and dispute procedure are set by the deploying organisation and its legal advisers, and must be completed before launch.',
          ],
        },
      ]}
    />
  );
}
