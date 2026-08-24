import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistrar } from '@/components/app/ServiceWorkerRegistrar';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'iPastor';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: `${brandName} — Pastoral Counselling, Prayer and Discipleship`,
    template: `%s · ${brandName}`,
  },
  description:
    '𝒾Pastor is a private, secure ministry platform for pastoral counselling, prayer, discipleship and fellowship — built around consent, safeguarding and accountable church leadership.',
  applicationName: brandName,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/brand/logo.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
  },
  openGraph: {
    type: 'website',
    siteName: brandName,
    title: `${brandName} — Pastoral Counselling, Prayer and Discipleship`,
    description:
      'Request pastoral counselling, submit prayer requests, and grow in the Word — in a safe, consent-based digital ministry environment.',
  },
  robots: {
    // The public site is indexable; every private surface sets noindex through
    // the route headers in next.config.mjs.
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfcf9' },
    { media: '(prefers-color-scheme: dark)', color: '#111110' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
