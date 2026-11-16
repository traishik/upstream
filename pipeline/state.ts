/** Run-to-run memory: first-seen times, verification times, last-known jobs (for the 24h grace). */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { Validators } from './http.ts';
import type { Job } from './types.ts';

export interface StoredJob {
  job: Job;
  sourceId: string;
  lastSeenAt: string;              // last time it was in the company's feed
  check: 'pending' | 'live';       // dead jobs are deleted
  lastCheckAt?: string;
  checkMethod?: 'page' | 'api' | 'feed';
}

export interface State {
  version: 1;
  jobs: Record<string, StoredJob>;
  companies: Record<string, { lastSuccessAt?: string; lastAttemptAt?: string; lastError?: string }>;
  validators: Record<string, Validators>;
  lastPublishedTotal?: number;
}

const empty = (): State => ({ version: 1, jobs: {}, companies: {}, validators: {} });

export function loadState(path: string): State {
  const gz = `${path}.gz`;
  try {
    if (existsSync(gz)) return JSON.parse(gunzipSync(readFileSync(gz)).toString('utf8'));
  } catch (e) {
    console.warn(`state unreadable, starting fresh: ${(e as Error).message}`);
  }
  return empty();
}

/**
 * Cold start (e.g. GitHub's cache was evicted): rebuild memory from the live site's own published
 * data, so first-seen dates and verification times survive and nothing is needlessly re-checked.
 */
export async function seedFromSite(siteUrl: string, log: (m: string) => void): Promise<State> {
  const s = empty();
  try {
    const res = await fetch(new URL('/data/manifest.json', siteUrl));
    if (!res.ok) { log(`no live data to seed from (${res.status})`); return s; }
    const shards = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
    let n = 0;
    for (const k of shards) {
      const r = await fetch(new URL(`/data/desc/${k}.json`, siteUrl));
      if (!r.ok) continue;
      const jobs = (await r.json()) as Record<string, Job & { sourceId?: string }>;
      for (const [id, job] of Object.entries(jobs)) {
        // sourceId isn't published; the next fetch re-attaches it by job id.
        s.jobs[id] = { job, sourceId: '', lastSeenAt: job.lastVerifiedAt, check: 'live', lastCheckAt: job.lastVerifiedAt };
        n++;
      }
    }
    s.lastPublishedTotal = n;
    log(`seeded ${n} jobs from ${siteUrl}`);
  } catch (e) {
    log(`seeding failed: ${(e as Error).message}`);
  }
  return s;
}

export function saveState(path: string, s: State) {
  const gz = `${path}.gz`;
  mkdirSync(dirname(gz), { recursive: true });
  writeFileSync(`${gz}.tmp`, gzipSync(JSON.stringify(s)));
  renameSync(`${gz}.tmp`, gz); // atomic: a crash never leaves a half-written state
}
