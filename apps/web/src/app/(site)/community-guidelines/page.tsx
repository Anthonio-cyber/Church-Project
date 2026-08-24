import type { Metadata } from 'next';
import { PolicyPage } from '@/components/site/PolicyPage';

export const metadata: Metadata = { title: 'Community Guidelines' };

export default function CommunityGuidelinesPage() {
  return (
    <PolicyPage
      eyebrow="Community"
      title="Community Guidelines"
      description="How we treat one another here, and what happens when someone does not."
      version="1.0"
      effectiveFrom="platform launch"
      sections={[
        {
          heading: 'The heart of it',
          paragraphs: [
            'Everyone here is made in God’s image, and many arrive carrying something heavy. Speak to people accordingly. Honour, patience and truthfulness are not optional extras on a ministry platform.',
          ],
        },
        {
          heading: 'Ask before you contact',
          paragraphs: [
            'Connection requests exist because unsolicited private contact is how most harm on ordinary platforms begins. Send one request, and let the other person decide. If they decline, respect that; a repeat request is prevented for a cooling-off period, and pressing the point is itself a breach of these guidelines.',
          ],
        },
        {
          heading: 'What is not permitted',
          list: [
            'Harassment, intimidation, threats or stalking.',
            'Impersonating another person, a counsellor, a pastor or a ministry leader.',
            'Spiritual manipulation, coercion or exploiting someone’s vulnerability.',
            'Soliciting money, gifts, investments or business from members.',
            'Sexual misconduct or sexualised contact of any kind, and absolutely never toward a young person.',
            'Sharing anything from a counselling session, or another person’s private information.',
            'Spam, scams, and repeated unwanted contact.',
            'Attempting to reach accounts, records or areas you are not authorised to see.',
          ],
        },
        {
          heading: 'Prayer requests',
          paragraphs: [
            'A public prayer request is an act of trust. Do not screenshot, repost, mock or discuss it elsewhere. Pray, and let that be enough.',
          ],
        },
        {
          heading: 'If something is wrong',
          list: [
            'Block. It takes effect immediately, hides existing conversation both ways and stops further contact.',
            'Report. Tell us what happened; a moderator reviews it, and serious matters go straight to safeguarding.',
            'In an emergency, contact local emergency services. This platform cannot intervene physically.',
          ],
        },
        {
          heading: 'What happens after a report',
          list: [
            'A moderator reviews the report and may claim it, resolve it, dismiss it or escalate it.',
            'Reported counselling content is never shown to moderators. Those matters go to safeguarding.',
            'Outcomes can include a warning, restrictions, suspension or disabling of an account.',
            'You are told when your report has been reviewed.',
          ],
        },
      ]}
    />
  );
}
