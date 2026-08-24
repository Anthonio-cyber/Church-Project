import { SitePage } from '@/components/site/SiteChrome';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SitePage>{children}</SitePage>;
}
