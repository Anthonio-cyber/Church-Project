import { AppShell } from '@/components/app/AppShell';
import { requirePageUser, viewerFrom } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePageUser('/app/dashboard');
  const viewer = await viewerFrom(context);
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
