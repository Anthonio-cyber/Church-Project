import { ok, route } from '@/lib/api';
import { requireUser } from '@/lib/auth/context';
import { searchDirectory } from '@/lib/domain/connections';

export const dynamic = 'force-dynamic';

/**
 * Member directory search.
 *
 * Deliberately narrow: at least three characters, only members who opted in to
 * being discoverable, never minors, never blocked relationships, and the result
 * carries no email address or account status. There is no way to page through
 * the membership.
 */
export const GET = route(async (request: Request) => {
  const context = await requireUser();
  const url = new URL(request.url);
  const query = url.searchParams.get('q') ?? '';

  if (query.trim().length < 3) {
    return ok({ results: [], message: 'Type at least three characters to search.' });
  }

  const results = await searchDirectory(context.user.id, query);
  return ok({ results });
});
