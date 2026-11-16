/** Shared types and helpers for job data, usable from Astro pages and React islands. */

export interface Row {
  i: string; c: string; t: string; f: string; l: string; e: string; w: string;
  loc: string[]; p?: number; fs: number; v: number; fl?: 1; s?: string;
}
export interface CompanyInfo { slug: string; name: string; tier: 'A' | 'B' | 'C'; mode: 'fetch' | 'link-only'; careersUrl: string; logo?: string; count: number; dated?: number; longOpen?: number }
export interface Facet { id: string; label: string; count: number }
export interface Manifest {
  generatedAt: string; total: number; newToday: number; includeFrontline: boolean; staleCompanies: string[];
  functions: Facet[]; levels: Facet[]; employment: Record<string, number>; workplace: Record<string, number>;
  companies: CompanyInfo[]; newest: Row[];
}
export interface JobRecord {
  id: string; company: string; title: string; function: string; level: string; employmentType: string; isFrontline: boolean;
  locations: string[]; workplace: string; team?: string; postedAt?: string; firstSeenAt: string; lastVerifiedAt: string;
  applyUrl: string; sourceUrl: string; descriptionHtml?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; period?: string; text?: string };
}

export const EMPLOYMENT: Record<string, string> = { 'full-time': 'Full-time', 'part-time': 'Part-time', internship: 'Internship', contract: 'Contract / Temporary' };
export const WORKPLACE: Record<string, string> = { onsite: 'Onsite', hybrid: 'Hybrid', remote: 'Remote' };
export const LEVEL_SHORT: Record<string, string> = {
  internship: 'Internship', 'new-grad': 'Early career', mid: 'Mid', senior: 'Senior', staff: 'Staff / Principal',
  manager: 'Manager', 'senior-manager': 'Senior Manager', director: 'Director', vp: 'VP & Executive',
};

export const minToMs = (m: number) => m * 60_000;
export const shardOf = (id: string) => id.slice(0, 2);

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, (now - ms) / 1000);
  if (s < 90) return 'just now';
  const m = s / 60;
  if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 36) return `${Math.round(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)}d ago`;
  return `${Math.round(d / 30)}mo ago`;
}

/** Newest-N jobs are pre-rendered at /jobs/<id>/ for search engines; the rest render on /jobs/view/. */
export const jobHref = (id: string, prerendered?: Set<string>) =>
  prerendered && !prerendered.has(id) ? `/jobs/view/?id=${id}` : `/jobs/${id}/`;

export const postedOrSeen = (r: Row) => minToMs(r.p ?? r.fs);

export function formatSalary(s?: JobRecord['salaryRange']): string | undefined {
  if (!s) return undefined;
  if (s.min || s.max) {
    const cur = !s.currency || s.currency === 'USD' ? '$' : `${s.currency} `;
    const fmt = (n?: number) => (n ? `${cur}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '');
    const per = /hour/i.test(s.period ?? '') ? ' / hour' : /year|annual/i.test(s.period ?? '') || !s.period ? ' / year' : ` / ${s.period?.toLowerCase()}`;
    return [fmt(s.min), fmt(s.max)].filter(Boolean).join(' – ') + per;
  }
  return s.text;
}

/** Local saved roles (no accounts). */
export interface SavedEntry { id: string; t: string; c: string; savedAt: number }
const SAVED_KEY = 'upstream:saved';
export function readSaved(): Record<string, SavedEntry> {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '{}'); } catch { return {}; }
}
export function writeSaved(v: Record<string, SavedEntry>) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

/**
 * Ghost-job radar. How long a role has been open, from the company's own "posted" date when the
 * source provides one (otherwise from when we first saw it, which can only under-count).
 * Long-open roles aren't necessarily fake: some are evergreen pipelines. We flag them so people
 * can decide where to spend their energy.
 */
export const RADAR = { freshDays: 3, longDays: 60, evergreenDays: 120 } as const;
export type Freshness = { days: number; basis: 'posted' | 'seen'; tier: 'fresh' | 'normal' | 'long' | 'evergreen' };
export function freshness(r: Pick<Row, 'p' | 'fs'>, now = Date.now()): Freshness {
  const basis = r.p ? 'posted' : 'seen';
  const days = Math.max(0, Math.floor((now - minToMs(r.p ?? r.fs)) / 864e5));
  const tier = days <= RADAR.freshDays ? 'fresh' : days >= RADAR.evergreenDays ? 'evergreen' : days >= RADAR.longDays ? 'long' : 'normal';
  // We can only call something long-open from a real posted date.
  return { days, basis, tier: basis === 'seen' && tier !== 'fresh' && tier !== 'normal' ? 'normal' : tier };
}
export const freshnessLabel = (f: Freshness) =>
  f.tier === 'fresh' ? (f.days === 0 ? 'Posted today' : `Fresh · ${f.days}d`) :
  f.basis === 'posted' ? `Open ${f.days} days` : `Seen ${f.days}+ days`;
