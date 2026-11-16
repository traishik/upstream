/**
 * Shared helpers for the two small Pages Functions (the only server-side code on the site).
 * Privacy: no IP address is ever stored. Turnstile is verified without sending the IP, and the
 * optional rate limiter uses a one-way hash that lives only in Cloudflare's short-lived counter.
 */

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  TURNSTILE_SECRET: string;
  /** Optional Workers rate-limiting binding. Without it, use the free WAF rate-limit rule (README). */
  RATE_LIMITER?: { limit(o: { key: string }): Promise<{ success: boolean }> };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/** Form posts without JavaScript get redirected back with a status flag; fetch() calls get JSON. */
export function reply(req: Request, ok: boolean, back: string, body: Record<string, unknown>, status = ok ? 200 : 400) {
  const wantsJson = (req.headers.get('accept') ?? '').includes('application/json');
  if (wantsJson) return json({ ok, ...body }, status);
  const u = new URL(back, req.url);
  u.searchParams.set(ok ? 'sent' : 'error', ok ? '1' : String(body.error ?? 'invalid'));
  return Response.redirect(u.toString(), 303);
}

export async function readBody(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get('content-type') ?? '';
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > 16_384) throw new Error('too-large');
  if (type.includes('application/json')) {
    const raw = await req.text();
    if (raw.length > 16_384) throw new Error('too-large');
    const o = JSON.parse(raw);
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v : String(v ?? '')]));
  }
  const form = await req.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

/** Trim, collapse control characters, and cap length. Returns '' for missing values. */
export const clean = (v: string | undefined, max: number) =>
  (v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

export const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}$/;
/** Contact details aren't allowed in public text (tips, names, notes). */
export const CONTACT_RE = /[^\s@]+@[^\s@]+\.[a-z]{2,}|(\+?\d[\d\s().-]{8,}\d)/i;

export async function verifyTurnstile(token: string, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token }), // deliberately no remoteip
  });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

/** Best-effort rate limit (5 submissions/min per visitor). The key is a salted hash, never stored by us. */
export async function rateLimited(env: Env, req: Request, scope: string): Promise<boolean> {
  if (!env.RATE_LIMITER) return false;
  const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${scope}:${ip}:${new Date().toISOString().slice(0, 10)}`));
  const key = [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
  const { success } = await env.RATE_LIMITER.limit({ key });
  return !success;
}

export const id = () => crypto.randomUUID();
