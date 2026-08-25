'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = 'image/png,image/jpeg,image/webp';

/**
 * Profile picture upload.
 *
 * The size and type are checked here for a quick, kind error message — and
 * again on the server from the bytes themselves, which is the check that
 * actually counts. Nothing here is trusted by the upload route.
 */
export function AvatarUploader({ initialUrl }: { initialUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX_BYTES) {
      setStatus({ tone: 'error', text: 'Please choose an image smaller than 2 MB.' });
      return;
    }

    setBusy(true);
    setStatus(null);

    const body = new FormData();
    body.append('file', file);

    const response = await fetch('/api/files/avatar', { method: 'POST', body }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({
        tone: 'error',
        text: payload?.error?.message ?? 'That picture could not be uploaded.',
      });
      setBusy(false);
      return;
    }

    // The path is stable per upload, so a cache-busting suffix keeps the
    // browser from showing the picture that was just replaced.
    setUrl(`${payload.data.avatarUrl}?v=${Date.now()}`);
    setStatus({ tone: 'ok', text: payload.data.message });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setStatus(null);
    const response = await fetch('/api/files/avatar', { method: 'DELETE' }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus({
        tone: 'error',
        text: payload?.error?.message ?? 'That picture could not be removed.',
      });
      setBusy(false);
      return;
    }

    setUrl(null);
    setStatus({ tone: 'ok', text: payload.data.message });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
      <h2 className="font-serif text-base font-semibold">Profile picture</h2>

      {status ? (
        <p
          role="status"
          className={`mt-3 rounded-lg px-4 py-2.5 text-sm ${
            status.tone === 'ok'
              ? 'border border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          {status.text}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-5">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink-200 bg-parchment-100 dark:border-ink-700 dark:bg-ink-800">
          {url ? (
            // A plain img, not next/image: this path is authenticated and
            // per-member, so there is nothing for an image CDN to optimise.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Your profile picture" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden className="font-serif text-2xl text-gold-600">
              ☺
            </span>
          )}
        </span>

        <div className="flex flex-wrap gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Cleared so choosing the same file twice still fires a change.
              event.target.value = '';
              if (file) void upload(file);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
          >
            {busy ? 'Working…' : url ? 'Change picture' : 'Upload a picture'}
          </button>
          {url ? (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="min-h-[2.75rem] rounded-lg border border-ink-300 px-5 text-sm disabled:opacity-50 dark:border-ink-700"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-500 dark:text-parchment-400">
        PNG, JPEG or WebP, up to 2 MB. Your picture is stored by this platform
        and shown only to signed-in members — it is never hosted somewhere
        public or fetched from another website.
      </p>
    </div>
  );
}
