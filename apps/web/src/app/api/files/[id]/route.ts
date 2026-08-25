import { z } from 'zod';
import { route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { dispositionFor, readFile } from '@/lib/domain/files';
import { canReadConversation } from '@/lib/domain/messaging';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid() });

/**
 * Serve an uploaded file.
 *
 * Every file goes out through here, and every request is authenticated, so
 * nothing uploaded to this platform is reachable by an anonymous fetch of a
 * guessed URL. Each purpose states its own rule below; a new purpose must add
 * one rather than inheriting whatever the previous case allowed.
 */
export const GET = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    // Throws unless there is a valid session. Signing in is the floor, not the
    // whole rule — the per-purpose check follows.
    const context = await requireUser();

    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return new Response('Not found', { status: 404 });
    }

    const file = await readFile(parsed.data.id);
    if (!file) {
      return new Response('Not found', { status: 404 });
    }

    switch (file.purpose) {
      case 'AVATAR':
        // Avatars are already shown to other members through the connections
        // list, the counsellor directory and session pages. Any signed-in
        // member may therefore load one; the id is a UUID, so they cannot be
        // enumerated by anyone who has not been shown them.
        break;

      case 'MESSAGE_ATTACHMENT': {
        // Readable by exactly the people who can read the conversation it was
        // shared in — no wider. Note this is the *read* rule, not the write
        // rule: someone may still open a document from a pastoral session
        // that has since ended, which is the same as being able to scroll
        // back through what was said.
        //
        // Safeguarding staff are deliberately not admitted here. Their route
        // into counselling records is the safeguarding portal, where access
        // requires a written reason and is recorded; a plain file fetch would
        // be neither.
        if (!file.conversationId) {
          return new Response('Not found', { status: 404 });
        }
        if (!(await canReadConversation(context.user.id, file.conversationId))) {
          return new Response('Not found', { status: 404 });
        }
        break;
      }
      default: {
        // A purpose with no rule is refused rather than served. This is the
        // branch that makes adding a purpose without a decision impossible.
        const exhaustive: never = file.purpose;
        console.error(`[files] no access rule for purpose ${String(exhaustive)}`);
        return new Response('Not found', { status: 404 });
      }
    }

    return new Response(new Uint8Array(file.data), {
      status: 200,
      headers: {
        // The sniffed type, never the uploader's claim.
        'Content-Type': file.contentType,
        'Content-Length': String(file.byteSize),
        // Belt and braces with the global nosniff header: even if the stored
        // type were somehow wrong, the browser must not go looking for a
        // better one.
        'X-Content-Type-Options': 'nosniff',
        // Images render in place; a PDF downloads rather than opening in the
        // browser's own viewer, which runs script this page's CSP cannot reach.
        'Content-Disposition': dispositionFor(file.contentType, file.fileName),
        // Cache-Control and Content-Security-Policy are deliberately not set
        // here. next.config.mjs already sets both for this path — `no-store`
        // for every /api/ route, and a locked-down `default-src 'none';
        // sandbox` for /api/files specifically — and a header set there wins
        // over one set here. Setting them again would be dead code that reads
        // as protection.
      },
    });
  },
);
