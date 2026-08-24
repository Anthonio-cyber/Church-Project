'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export type SessionView = {
  id: string;
  status: string;
  scheduledFor: string;
  durationMinutes: number;
  method: string;
  categoryLabel: string;
  summary: string;
  conversationId: string | null;
  counsellorJoinedAt: string | null;
  memberJoinedAt: string | null;
  startedAt: string | null;
  counterpartName: string;
  counterpartRole: string;
  waitingRoom: {
    canEnterWaitingRoom: boolean;
    canEnterSession: boolean;
    label: string;
    detail: string;
  };
};

export type SessionMessage = {
  id: string;
  senderId: string;
  body: string;
  kind: string;
  scriptureRef?: string | null;
  createdAt: string;
  isMine: boolean;
};

type Props = {
  session: SessionView;
  initialMessages: SessionMessage[];
  viewerId: string;
  viewerRole: 'member' | 'counsellor';
};

/**
 * The private waiting room and secure session.
 *
 * Two things this component deliberately never receives: any information about
 * anyone else waiting, and the counsellor's internal notes. The waiting room
 * holds one person, because that is all the server will ever tell it about.
 */
export function CounsellingSessionRoom({ session, initialMessages, viewerId, viewerRole }: Props) {
  const router = useRouter();
  const [state, setState] = useState(session);
  const [messages, setMessages] = useState<SessionMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [connection, setConnection] = useState<'connecting' | 'live' | 'reconnecting' | 'offline'>(
    'connecting',
  );
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const inSession =
    state.waitingRoom.canEnterSession && state.status !== 'COMPLETED' && state.status !== 'CANCELLED';

  // Live updates. If the stream drops, the badge says "reconnecting" rather than
  // silently showing stale state — a counselling room must not lie about whether
  // it is live.
  useEffect(() => {
    if (!state.waitingRoom.canEnterWaitingRoom) return;

    const source = new EventSource(`/api/realtime?sessionId=${state.id}`);

    source.addEventListener('ready', () => setConnection('live'));
    source.onerror = () => setConnection((current) => (current === 'live' ? 'reconnecting' : 'offline'));

    source.addEventListener('counsellor.joined', () => {
      setState((current) => ({
        ...current,
        counsellorJoinedAt: new Date().toISOString(),
        status: 'COUNSELLOR_JOINED',
        waitingRoom: {
          ...current.waitingRoom,
          canEnterSession: true,
          label: 'Your counsellor has joined',
          detail: 'You can enter the secure session now.',
        },
      }));
      router.refresh();
    });

    source.addEventListener('member.waiting', () => {
      setState((current) => ({ ...current, status: 'WAITING' }));
    });

    source.addEventListener('session.ended', () => {
      setState((current) => ({ ...current, status: 'COMPLETED' }));
    });

    source.addEventListener('session.cancelled', () => {
      setState((current) => ({ ...current, status: 'CANCELLED' }));
    });

    source.addEventListener('message.created', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      const payload = data.payload as SessionMessage & { senderId: string };
      setMessages((current) =>
        current.some((message) => message.id === payload.id)
          ? current
          : [...current, { ...payload, isMine: payload.senderId === viewerId }],
      );
    });

    return () => source.close();
  }, [state.id, state.waitingRoom.canEnterWaitingRoom, viewerId, router]);

  // Session timer.
  useEffect(() => {
    if (!state.startedAt || state.status === 'COMPLETED') return;
    const started = new Date(state.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - started) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state.startedAt, state.status]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const join = useCallback(async () => {
    setJoining(true);
    setError(null);
    const response = await fetch(`/api/counselling/sessions/${state.id}/join`, {
      method: 'POST',
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setError(payload?.error?.message ?? 'We could not connect you to the session.');
      setJoining(false);
      return;
    }

    setState((current) => ({
      ...current,
      status: payload.data.status,
      ...(viewerRole === 'counsellor'
        ? { counsellorJoinedAt: new Date().toISOString() }
        : { memberJoinedAt: new Date().toISOString() }),
    }));
    setJoining(false);
    router.refresh();
  }, [state.id, viewerRole, router]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim() || !state.conversationId) return;

    setSending(true);
    setError(null);
    const body = draft;
    setDraft('');

    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: state.conversationId, body }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setError(payload?.error?.message ?? 'That message could not be sent.');
      setDraft(body);
      setSending(false);
      return;
    }

    setMessages((current) =>
      current.some((message) => message.id === payload.data.message.id)
        ? current
        : [...current, { ...payload.data.message, senderId: viewerId }],
    );
    setSending(false);
  }

  async function endSession() {
    const confirmed = window.confirm(
      'End this session? The member will be told it has ended, and the conversation will close.',
    );
    if (!confirmed) return;

    const response = await fetch(`/api/counselling/sessions/${state.id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followUpRequired: false }),
    }).catch(() => null);

    if (response?.ok) {
      setState((current) => ({ ...current, status: 'COMPLETED' }));
      router.refresh();
    }
  }

  const timerLabel = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  // ---- Completed or cancelled -------------------------------------------
  if (state.status === 'COMPLETED' || state.status === 'CANCELLED') {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-ink-200 bg-white p-8 text-center shadow-card dark:border-ink-800 dark:bg-ink-900">
        <p aria-hidden className="text-4xl text-gold-500">
          {state.status === 'COMPLETED' ? '✓' : '—'}
        </p>
        <h2 className="mt-3 font-serif text-xl font-semibold">
          {state.status === 'COMPLETED' ? 'This session has ended' : 'This session was cancelled'}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
          {state.status === 'COMPLETED'
            ? 'Thank you for meeting. Any follow-up notes written for you appear in your counselling area.'
            : 'You can request another session whenever you are ready.'}
        </p>
        <Link
          href={viewerRole === 'counsellor' ? '/counsellor/sessions' : '/app/counselling'}
          className="mt-6 inline-block min-h-[2.75rem] rounded-lg bg-gold-sheen px-5 py-2.5 text-sm font-semibold text-ink-950"
        >
          Back to counselling
        </Link>
      </div>
    );
  }

  // ---- Too early ---------------------------------------------------------
  if (!state.waitingRoom.canEnterWaitingRoom) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-ink-200 bg-white p-8 text-center shadow-card dark:border-ink-800 dark:bg-ink-900">
        <p aria-hidden className="text-4xl text-gold-500">
          ◷
        </p>
        <h2 className="mt-3 font-serif text-xl font-semibold">{state.waitingRoom.label}</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
          {state.waitingRoom.detail}
        </p>
        <dl className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-parchment-400">When</dt>
            <dd className="font-medium">
              {new Date(state.scheduledFor).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-parchment-400">With</dt>
            <dd className="font-medium">{state.counterpartName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-parchment-400">Length</dt>
            <dd className="font-medium">{state.durationMinutes} minutes</dd>
          </div>
        </dl>
      </div>
    );
  }

  // ---- Waiting room ------------------------------------------------------
  if (!inSession) {
    const hasJoined = viewerRole === 'counsellor' ? state.counsellorJoinedAt : state.memberJoinedAt;

    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-xl border border-ink-200 bg-white p-8 text-center shadow-card dark:border-ink-800 dark:bg-ink-900">
          <div className="mb-5 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-parchment-400">
            <span
              className={`h-2 w-2 rounded-full ${
                connection === 'live'
                  ? 'animate-pulse-soft bg-emerald-500'
                  : connection === 'reconnecting'
                    ? 'animate-pulse-soft bg-amber-500'
                    : 'bg-ink-400'
              }`}
            />
            {connection === 'live'
              ? 'Connected'
              : connection === 'reconnecting'
                ? 'Reconnecting…'
                : connection === 'offline'
                  ? 'Not connected'
                  : 'Connecting…'}
          </div>

          <p aria-hidden className="text-4xl text-gold-500">
            ✦
          </p>
          <h2 className="mt-3 font-serif text-2xl font-semibold">Private waiting room</h2>

          <p className="mt-4 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
            {viewerRole === 'counsellor'
              ? state.status === 'WAITING'
                ? 'The member is in the waiting room. Join when you are ready.'
                : 'Join the waiting room to let the member know you are here.'
              : hasJoined
                ? 'Your counsellor has been notified. This page will update the moment they join.'
                : 'Let your counsellor know you are here.'}
          </p>

          <div className="mt-7">
            {!hasJoined ? (
              <button
                type="button"
                onClick={join}
                disabled={joining}
                className="min-h-[2.75rem] w-full rounded-lg bg-gold-sheen px-5 py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-60"
              >
                {joining ? 'Connecting…' : 'Enter Private Waiting Room'}
              </button>
            ) : (
              <div className="rounded-lg border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-gold-900 dark:border-gold-800 dark:bg-gold-950/40 dark:text-gold-200">
                <span className="mr-2 inline-block h-2 w-2 animate-pulse-soft rounded-full bg-gold-500" />
                Waiting for {state.counterpartName}
              </div>
            )}
          </div>

          {error ? (
            <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 rounded-xl border border-ink-200 bg-parchment-100 p-5 text-left dark:border-ink-800 dark:bg-ink-900/60">
          <h3 className="font-serif text-base font-semibold">While you wait</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-600 dark:text-parchment-300">
            <li>• This waiting room is private. Nobody else can see that you are here.</li>
            <li>• You cannot see anyone else waiting, and no such list exists.</li>
            <li>
              • Please do not share passwords, bank details or other highly sensitive information
              unless it is genuinely necessary.
            </li>
            <li>• If you need to leave, you can return to this page at any time.</li>
          </ul>
        </div>
      </div>
    );
  }

  // ---- Live session ------------------------------------------------------
  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      {/* Session information */}
      <aside className="space-y-5">
        <div className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
          <p className="eyebrow mb-3">
            {viewerRole === 'counsellor' ? 'Private counselling session' : 'Private pastoral session'}
          </p>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-ink-500 dark:text-parchment-400">With</dt>
              <dd className="font-medium">{state.counterpartName}</dd>
              <dd className="text-xs text-ink-500 dark:text-parchment-400">
                {state.counterpartRole}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500 dark:text-parchment-400">Category</dt>
              <dd className="font-medium">{state.categoryLabel}</dd>
            </div>
            <div>
              <dt className="text-ink-500 dark:text-parchment-400">Scheduled length</dt>
              <dd className="font-medium">{state.durationMinutes} minutes</dd>
            </div>
            <div>
              <dt className="text-ink-500 dark:text-parchment-400">Elapsed</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums">{timerLabel}</dd>
            </div>
          </dl>

          <div className="mt-4 flex items-center gap-2 border-t border-ink-200 pt-4 text-xs dark:border-ink-800">
            <span
              className={`h-2 w-2 rounded-full ${
                connection === 'live'
                  ? 'animate-pulse-soft bg-emerald-500'
                  : connection === 'reconnecting'
                    ? 'animate-pulse-soft bg-amber-500'
                    : 'bg-red-500'
              }`}
            />
            <span className="text-ink-600 dark:text-parchment-300">
              {connection === 'live'
                ? 'Connected'
                : connection === 'reconnecting'
                  ? 'Reconnecting — messages will send when the connection returns'
                  : 'Not connected'}
            </span>
          </div>
        </div>

        {viewerRole === 'counsellor' ? (
          <div className="space-y-3">
            <Link
              href={`/counsellor/sessions/${state.id}/notes`}
              className="block w-full rounded-lg border border-ink-300 px-4 py-2.5 text-center text-sm dark:border-ink-700"
            >
              Session notes
            </Link>
            <button
              type="button"
              onClick={endSession}
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              End session
            </button>
          </div>
        ) : null}

        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Please do not share passwords, financial information or other highly sensitive information
          unless necessary.
        </div>

        <p className="text-xs leading-relaxed text-ink-500 dark:text-parchment-400">
          This session is not recorded.{' '}
          {state.method !== 'TEXT'
            ? 'Voice and video are provided through a separate secure service configured by the ministry; if it is unavailable, this written channel remains open.'
            : ''}
        </p>
      </aside>

      {/* Conversation */}
      <section className="flex min-h-[32rem] flex-col rounded-xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
        <header className="border-b border-ink-200 px-5 py-3 dark:border-ink-800">
          <h2 className="font-serif text-base font-semibold">
            {viewerRole === 'counsellor' ? 'PRIVATE COUNSELLING SESSION' : 'PRIVATE PASTORAL SESSION'}
          </h2>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-parchment-400">
            Visible only to you and {state.counterpartName}.
          </p>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-500 dark:text-parchment-400">
              The conversation begins here.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    message.isMine
                      ? 'bg-gold-sheen text-ink-950'
                      : 'bg-parchment-100 text-ink-800 dark:bg-ink-800 dark:text-parchment-100'
                  }`}
                >
                  {message.scriptureRef ? (
                    <p className="mb-1 text-xs font-semibold opacity-80">{message.scriptureRef}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <p className="mt-1 text-[0.65rem] opacity-70">
                    {new Date(message.createdAt).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {error ? (
          <p role="alert" className="border-t border-red-200 bg-red-50 px-5 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <form onSubmit={send} className="flex gap-3 border-t border-ink-200 p-4 dark:border-ink-800">
          <label htmlFor="messageBody" className="sr-only">
            Your message
          </label>
          <textarea
            id="messageBody"
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(event as unknown as React.FormEvent);
              }
            }}
            placeholder="Write your message…"
            maxLength={4000}
            className="input flex-1 resize-none"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="min-h-[2.75rem] shrink-0 self-end rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </section>
    </div>
  );
}
