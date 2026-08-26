/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

// The voice/video service, when one is configured. Only its origin is trusted,
// and only for framing and device access — never for scripts on our own pages.
// An unset or malformed value simply leaves video disabled rather than
// widening the policy.
const videoOrigin = (() => {
  const raw = process.env.VIDEO_SERVICE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
})();

// Content Security Policy. Next.js needs 'unsafe-inline' for its injected
// bootstrap styles; in development the dev overlay also needs 'unsafe-eval'.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  // frame-src would otherwise fall back to default-src 'self' and block the
  // counselling call embed.
  // youtube-nocookie.com carries linked teaching video; see lib/domain/media.ts.
  `frame-src 'self' https://www.youtube-nocookie.com${videoOrigin ? ` ${videoOrigin}` : ''}`,
  "frame-ancestors 'none'",
  // The service worker and manifest are what make iPastor installable as an
  // app. Both would fall back to default-src today, but naming them means a
  // future change to default-src cannot quietly break installing.
  "worker-src 'self'",
  "manifest-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    // Camera and microphone are granted to the call embed only when a video
    // service is configured; with none, they stay same-origin as before.
    value: [
      `camera=(self${videoOrigin ? ` "${videoOrigin}"` : ''})`,
      `microphone=(self${videoOrigin ? ` "${videoOrigin}"` : ''})`,
      `display-capture=(self${videoOrigin ? ` "${videoOrigin}"` : ''})`,
      'geolocation=()',
      'interest-cohort=()',
    ].join(', '),
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emits a self-contained server bundle, which is what the Docker runtime
  // stage copies. Hosts that build from source ignore it harmlessly.
  output: 'standalone',
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  serverExternalPackages: ['@prisma/client'],
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Private surfaces must never be indexed or cached by intermediaries.
        source: '/(app|counsellor|moderation|admin|super-admin)/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        // Uploaded files are member-supplied bytes served from our own
        // origin, which is exactly the shape of a stored-XSS hole. The type
        // is already derived from the bytes rather than the uploader's claim,
        // and this is the second lock: whatever a file turns out to be, it
        // may not execute, load anything, or reach the network. Declared
        // after the general /api rule so it wins on the shared keys.
        // Content-Disposition is deliberately absent: it is set per file by
        // the route, because a PDF must download while an image renders, and a
        // value set here would override that.
        source: '/api/files/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'none'; sandbox" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
