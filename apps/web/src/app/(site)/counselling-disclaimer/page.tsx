import type { Metadata } from 'next';
import { PolicyPage } from '@/components/site/PolicyPage';
import { COUNSELLING_DISCLAIMER } from '@/lib/domain/safeguarding';

export const metadata: Metadata = { title: 'Counselling Disclaimer' };

export default function CounsellingDisclaimerPage() {
  return (
    <PolicyPage
      eyebrow="Counselling"
      title="Counselling Disclaimer"
      description="What pastoral counselling on this platform is, and what it is not."
      version="1.0"
      effectiveFrom="platform launch"
      sections={[
        {
          heading: 'What pastoral counselling is',
          paragraphs: [
            'Pastoral counselling here means spiritual guidance, prayer, biblical encouragement and pastoral support offered by a counsellor the organisation has verified.',
          ],
        },
        {
          heading: 'What it is not',
          paragraphs: [
            'It is not a substitute for emergency services, licensed medical care, psychological treatment, psychiatric treatment, legal advice or other professional services.',
            'Counsellors here are not, by virtue of this platform, licensed clinicians. Verification confirms that the organisation has approved them for pastoral counselling — it is not a clinical credential.',
          ],
        },
        {
          heading: 'When to seek other help',
          list: [
            'If you are in immediate danger, contact local emergency services now.',
            'If you are thinking about harming yourself or someone else, contact emergency services or a crisis line in your country.',
            'For a medical or mental-health condition, see a qualified professional. Pastoral care can walk alongside that; it cannot replace it.',
            'For legal or financial matters, seek qualified professional advice.',
          ],
        },
        {
          heading: 'Confidentiality and its limits',
          paragraphs: [
            'What you share in counselling is treated as confidential and is protected by encryption, access restrictions and recorded access.',
            'Confidentiality is not absolute, and it would be dishonest to say otherwise. Where there is a serious risk of harm to you or to another person, or where the law requires disclosure, a safeguarding lead may access the record and act. Every such access is recorded permanently.',
          ],
        },
        {
          heading: 'Acknowledgement',
          paragraphs: [
            COUNSELLING_DISCLAIMER,
            'You will be asked to acknowledge this before your first counselling request, and your acknowledgement is recorded with the version of this disclaimer you agreed to.',
          ],
        },
      ]}
    />
  );
}
