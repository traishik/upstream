/**
 * Build-time allowlist for Inside Track referral links: for each company, the host/path prefixes
 * of its own careers domain and the exact job board it publishes to (from config/companies.yaml).
 * The /api/insiders function reads this file; anything else is rejected.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { fromRoot } from '@/lib/root';

interface C { name: string; slug: string; enabled: boolean; careersUrl: string; proofUrl?: string; source?: string; board?: string; host?: string }
const ATS: Record<string, (c: C) => string[]> = {
  greenhouse: (c) => [`boards.greenhouse.io/${c.board}`, `job-boards.greenhouse.io/${c.board}`],
  lever: (c) => [`jobs.lever.co/${c.board}`],
  ashby: (c) => [`jobs.ashbyhq.com/${c.board}`],
  rippling: (c) => [`ats.rippling.com/${c.board}`],
  workday: (c) => (c.host ? [c.host] : []),
  oracle: (c) => (c.host ? [c.host] : []),
  amazon: () => ['amazon.jobs'],
  apple: () => ['jobs.apple.com'],
  tiktok: () => ['lifeattiktok.com'],
  amd: () => ['careers.amd.com'],
};
const host = (u?: string) => { try { return u ? new URL(u).hostname.replace(/^www\./, '') : undefined; } catch { return undefined; } };

export function GET() {
  const { companies } = parse(readFileSync(fromRoot('config', 'companies.yaml'), 'utf8')) as { companies: C[] };
  const out: Record<string, { name: string; prefixes: string[] }> = {};
  for (const c of companies) {
    if (!c.enabled) continue;
    const prefixes = new Set<string>([host(c.careersUrl), host(c.proofUrl), ...(c.source ? ATS[c.source]?.(c) ?? [] : [])].filter(Boolean) as string[]);
    out[c.slug] = { name: c.name, prefixes: [...prefixes] };
  }
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json' } });
}
