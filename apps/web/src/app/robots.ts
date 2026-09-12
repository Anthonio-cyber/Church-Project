import type { MetadataRoute } from 'next';

/**
 * Crawler rules.
 *
 * The public site is indexable. Every authenticated surface is not — and is
 * additionally protected by noindex headers and by authentication itself, so a
 * crawler that ignores this file still reaches nothing.
 *
 * Generated rather than served as a static file so the sitemap reference is an
 * absolute URL on whatever domain the platform is actually deployed to, which
 * is what the specification requires.
 */

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/app/',
        '/counsellor',
        '/moderation',
        '/admin',
        '/super-admin',
        '/api/',
        '/login',
        '/register',
        '/reset-password',
        '/verify-email',
      ],
    },
    sitemap: new URL('/sitemap.xml', appUrl).toString(),
  };
}
