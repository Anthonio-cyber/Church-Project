/*
 * Service worker for the iPastor progressive web app.
 *
 * Deliberately conservative about what it caches. Static assets and a small
 * offline shell are cached; API responses, counselling pages, messages and
 * every authenticated surface are NEVER cached, because a device that is
 * shared, lost or handed on must not be able to reproduce someone's pastoral
 * conversation from disk.
 */

const VERSION = 'ipastor-v1';
const SHELL_CACHE = `${VERSION}-shell`;

const SHELL_ASSETS = ['/offline', '/brand/logo.svg', '/manifest.webmanifest'];

/** Never cached, under any circumstance. */
const NEVER_CACHE = [
  '/api/',
  '/app/',
  '/counsellor',
  '/moderation',
  '/admin',
  '/super-admin',
  '/login',
  '/register',
  '/reset-password',
  '/verify-email',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Authenticated and API surfaces go straight to the network, and their
  // responses are never written to any cache.
  if (NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: 'offline',
              message: 'You appear to be offline. Reconnect and try again.',
            },
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    return;
  }

  // Public pages: network first, falling back to the cached copy, then to the
  // offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/offline'))),
    );
    return;
  }

  // Static assets: cache first.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

/* Push notifications. Payloads are generic by policy — never counselling detail. */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'iPastor', body: 'You have a new notification.' };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'iPastor', {
      body: payload.body ?? 'Open the platform to read it.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag ?? 'ipastor',
      data: { link: payload.link ?? '/app/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? '/app/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(self.location.origin));
      if (existing) return existing.focus().then(() => existing.navigate(link));
      return self.clients.openWindow(link);
    }),
  );
});
