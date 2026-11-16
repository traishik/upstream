/**
 * POST /api/e: first-party usage events (sent with navigator.sendBeacon).
 * Privacy: we never store IP addresses or user agents. Visitors with Global Privacy Control or
 * Do Not Track switched on are never tracked (the browser script doesn't send anything).
 */
import type { Env } from './_shared';

const EVENTS = new Set([
  'page_view', 'apply_click', 'save', 'unsave', 'search', 'filter', 'show_more', 'careers_click',
  'insider_submit', 'feedback_submit', 'ad_click', 'outbound', 'theme', 'encourage_hide',
]);
const PROP_KEYS = new Set(['company', 'job', 'fn', 'level', 'key', 'value', 'q', 'id', 'host', 'placement', 'results', 'theme']);
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : typeof v === 'number' ? v : undefined);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Same-site only.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return new Response(null, { status: 403 });
  const raw = await request.text();
  if (raw.length > 8_000) return new Response(null, { status: 413 });
  let body: { vid?: string; sid?: string; events?: { e: string; p?: string; props?: Record<string, unknown>; ref?: string }[] };
  try { body = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }

  const vid = /^[a-z0-9]{8,32}$/i.test(body.vid ?? '') ? body.vid! : null;
  const sid = /^[a-z0-9]{8,32}$/i.test(body.sid ?? '') ? body.sid! : null;
  const ua = request.headers.get('user-agent') ?? '';
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';
  const now = new Date();
  const day = now.toISOString().slice(0, 10);

  const rows = (body.events ?? []).slice(0, 20).filter((x) => EVENTS.has(x.e)).map((x) => {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x.props ?? {})) if (PROP_KEYS.has(k)) { const c = clip(v, 80); if (c !== undefined) props[k] = c; }
    let ref: string | null = null;
    try { ref = x.ref ? new URL(x.ref).hostname.slice(0, 80) : null; } catch { ref = null; }
    if (ref === new URL(request.url).hostname) ref = null;
    return env.DB.prepare('INSERT INTO events (day, ts, event, path, props, ref, device, vid, sid) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
      .bind(day, now.toISOString(), x.e, clip(x.p, 200) ?? null, Object.keys(props).length ? JSON.stringify(props) : null, x.e === 'page_view' ? ref : null, device, vid, sid);
  });
  if (rows.length) await env.DB.batch(rows);
  return new Response(null, { status: 204 });
};
