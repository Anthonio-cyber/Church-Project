import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/context';
import { channels, subscribe } from '@/lib/realtime';
import { assertSessionAccess } from '@/lib/domain/counselling';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-Sent Events stream.
 *
 * The subscription set is derived server-side from who the caller actually is.
 * A client may *ask* for a session or conversation channel, but it is only
 * granted after the same authorisation checks the REST routes use — so a
 * crafted channel name subscribes to nothing.
 */
export async function GET(request: Request) {
  const context = await requireUser();
  const url = new URL(request.url);

  const subscribed: string[] = [channels.user(context.user.id)];

  const conversationId = url.searchParams.get('conversationId');
  if (conversationId) {
    const membership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId: context.user.id },
      },
      select: { id: true, leftAt: true },
    });
    if (membership && !membership.leftAt) {
      subscribed.push(channels.conversation(conversationId));
    }
  }

  const sessionId = url.searchParams.get('sessionId');
  if (sessionId) {
    try {
      await assertSessionAccess(context, sessionId);
      subscribed.push(channels.counsellingSession(sessionId));
    } catch {
      // Not a participant: the channel is simply not added.
    }
  }

  const counsellor = await prisma.counsellor.findUnique({
    where: { userId: context.user.id },
    select: { id: true, status: true },
  });
  if (counsellor?.status === 'APPROVED') {
    subscribed.push(channels.counsellorQueue(counsellor.id));
  }

  if (context.permissions.has('security.manage')) {
    subscribed.push(channels.securityAlerts());
  }

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // The client has gone away; cleanup happens in cancel().
        }
      };

      send(`retry: 5000\n`);
      send(`event: ready\ndata: ${JSON.stringify({ channels: subscribed })}\n\n`);

      unsubscribe = subscribe(subscribed, (event) => {
        send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });

      // Comment frames keep proxies from closing an idle connection.
      heartbeat = setInterval(() => send(`: keep-alive\n\n`), 25_000);

      request.signal.addEventListener('abort', () => {
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
