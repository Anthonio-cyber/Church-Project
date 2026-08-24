import Link from 'next/link';

/**
 * 𝒾Pastor — the platform mark.
 *
 * Two parts, deliberately separable:
 *
 *   The seal — a golden RCN emblem: the letters RCN above an open book (the
 *   Word) and a flame (the Spirit). It appears on every surface of the
 *   platform: website, member app, all four staff portals, the PWA icon, the
 *   mobile app icon and the email templates.
 *
 *   The wordmark — 𝒾Pastor. The script "i" is rendered as an italic serif
 *   glyph rather than the U+1D4BE character, so it looks right in every font
 *   stack rather than falling back to a missing-glyph box. The accessible name
 *   stays the plain "iPastor" so screen readers say it correctly.
 *
 * IMPORTANT — branding provenance.
 * This is an ORIGINAL mark drawn for this platform. It is not a reproduction of
 * any organisation's official logo, and the platform does not claim to be an
 * official product of Remnant Christian Network.
 *
 * To deploy under an organisation's own authorised branding, replace
 * `public/brand/logo.svg` with the supplied asset and set
 * NEXT_PUBLIC_BRAND_LOGO_URL / NEXT_PUBLIC_BRAND_NAME. Every surface reads the
 * mark from this file and those asset paths, so the swap is a single change.
 */

export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'iPastor';

export type LogoProps = {
  size?: number;
  /** Renders the wordmark beside the seal. */
  withWordmark?: boolean;
  /** 'gold' for dark grounds, 'ink' for light grounds. */
  tone?: 'gold' | 'ink';
  className?: string;
};

export function LogoMark({ size = 40, tone = 'gold', className }: Omit<LogoProps, 'withWordmark'>) {
  const outer = tone === 'gold' ? '#c9922a' : '#71441f';
  const inner = tone === 'gold' ? '#e8c469' : '#ab7220';
  const field = tone === 'gold' ? '#1c1b19' : '#fdfcf9';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="iPastor — Remnant Christian Network"
      className={className}
    >
      <defs>
        <linearGradient id="rcn-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#89551d" />
          <stop offset="35%" stopColor={outer} />
          <stop offset="50%" stopColor={inner} />
          <stop offset="65%" stopColor={outer} />
          <stop offset="100%" stopColor="#89551d" />
        </linearGradient>
      </defs>

      {/* Outer seal */}
      <circle cx="32" cy="32" r="30" fill="url(#rcn-gold)" />
      <circle cx="32" cy="32" r="26.5" fill={field} />
      <circle cx="32" cy="32" r="25" fill="none" stroke="url(#rcn-gold)" strokeWidth="1.1" />

      {/* Flame — the Spirit */}
      <path
        d="M32 14c3.6 4.1 5.4 7.5 5.4 10.4 0 3.2-2.4 5.6-5.4 5.6s-5.4-2.4-5.4-5.6c0-2.9 1.8-6.3 5.4-10.4z"
        fill="url(#rcn-gold)"
      />

      {/* Open book — the Word */}
      <path
        d="M14 38.5c5.6-2.4 11.2-2.4 17 0v10c-5.8-2.4-11.4-2.4-17 0v-10z"
        fill="none"
        stroke="url(#rcn-gold)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M50 38.5c-5.6-2.4-11.2-2.4-17 0v10c5.8-2.4 11.4-2.4 17 0v-10z"
        fill="none"
        stroke="url(#rcn-gold)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1="32" y1="38.5" x2="32" y2="48.5" stroke="url(#rcn-gold)" strokeWidth="2" />

      {/* Initials */}
      <text
        x="32"
        y="35.5"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="9"
        fontWeight="700"
        letterSpacing="1.5"
        fill="url(#rcn-gold)"
      >
        RCN
      </text>
    </svg>
  );
}

/**
 * The 𝒾Pastor wordmark. The leading glyph is an italic serif "i" so the script
 * form renders identically everywhere; the accessible name is plain text.
 */
export function Wordmark({
  tone = 'gold',
  size = 'md',
}: {
  tone?: 'gold' | 'ink';
  size?: 'sm' | 'md' | 'lg';
}) {
  const scale = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <span
      aria-label={BRAND_NAME}
      className={`font-serif font-semibold tracking-tight ${scale} ${
        tone === 'gold' ? 'text-gold-200' : 'text-ink-900'
      }`}
    >
      <span
        aria-hidden
        className={`italic ${tone === 'gold' ? 'text-gold-400' : 'text-gold-700'}`}
      >
        i
      </span>
      <span aria-hidden>Pastor</span>
    </span>
  );
}

export function Logo({ size = 40, withWordmark = true, tone = 'gold', className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ''}`}>
      <LogoMark size={size} tone={tone} />
      {withWordmark ? (
        <span className="flex flex-col leading-none">
          <Wordmark tone={tone} />
          <span
            className={`mt-1 text-[0.6rem] font-medium uppercase tracking-[0.16em] ${
              tone === 'gold' ? 'text-gold-500/90' : 'text-ink-500'
            }`}
          >
            Remnant Christian Network
          </span>
        </span>
      ) : null}
    </span>
  );
}

/** The clickable brand lockup used in every header. */
export function BrandLink({
  href = '/',
  tone = 'gold',
  size = 40,
}: {
  href?: string;
  tone?: 'gold' | 'ink';
  size?: number;
}) {
  return (
    <Link
      href={href}
      className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-400"
      aria-label={`${BRAND_NAME} — home`}
    >
      <Logo tone={tone} size={size} />
    </Link>
  );
}
