import type { Metadata } from 'next';
import { PolicyPage } from '@/components/site/PolicyPage';
import { SafeguardingNotice } from '@/components/ui';

export const metadata: Metadata = { title: 'Safeguarding Policy' };

export default function SafeguardingPage() {
  return (
    <PolicyPage
      eyebrow="Safeguarding"
      title="Safeguarding Policy"
      description="How concerns about harm are raised, who handles them, and what protections apply to children and vulnerable people."
      version="1.0"
      effectiveFrom="platform launch"
      sections={[
        {
          heading: 'Our commitment',
          paragraphs: [
            'The care of souls is a sacred trust, and safety is part of that care. Where someone on this platform is at risk of harm — from another person or from themselves — the response is immediate, human and accountable.',
          ],
        },
        {
          heading: 'What counts as a safeguarding concern',
          list: [
            'Abuse of any kind, including physical, emotional, spiritual and financial abuse.',
            'Threats to a person’s safety.',
            'Exploitation, including trafficking and coercion.',
            'Harassment that places someone at risk.',
            'Concerns that a person may harm themselves.',
            'Any concern relating to the safety of a child or young person.',
            'Sexual misconduct.',
            'Financial exploitation of a member.',
          ],
        },
        {
          heading: 'How concerns are raised',
          list: [
            'Any member can report a person or a message from within the platform.',
            'Certain report categories — sexual misconduct and threats among them — go straight to safeguarding and never sit in the general moderation queue.',
            'Counselling requests are checked for indications of danger. Where they appear, the member is shown emergency and professional-help guidance immediately, and a safeguarding lead is notified.',
            'A moderator who encounters a serious matter escalates it. Escalating does not give that moderator access to the resulting case.',
          ],
        },
        {
          heading: 'Who handles safeguarding cases',
          paragraphs: [
            'Safeguarding cases are handled by designated safeguarding leads and, where escalated, senior church leadership, under the organisation’s approved safeguarding procedure.',
            'Case narratives are encrypted. Opening a case requires a sensitive permission, multi-factor authentication, recent re-authentication and a written reason — and every access is recorded permanently against the case. There is no way to read a safeguarding case without leaving that record.',
          ],
        },
        {
          heading: 'Protections for children and young people',
          list: [
            'Accounts recorded as belonging to someone under 18 carry the protected age band automatically.',
            'Adults and minors cannot open private conversations with each other through ordinary connection requests.',
            'A counselling request from a young person can only be taken by a counsellor specifically approved to work with minors.',
            'Minors do not appear in member directory search.',
            'Cases involving a minor are flagged as such and treated with the corresponding urgency.',
          ],
        },
        {
          heading: 'The limits of this platform',
          paragraphs: [
            'This platform is not an emergency service and cannot intervene physically. Where someone is in immediate danger, the right response is local emergency services — and the platform will say so rather than implying otherwise.',
          ],
        },
        {
          heading: 'Configuration by the organisation',
          paragraphs: [
            'Escalation paths, named safeguarding leads, reporting obligations to statutory authorities and retention periods are set by the deploying organisation in line with the law of each country in which it operates. These must be completed before launch.',
          ],
        },
      ]}
    >
      <div className="mb-10">
        <SafeguardingNotice />
      </div>
    </PolicyPage>
  );
}
