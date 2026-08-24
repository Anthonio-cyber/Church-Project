'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker so the platform is installable as a progressive
 * web app. Registration is deliberately quiet: a failure changes nothing about
 * how the platform works online, so it is logged rather than surfaced.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((error) => console.warn('[pwa] service worker registration failed', error));
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
