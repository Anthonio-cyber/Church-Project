import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppPageHeader } from '@/components/app/AppShell';
import { CounsellingRequestForm } from '@/components/forms/CounsellingRequestForm';
import { requirePageUser } from '@/lib/auth/guard';
import { getFlag } from '@/lib/domain/settings';
import { EmptyState, ButtonLink } from '@/components/ui';

export const metadata: Metadata = { title: 'Request counselling' };
export const dynamic = 'force-dynamic';

export default async function RequestCounsellingPage() {
  await requirePageUser('/app/counselling/request');
  const intakeOpen = await getFlag('counselling.intake_enabled');

  if (!intakeOpen) {
    return (
      <>
        <AppPageHeader title="Request pastoral counselling" />
        <EmptyState
          icon="⏸"
          title="Counselling intake is temporarily paused"
          description="New counselling requests are not being accepted at the moment. If your situation is urgent, please contact your ministry centre directly — and if you are in immediate danger, contact local emergency services."
          action={<ButtonLink href="/app/help">Get help</ButtonLink>}
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <AppPageHeader
        eyebrow="Pastoral counselling"
        title="Request pastoral counselling"
        description="Tell us a little about what you would like to talk about. Your request goes to the counselling team, who will match you with an approved counsellor."
      />
      <CounsellingRequestForm />
    </div>
  );
}
