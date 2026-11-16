/**
 * POST /api/insiders: an Inside Track tip and/or referral, held for moderation.
 * Safety rules (docs/inside-track.md):
 *  - referral links must sit on the company's own domain or its verified job board (allowlist)
 *  - no email addresses or phone numbers in anything that could be published
 *  - nothing is public until the owner approves it (scripts/admin.ts)
 */
import { CONTACT_RE, EMAIL_RE, clean, id, rateLimited, readBody, reply, verifyTurnstile, type Env } from './_shared';

type Allowlist = Record<string, { name: string; prefixes: string[] }>;
const REFERRAL_DAYS = 90;

/** True if url is https and starts with one of the company's allowed host/path prefixes. */
export function referralAllowed(url: string, prefixes: string[]): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const hostPath = `${host}${u.pathname.toLowerCase()}`;
  return prefixes.some((p) => {
    const pref = p.toLowerCase().replace(/^www\./, '');
    if (!pref.includes('/')) return host === pref || host.endsWith(`.${pref}`);
    return hostPath === pref || hostPath.startsWith(pref.endsWith('/') ? pref : `${pref}/`);
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const back = '/insiders/share';
  let b: Record<string, string>;
  try { b = await readBody(request); } catch { return reply(request, false, back, { error: 'too-large' }, 413); }
  if (b.website) return reply(request, true, back, {});
  if (await rateLimited(env, request, 'insiders')) return reply(request, false, back, { error: 'slow-down' }, 429);

  const allow = (await (await env.ASSETS.fetch(new URL('/data/insiders-allowlist.json', request.url))).json()) as Allowlist;
  const company = clean(b.company, 60);
  const name = clean(b.name, 40);
  const role = clean(b.role, 60);
  const tenure = clean(b.tenure, 20);
  const tip = clean(b.tip, 600);
  const referralUrl = clean(b.referral_url, 500);
  const referralNote = clean(b.referral_note, 140);
  const replyEmail = clean(b.reply_email, 254);

  const errors: string[] = [];
  const entry = allow[company];
  if (!entry) errors.push('company');
  if (!tip && !referralUrl) errors.push('tip-or-referral');
  if (tip && tip.length < 20) errors.push('tip-too-short');
  if (referralUrl && entry && !referralAllowed(referralUrl, entry.prefixes)) errors.push('referral-domain');
  if ([name, role, tenure, tip, referralNote].some((t) => t && CONTACT_RE.test(t))) errors.push('contact-details');
  if (replyEmail && !EMAIL_RE.test(replyEmail)) errors.push('email');
  if (b.confirm !== 'on' && b.confirm !== 'true') errors.push('confirm');
  if (errors.length) return reply(request, false, back, { error: errors.join(',') });

  if (!(await verifyTurnstile(b['cf-turnstile-response'] ?? '', env.TURNSTILE_SECRET))) {
    return reply(request, false, back, { error: 'verification' }, 403);
  }

  const now = new Date();
  const expires = referralUrl ? new Date(now.getTime() + REFERRAL_DAYS * 864e5).toISOString() : null;
  await env.DB.prepare(
    `INSERT INTO insider_notes (id, created_at, company, name, role, tenure, tip, referral_url, referral_note, reply_email, renew_token, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
  ).bind(id(), now.toISOString(), company, name || null, role || null, tenure || null, tip || null, referralUrl || null, referralNote || null, replyEmail || null, id(), expires).run();

  return reply(request, true, back, { message: 'Thank you for paying it forward. We review every note, usually within a few days.' });
};
