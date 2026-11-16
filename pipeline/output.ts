/**
 * Writes the static data the site reads (section 4.8):
 *  public/data/manifest.json   counts, facets, companies, newest roles (small; loaded first)
 *  public/data/idx/<fn>.json   listing rows without descriptions, one file per function
 *  public/data/desc/<xx>.json  full job records in 256 hash-bucketed shards, fetched on demand
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Classifier } from './classify.ts';
import type { Company, Job } from './types.ts';

export const toMin = (iso?: string) => (iso ? Math.round(new Date(iso).getTime() / 60000) : undefined);
export const shardOf = (id: string) => id.slice(0, 2);

/** Compact listing row. Keys are short on purpose: this is what the browser downloads. */
export interface Row {
  i: string; c: string; t: string; f: string; l: string; e: string; w: string;
  loc: string[]; p?: number; fs: number; v: number; fl?: 1; s?: string;
}

const salaryText = (s: Job['salaryRange']) => {
  if (!s) return undefined;
  if (s.min || s.max) {
    const fmt = (n?: number) => (n ? (n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`) : '');
    const per = /hour/i.test(s.period ?? '') ? '/hr' : '';
    return [fmt(s.min), fmt(s.max)].filter(Boolean).join('–') + per;
  }
  return s.text;
};

export function toRow(j: Job): Row {
  return {
    i: j.id, c: j.company, t: j.title, f: j.function, l: j.level, e: j.employmentType, w: j.workplace,
    loc: j.locations.slice(0, 3), p: toMin(j.postedAt), fs: toMin(j.firstSeenAt)!, v: toMin(j.lastVerifiedAt)!,
    ...(j.isFrontline ? { fl: 1 as const } : {}),
    ...(salaryText(j.salaryRange) ? { s: salaryText(j.salaryRange) } : {}),
  };
}

export function writeOutputs(opts: {
  publicDir: string; jobs: Job[]; companies: Company[]; cls: Classifier; generatedAt: string;
  includeFrontline: boolean; newestForHome: number; staleCompanies: string[];
}) {
  const { publicDir, jobs, companies, cls, generatedAt } = opts;
  rmSync(join(publicDir, 'idx'), { recursive: true, force: true });
  rmSync(join(publicDir, 'desc'), { recursive: true, force: true });
  mkdirSync(join(publicDir, 'idx'), { recursive: true });
  mkdirSync(join(publicDir, 'desc'), { recursive: true });

  const byNewest = [...jobs].sort((a, b) => (toMin(b.postedAt) ?? toMin(b.firstSeenAt)!) - (toMin(a.postedAt) ?? toMin(a.firstSeenAt)!));
  const byFn = new Map<string, Row[]>();
  const shards = new Map<string, Record<string, Job>>();
  for (const j of byNewest) {
    const row = toRow(j);
    (byFn.get(j.function) ?? byFn.set(j.function, []).get(j.function)!).push(row);
    const k = shardOf(j.id);
    (shards.get(k) ?? shards.set(k, {}).get(k)!)[j.id] = j;
  }
  const sizes: Record<string, number> = {};
  for (const [fn, rows] of byFn) {
    const body = JSON.stringify(rows);
    sizes[`idx/${fn}.json`] = body.length;
    writeFileSync(join(publicDir, 'idx', `${fn}.json`), body);
  }
  for (const [k, rec] of shards) writeFileSync(join(publicDir, 'desc', `${k}.json`), JSON.stringify(rec));

  const count = <K extends string>(key: (j: Job) => K) => jobs.reduce<Record<string, number>>((m, j) => ((m[key(j)] = (m[key(j)] ?? 0) + 1), m), {});
  const perCompany = count((j) => j.company);
  // Ghost-job radar per company: share of roles (with a real posted date) open 60+ days.
  const longCut = Date.now() - 60 * 864e5;
  const dated = count((j) => (j.postedAt ? j.company : '_'));
  const longOpen = count((j) => (j.postedAt && new Date(j.postedAt).getTime() < longCut ? j.company : '_'));
  const dayAgo = Date.now() - 864e5;
  const manifest = {
    generatedAt,
    total: jobs.length,
    newToday: jobs.filter((j) => new Date(j.firstSeenAt).getTime() >= dayAgo).length,
    includeFrontline: opts.includeFrontline,
    staleCompanies: opts.staleCompanies,
    functions: cls.functions.map((f) => ({ ...f, count: byFn.get(f.id)?.length ?? 0 })),
    levels: cls.levels.map((l) => ({ ...l, count: jobs.filter((j) => j.level === l.id).length })),
    employment: count((j) => j.employmentType),
    workplace: count((j) => j.workplace),
    companies: companies
      .filter((c) => c.enabled)
      .map((c) => ({ slug: c.slug, name: c.name, tier: c.tier, mode: c.mode, careersUrl: c.careersUrl, logo: c.logo, count: perCompany[c.slug] ?? 0, dated: dated[c.slug] ?? 0, longOpen: longOpen[c.slug] ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    newest: byNewest.slice(0, opts.newestForHome).map(toRow),
  };
  writeFileSync(join(publicDir, 'manifest.json'), JSON.stringify(manifest));
  return { files: byFn.size + shards.size + 1, idxBytes: Object.values(sizes).reduce((a, b) => a + b, 0), manifestBytes: JSON.stringify(manifest).length };
}
