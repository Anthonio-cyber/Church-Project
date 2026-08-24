'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type ChatMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  isMine: boolean;
  deleted: boolean;
};

/** A private conversation between two connected members. */
export function ConversationView({
  conversationId,
  otherPersonId,
  otherPersonName,
  isActive,
  initialMessages,
  viewerId,
}: {
  conversationId: string;
  otherPersonId: string;
  otherPersonName: string;
  isActive: boolean;
  initialMessages: ChatMessage[];
  viewerId: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const source = new EventSource(`/api/realtime?conversationId=${conversationId}`);
    source.addEventListener('message.created', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      const payload = data.payload;
      setMessages((current) =>
        current.some((message) => message.id === payload.id)
          ? current
          : [
              ...current,
              {
                id: payload.id,
                senderId: payload.senderId,
                body: payload.body,
                createdAt: payload.createdAt,
                isMine: payload.senderId === viewerId,
                deleted: false,
              },
            ],
      );
    });
    return () => source.close();
  }, [conversationId, viewerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    const body = draft;
    setDraft('');

    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, body }),
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
        : [
            ...current,
            {
              id: payload.data.message.id,
              senderId: viewerId,
              body: payload.data.message.body,
              createdAt: payload.data.message.createdAt,
              isMine: true,
              deleted: false,
            },
          ],
    );
    setSending(false);
  }

  async function block() {
    const confirmed = window.confirm(
      `Block ${otherPersonName}? This conversation will be hidden, notifications will stop, and they will not be able to send you further requests.`,
    );
    if (!confirmed) return;

    const response = await fetch(`/api/users/${otherPersonId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Blocked from conversation.' }),
    }).catch(() => null);

    if (response?.ok) router.push('/app/messages');
  }

  return (
    <div className="flex min-h-[32rem] flex-col rounded-xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
      <header className="flex items-center justify-between border-b border-ink-200 px-5 py-3 dark:border-ink-800">
        <div>
          <h2 className="font-serif text-base font-semibold">{otherPersonName}</h2>
          <p className="text-xs text-ink-500 dark:text-parchment-400">
            Private conversation, visible only to the two of you.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-parchment-100 dark:text-parchment-300 dark:hover:bg-ink-800"
          >
            Options
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-ink-200 bg-white py-1 shadow-card dark:border-ink-800 dark:bg-ink-900"
            >
              <button
                type="button"
                role="menuitem"
                onClick={block}
                className="block w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                Block {otherPersonName}
              </button>
              <a
                role="menuitem"
                href={`/app/help?report=${otherPersonId}`}
                className="block px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-parchment-100 dark:text-parchment-200 dark:hover:bg-ink-800"
              >
                Report a concern
              </a>
            </div>
          ) : null}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-500 dark:text-parchment-400">
            You are connected. Say hello.
          </p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  message.isMine
                    ? 'bg-gold-sheen text-ink-950'
                    : 'bg-parchment-100 text-ink-800 dark:bg-ink-800 dark:text-parchment-100'
                }`}
              >
                <p className="whitespace-pre-wrap">
                  {message.deleted ? <em>This message was removed.</em> : message.body}
                </p>
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

      {isActive ? (
        <form onSubmit={send} className="flex gap-3 border-t border-ink-200 p-4 dark:border-ink-800">
          <label htmlFor="conversationBody" className="sr-only">
            Your message
          </label>
          <textarea
            id="conversationBody"
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(event as unknown as React.FormEvent);
              }
            }}
            maxLength={4000}
            placeholder="Write a message…"
            className="input flex-1 resize-none"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="min-h-[2.75rem] shrink-0 self-end rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      ) : (
        <p className="border-t border-ink-200 px-5 py-4 text-center text-sm text-ink-500 dark:border-ink-800 dark:text-parchment-400">
          This conversation is closed.
        </p>
      )}
    </div>
  );
}
