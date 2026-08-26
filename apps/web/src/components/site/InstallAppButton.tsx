'use client';

import { useEffect, useState } from 'react';

/**
 * Installing iPastor as an app, from the browser.
 *
 * There is no store and no download here. Chrome, Edge and Samsung Internet
 * fire `beforeinstallprompt` when a site qualifies as installable, and calling
 * `prompt()` on that saved event puts iPastor on the home screen with its own
 * icon, its own window and no browser chrome. It is the same platform, the
 * same accounts and the same database — it is the website, given a home.
 *
 * Safari never fires that event, so iPhone and iPad get written instructions
 * instead of a dead button. So does any browser that has already installed it.
 */

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type State = 'checking' | 'ready' | 'installed' | 'manual';

export function InstallAppButton() {
  const [state, setState] = useState<State>('checking');
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    // Already running as an installed app — nothing left to offer.
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setState('installed');
      return;
    }

    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));

    function onPrompt(event: Event) {
      // Chrome shows its own mini-infobar unless this is prevented; we want the
      // prompt to appear when the person asks for it, not on page load.
      event.preventDefault();
      setPrompt(event as PromptEvent);
      setState('ready');
    }

    function onInstalled() {
      setState('installed');
      setPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // If the event has not arrived shortly after load it is not coming: either
    // the browser does not support it, or iPastor is installed already.
    const timer = window.setTimeout(() => {
      setState((current) => (current === 'checking' ? 'manual' : current));
    }, 1500);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') setState('installed');
    setPrompt(null);
  }

  if (state === 'installed') {
    return (
      <p className="text-sm leading-relaxed text-parchment-300">
        iPastor is installed on this device. Open it from your home screen.
      </p>
    );
  }

  if (state === 'ready') {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-6 text-sm font-semibold text-ink-950 transition hover:brightness-105"
      >
        Install iPastor on this device
      </button>
    );
  }

  return (
    <div className="text-sm leading-relaxed text-parchment-300">
      {state === 'checking' ? (
        <p>Checking this device…</p>
      ) : ios ? (
        <p>
          On iPhone and iPad: tap the <strong className="text-parchment-100">Share</strong> button
          at the bottom of Safari, scroll down, then tap{' '}
          <strong className="text-parchment-100">Add to Home Screen</strong>.
        </p>
      ) : (
        <p>
          Your browser installs from its own menu. Open the{' '}
          <strong className="text-parchment-100">⋮</strong> menu and choose{' '}
          <strong className="text-parchment-100">Install app</strong> or{' '}
          <strong className="text-parchment-100">Add to Home screen</strong>.
        </p>
      )}
    </div>
  );
}
