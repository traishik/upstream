/** Build-time access to pipeline output (public/data). Pages render with whatever the last run produced. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { projectRoot } from './root';
import type { JobRecord, Manifest, Row } from './jobs';

const DATA = join(projectRoot(), 'public', 'data');

const emptyManifest: Manifest = {
  generatedAt: new Date(0).toISOString(), total: 0, newToday: 0, includeFrontline: false, staleCompanies: [],
  functions: [], levels: [], employment: {}, workplace: {}, companies: [], newest: [],
};

export function loadManifest(): Manifest {
  const p = join(DATA, 'manifest.json');
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Manifest) : emptyManifest;
}

export function loadAllRows(): Row[] {
  const dir = join(DATA, 'idx');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Row[]);
}

const shardCache = new Map<string, Record<string, JobRecord>>();
export function loadJob(id: string): JobRecord | undefined {
  const k = id.slice(0, 2);
  if (!shardCache.has(k)) {
    const p = join(DATA, 'desc', `${k}.json`);
    shardCache.set(k, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {});
  }
  return shardCache.get(k)![id];
}

export function loadRunReport(): any | null {
  const p = join(DATA, 'run-report.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}
