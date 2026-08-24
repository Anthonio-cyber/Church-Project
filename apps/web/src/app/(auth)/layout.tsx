import Link from 'next/link';
import { BrandLink } from '@/components/brand/Logo';
import { GoldRule } from '@/components/ui';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-parchment-100">
      <header className="border-b border-ink-800/60 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <BrandLink tone="gold" size={38} />
          <Link href="/" className="text-sm text-parchment-300 hover:text-gold-300">
            Back to the website
          </Link>
        </div>
      </header>
      <GoldRule />

      <main id="main" className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-ink-800/60 px-4 py-6 text-center sm:px-6">
        <p className="text-xs text-parchment-500">
          <Link href="/privacy" className="hover:text-gold-400">
            Privacy
          </Link>
          {' · '}
          <Link href="/terms" className="hover:text-gold-400">
            Terms
          </Link>
          {' · '}
          <Link href="/safeguarding" className="hover:text-gold-400">
            Safeguarding
          </Link>
          {' · '}
          <Link href="/counselling-disclaimer" className="hover:text-gold-400">
            Counselling disclaimer
          </Link>
        </p>
      </footer>
    </div>
  );
}
