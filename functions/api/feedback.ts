/** POST /api/feedback: stores one feedback note in D1. */
import { EMAIL_RE, clean, id, rateLimited, readBody, reply, verifyTurnstile, type Env } from './_shared';

const TYPES = new Set(['idea', 'bug', 'missing-company', 'praise', 'other']);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const back = '/feedback';
  let b: Record<string, string>;
  try { b = await readBody(request); } catch { return reply(request, false, back, { error: 'too-large' }, 413); }

  if (b.website) return reply(request, true, back, {}); // honeypot: bots fill hidden fields; pretend success
  if (await rateLimited(env, request, 'feedback')) return reply(request, false, back, { error: 'slow-down' }, 429);

  const type = clean(b.type, 20);
  const message = clean(b.message, 2000);
  const email = clean(b.email, 254);
  const context = clean([b.topic && `topic=${b.topic}`, b.company && `company=${b.company}`, b.job && `job=${b.job}`, b.report && `report=${b.report}`].filter(Boolean).join('&'), 300);
  const errors: string[] = [];
  if (!TYPES.has(type)) errors.push('type');
  if (message.length < 3) errors.push('message');
  if (email && !EMAIL_RE.test(email)) errors.push('email');
  if (errors.length) return reply(request, false, back, { error: errors.join(',') });

  if (!(await verifyTurnstile(b['cf-turnstile-response'] ?? '', env.TURNSTILE_SECRET))) {
    return reply(request, false, back, { error: 'verification' }, 403);
  }

  // Reports from Inside Track cards bump that note's counter for the moderation queue.
  const reportId = clean(b.report, 64);
  await env.DB.prepare(
    'INSERT INTO feedback (id, created_at, type, message, email, can_quote, context) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
  ).bind(id(), new Date().toISOString(), reportId ? 'report' : type, message, email || null, b.quote === 'on' || b.quote === 'true' ? 1 : 0, context || null).run();
  if (reportId) await env.DB.prepare('UPDATE insider_notes SET reports = reports + 1 WHERE id = ?1').bind(reportId).run();

  // Never echo personal data back. Just a thank-you.
  return reply(request, true, back, { message: 'Thank you. We read every note.' });
};
