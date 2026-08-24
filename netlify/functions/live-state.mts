import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

/**
 * Live-state sync for spectator devices.
 *
 * POST /api/live-state?group=<name>  — organizer device publishes its live
 *   scoreboards/standings (JSON body).
 * GET  /api/live-state?group=<name>  — spectator devices poll for the payload
 *   (returns null if the group has never gone live).
 *
 * Storage is Netlify Blobs under the 'padel-indiano-live' store, keyed by the
 * one-word group name. No auth by design (friends-at-the-court app).
 */

const GROUP_PATTERN = /^[a-z0-9_-]{1,24}$/;
const MAX_BODY_BYTES = 256 * 1024;

const jsonHeaders = (): Record<string, string> => ({
  'content-type': 'application/json',
  'cache-control': 'no-store'
});

export default async (req: Request, _context: Context) => {
  const group = (new URL(req.url).searchParams.get('group') ?? '').toLowerCase();
  if (!GROUP_PATTERN.test(group)) {
    return new Response(JSON.stringify({ error: 'invalid group name' }), {
      status: 400,
      headers: jsonHeaders()
    });
  }

  const store = getStore('padel-indiano-live');

  if (req.method === 'POST') {
    const body = await req.text();
    if (body.length === 0 || body.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: 'payload missing or too large' }), {
        status: 413,
        headers: jsonHeaders()
      });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: 'body must be valid JSON' }), {
        status: 400,
        headers: jsonHeaders()
      });
    }
    await store.setJSON(group, parsed);
    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders() });
  }

  if (req.method === 'GET') {
    const data = await store.get(group, { type: 'json' });
    return new Response(JSON.stringify(data ?? null), { headers: jsonHeaders() });
  }

  return new Response(JSON.stringify({ error: 'method not allowed' }), {
    status: 405,
    headers: jsonHeaders()
  });
};

export const config: Config = {
  path: '/api/live-state'
};
