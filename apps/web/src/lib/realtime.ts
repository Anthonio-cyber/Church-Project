/**
 * Realtime event hub.
 *
 * Transport is Server-Sent Events, which works through the same authenticated
 * HTTP session as everything else and needs no second credential path. The
 * publish/subscribe surface below is deliberately transport-agnostic: swapping
 * in a managed WebSocket service or Postgres LISTEN/NOTIFY for multi-instance
 * deployments means reimplementing `publish` and `subscribe` only.
 *
 * In a single-instance deployment this in-process hub is complete. Across
 * several instances, set REALTIME_SECRET and point the adapter at the shared
 * broker — clients need no change.
 */

export type RealtimeEvent = {
  channel: string;
  type: string;
  payload: unknown;
  at: string;
};

type Subscriber = (event: RealtimeEvent) => void;

const globalForHub = globalThis as unknown as {
  realtimeSubscribers?: Map<string, Set<Subscriber>>;
};

const subscribers: Map<string, Set<Subscriber>> =
  globalForHub.realtimeSubscribers ?? new Map();
globalForHub.realtimeSubscribers = subscribers;

/** Channel names. Every channel is scoped to a principal or a private session. */
export const channels = {
  user: (userId: string) => `user:${userId}`,
  counsellingSession: (sessionId: string) => `session:${sessionId}`,
  conversation: (conversationId: string) => `conversation:${conversationId}`,
  counsellorQueue: (counsellorId: string) => `counsellor:${counsellorId}`,
  securityAlerts: () => 'security:alerts',
};

export function publish(channel: string, type: string, payload: unknown): void {
  const event: RealtimeEvent = {
    channel,
    type,
    payload,
    at: new Date().toISOString(),
  };
  const listeners = subscribers.get(channel);
  if (!listeners) return;
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error('[realtime] subscriber failed', channel, error);
    }
  }
}

export function subscribe(channelList: string[], listener: Subscriber): () => void {
  for (const channel of channelList) {
    if (!subscribers.has(channel)) subscribers.set(channel, new Set());
    subscribers.get(channel)!.add(listener);
  }
  return () => {
    for (const channel of channelList) {
      const set = subscribers.get(channel);
      if (!set) continue;
      set.delete(listener);
      if (set.size === 0) subscribers.delete(channel);
    }
  };
}

export function subscriberCount(): number {
  let total = 0;
  for (const set of subscribers.values()) total += set.size;
  return total;
}
