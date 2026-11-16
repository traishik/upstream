import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { Company } from './types.ts';

const root = new URL('../', import.meta.url);
const readYaml = <T>(rel: string): T => parse(readFileSync(new URL(rel, root), 'utf8')) as T;

export interface PipelineConfig {
  cadence: string;
  includeFrontline: boolean;
  userAgent: string;
  http: { minIntervalMsPerHost: number; timeoutMs: number; maxRetries: number };
  failureGraceHours: number;
  maxDropFraction: number;
  details: { maxPerCompanyPerRun: number };
  liveness: { recheckEveryHours: number; maxChecksPerHostPerRun: number; timeBudgetMinutes: number; concurrencyHosts: number };
  output: { publicDir: string; stateFile: string; reportFile: string; descShards: number; newestForHome: number };
}

export const loadPipelineConfig = () => readYaml<PipelineConfig>('config/pipeline.yaml');

export function loadCompanies(): { companies: Company[]; denylist: string[] } {
  const { companies, denylist = [] } = readYaml<{ companies: Company[]; denylist?: string[] }>('config/companies.yaml');
  const seen = new Set<string>();
  const out: Company[] = [];
  for (const c of companies) {
    if (seen.has(c.slug)) continue; // dedupe: first tier wins
    seen.add(c.slug);
    if (denylist.includes(c.slug)) continue;
    out.push(c);
  }
  return { companies: out, denylist };
}

/** Absolute filesystem path (safe with spaces in folder names). */
export const repoPath = (rel: string) => fileURLToPath(new URL(rel, root));
