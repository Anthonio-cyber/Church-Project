'use client';

import { useState } from 'react';

export type VideoRoomView = {
  origin: string;
  url: string;
  method: string;
};

/**
 * The voice/video channel for a counselling session.
 *
 * The call is never mounted automatically. Someone opening a session page is
 * not consenting to their camera and microphone switching on, so the iframe —
 * and therefore any device access — only exists after a deliberate click.
 * Leaving the call unmounts it, which releases the camera and microphone
 * rather than leaving them held by a hidden frame.
 */
export function VideoCallPanel({ room }: { room: VideoRoomView }) {
  const [joined, setJoined] = useState(false);

  const label = room.method === 'VOICE' ? 'voice call' : 'video call';
  const host = (() => {
    try {
      return new URL(room.origin).host;
    } catch {
      return room.origin;
    }
  })();

  if (!joined) {
    return (
      <div className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
        <h3 className="font-serif text-base font-semibold">
          {room.method === 'VOICE' ? 'Voice call' : 'Video call'}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
          This session was arranged as a {label}. The call opens in a private
          room that only you and the person you are meeting can reach.
        </p>
        <button
          type="button"
          onClick={() => setJoined(true)}
          className="mt-4 min-h-[2.75rem] w-full rounded-lg bg-gold-sheen px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:brightness-105"
        >
          Start the {label}
        </button>
        <p className="mt-3 text-xs leading-relaxed text-ink-500 dark:text-parchment-400">
          Your camera and microphone are not switched on until you start the
          call, and you will be asked again before joining. The call runs on{' '}
          {host}, a service outside this platform. The written channel below
          stays open either way.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-serif text-base font-semibold">
          {room.method === 'VOICE' ? 'Voice call' : 'Video call'}
        </h3>
        <button
          type="button"
          onClick={() => setJoined(false)}
          className="min-h-[2.25rem] rounded-lg border border-ink-300 px-4 text-sm dark:border-ink-700"
        >
          Leave the call
        </button>
      </div>

      <div className="overflow-hidden rounded-lg bg-ink-950">
        <iframe
          src={room.url}
          title={room.method === 'VOICE' ? 'Voice call' : 'Video call'}
          allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
          className="h-[28rem] w-full border-0 sm:h-[34rem]"
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-500 dark:text-parchment-400">
        This call is not recorded by the platform. Leaving the call releases
        your camera and microphone.
      </p>
    </div>
  );
}
