import type { Metadata } from 'next';
import { PolicyPage } from '@/components/site/PolicyPage';

export const metadata: Metadata = { title: 'Your Data Rights' };

export default function DataRightsPage() {
  return (
    <PolicyPage
      eyebrow="Data Rights"
      title="Your Data Rights"
      description="What you can ask for, how to ask, and what we can and cannot do."
      version="1.0"
      effectiveFrom="platform launch"
      sections={[
        {
          heading: 'Rights you can exercise yourself',
          list: [
            'Download your personal data from the Privacy Centre, immediately and without asking anyone.',
            'Correct your profile information directly.',
            'Change your privacy settings: who can find you, who can request connection, whether your profile is public.',
            'Manage notification preferences across in-app, email and push.',
            'See every device signed in to your account, and sign any or all of them out.',
            'Remove your own prayer requests.',
            'Block any member.',
          ],
        },
        {
          heading: 'Rights that need a request',
          list: [
            'Deletion of your account and the data that can lawfully be erased.',
            'Correction of information you cannot edit yourself.',
            'Withdrawal of consent where processing relies on your consent.',
            'A copy of material not included in the self-service export.',
          ],
          paragraphs: [
            'Submit these from the Privacy Centre in your account. A data governance administrator reviews each one, and every step is recorded in the audit log.',
          ],
        },
        {
          heading: 'What the self-service export includes',
          list: [
            'Your account, profile, privacy settings and notification preferences.',
            'Your recorded consents and their versions.',
            'Your prayer requests and counselling requests.',
            'Messages you sent, your event registrations and your notifications.',
          ],
        },
        {
          heading: 'What it does not include, and why',
          list: [
            'Your counsellor’s internal notes. These are the counsellor’s pastoral record, may concern other people, and are released only after review.',
            'Safeguarding narratives, where disclosure could place someone at risk.',
            'Messages written by other people — those are their personal data, not yours.',
            'Internal moderation and administrative records.',
          ],
          paragraphs: [
            'The export names these exclusions explicitly rather than omitting them quietly, so you know what exists and can ask for it if you need to.',
          ],
        },
        {
          heading: 'Deletion, honestly',
          paragraphs: [
            'A deletion request does not immediately destroy everything. Safeguarding records and audit history may have to be retained under legal obligation — including records of administrative actions, which exist precisely so that they cannot be made to disappear.',
            'What we will do is tell you specifically what has been erased and what has been retained, and why.',
          ],
        },
        {
          heading: 'Timescales and complaints',
          paragraphs: [
            'The organisation sets its response timescale in line with the law of the countries in which it operates. If you are unhappy with the response, you may complain to the ministry office and to your local data protection authority.',
          ],
        },
      ]}
    />
  );
}
