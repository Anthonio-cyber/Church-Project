'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type ConnectionEntry = {
  id: string;
  status: string;
  introMessage: string | null;
  createdAt: string;
  conversationId: string | null;
  person: { id: string; displayName: string; avatarUrl: string | null; country: string | null };
};

export type DirectoryResult = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  country: string | null;
  bio: string | null;
  ministryCenter: string | null;
};

/**
 * Connection requests.
 *
 * The confirmation copy before sending is not decoration: a member should
 * understand that they are asking permission, that one short message is all
 * they get, and that nothing happens unless the other person agrees.
 */
export function ConnectionsPanel({
  incoming,
  outgoing,
  connections,
}: {
  incoming: ConnectionEntry[];
  outgoing: ConnectionEntry[];
  connections: ConnectionEntry[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState<DirectoryResult | null>(null);
  const [introMessage, setIntroMessage] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 3) {
      setFeedback({ tone: 'error', text: 'Type at least three characters to search.' });
      return;
    }
    setSearching(true);
    setFeedback(null);
    const response = await fetch(`/api/directory?q=${encodeURIComponent(query)}`).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setResults(payload?.data?.results ?? []);
    setSearching(false);
  }

  async function sendRequest() {
    if (!target) return;
    setBusy(true);
    setFeedback(null);

    const response = await fetch('/api/connections/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientId: target.id,
        introMessage: introMessage || undefined,
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (!response?.ok) {
      setFeedback({ tone: 'error', text: payload?.error?.message ?? 'That request could not be sent.' });
      setBusy(false);
      return;
    }

    setFeedback({ tone: 'ok', text: payload.data.message });
    setTarget(null);
    setIntroMessage('');
    setResults(null);
    setQuery('');
    setBusy(false);
    router.refresh();
  }

  async function respond(id: string, action: 'accept' | 'decline', block = false) {
    setBusy(true);
    const response = await fetch(`/api/connections/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(action === 'decline' ? { body: JSON.stringify({ block }) } : {}),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    setFeedback(
      response?.ok
        ? { tone: 'ok', text: payload.data.message }
        : { tone: 'error', text: payload?.error?.message ?? 'That action failed.' },
    );
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-10">
      {feedback ? (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            feedback.tone === 'ok'
              ? 'border border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {/* Requests awaiting your decision */}
      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">
          Requests awaiting your decision
          {incoming.length > 0 ? (
            <span className="ml-2 rounded-full bg-gold-sheen px-2.5 py-0.5 text-xs font-bold text-ink-950">
              {incoming.length}
            </span>
          ) : null}
        </h2>

        {incoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-300 p-5 text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
            No one is waiting on you. When someone asks to connect, their request appears here — and
            no conversation exists until you accept.
          </p>
        ) : (
          <ul className="space-y-4">
            {incoming.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-gold-300 bg-gold-50/60 p-5 dark:border-gold-800 dark:bg-gold-950/20"
              >
                <p className="font-serif text-lg font-semibold">{entry.person.displayName}</p>
                {entry.person.country ? (
                  <p className="text-sm text-ink-500 dark:text-parchment-400">
                    {entry.person.country}
                  </p>
                ) : null}
                {entry.introMessage ? (
                  <blockquote className="mt-3 border-l-2 border-gold-400 pl-4 text-sm italic text-ink-700 dark:text-parchment-200">
                    “{entry.introMessage}”
                  </blockquote>
                ) : (
                  <p className="mt-3 text-sm text-ink-500 dark:text-parchment-400">
                    They did not include a message.
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => respond(entry.id, 'accept')}
                    className="min-h-[2.5rem] rounded-lg bg-gold-sheen px-4 text-sm font-semibold text-ink-950 disabled:opacity-60"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => respond(entry.id, 'decline')}
                    className="min-h-[2.5rem] rounded-lg border border-ink-300 px-4 text-sm dark:border-ink-700"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => respond(entry.id, 'decline', true)}
                    className="min-h-[2.5rem] rounded-lg border border-red-300 px-4 text-sm text-red-700 dark:border-red-800 dark:text-red-300"
                  >
                    Decline and block
                  </button>
                </div>
                <p className="mt-3 text-xs text-ink-500 dark:text-parchment-400">
                  Declining is not announced to them, and prevents a repeat request for a while.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Find someone */}
      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">Ask to connect with someone</h2>
        <p className="mb-4 text-sm text-ink-600 dark:text-parchment-300">
          Only members who have chosen to be discoverable appear in search.
        </p>

        <form onSubmit={search} className="flex flex-wrap gap-3">
          <label htmlFor="directoryQuery" className="sr-only">
            Search by display name
          </label>
          <input
            id="directoryQuery"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by display name"
            className="input min-w-[16rem] flex-1"
          />
          <button
            type="submit"
            disabled={searching}
            className="min-h-[2.75rem] rounded-lg border border-ink-300 px-5 text-sm dark:border-ink-700"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results !== null ? (
          results.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500 dark:text-parchment-400">
              No discoverable members matched that search.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {results.map((result) => (
                <li
                  key={result.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900"
                >
                  <div>
                    <p className="font-medium">{result.displayName}</p>
                    <p className="text-sm text-ink-500 dark:text-parchment-400">
                      {[result.country, result.ministryCenter].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTarget(result)}
                    className="min-h-[2.5rem] rounded-lg border border-ink-300 px-4 text-sm dark:border-ink-700"
                  >
                    Request to Connect
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      {/* Confirmation panel before a request is sent */}
      {target ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="connectTitle"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900">
            <h3 id="connectTitle" className="font-serif text-xl font-semibold">
              Request to connect with {target.displayName}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-parchment-300">
              You are requesting permission to communicate with this person. They must approve before
              a private conversation can begin.
            </p>

            <label htmlFor="introMessage" className="label mt-5">
              Why would you like to connect?{' '}
              <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <textarea
              id="introMessage"
              rows={3}
              maxLength={300}
              value={introMessage}
              onChange={(event) => setIntroMessage(event.target.value)}
              className="input resize-none"
            />
            <p className="mt-1.5 text-xs text-ink-500 dark:text-parchment-400">
              {introMessage.length}/300 · This is the only message you can send unless they accept.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={sendRequest}
                disabled={busy}
                className="min-h-[2.75rem] flex-1 rounded-lg bg-gold-sheen px-5 text-sm font-semibold text-ink-950 disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Send request'}
              </button>
              <button
                type="button"
                onClick={() => setTarget(null)}
                className="min-h-[2.75rem] rounded-lg border border-ink-300 px-5 text-sm dark:border-ink-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Existing state */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 font-serif text-xl font-semibold">Your connections</h2>
          {connections.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-300 p-5 text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
              You are not connected with anyone yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {connections.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900"
                >
                  <p className="font-medium">{entry.person.displayName}</p>
                  {entry.conversationId ? (
                    <a
                      href={`/app/messages/${entry.conversationId}`}
                      className="text-sm font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-400"
                    >
                      Message
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-serif text-xl font-semibold">Requests you have sent</h2>
          {outgoing.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-300 p-5 text-sm text-ink-500 dark:border-ink-700 dark:text-parchment-400">
              You have no requests waiting on a reply.
            </p>
          ) : (
            <ul className="space-y-3">
              {outgoing.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900"
                >
                  <p className="font-medium">{entry.person.displayName}</p>
                  <p className="mt-1 text-sm text-ink-500 dark:text-parchment-400">
                    Waiting for their decision. They will not be reminded, and you cannot send
                    another message until they accept.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
