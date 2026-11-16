/**
 * Apply-link verification.
 *  1. Primary check (in run.ts): the job is in the company's most recent successful feed.
 *  2. This module: the apply link answers 2xx, isn't a "no longer accepting" page, and didn't
 *     redirect to a generic search page. JS-app sources are checked through their per-job API.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { Http } from './http.ts';
import { HttpError, RobotsDisallowed } from './http.ts';
import type { Company, Job, SourceType } from './types.ts';

export type Verdict = { status: 'live' | 'dead' | 'unknown'; method: 'page' | 'api' | 'feed'; reason?: string };

interface LivenessYaml { deadPatterns: string[]; genericLandingPatterns: string[]; apiVerified: SourceType[] }
const cfg = parse(readFileSync(new URL('../config/liveness.yaml', import.meta.url), 'utf8')) as LivenessYaml;
const DEAD = cfg.deadPatterns.map((p) => new RegExp(p, 'i'));
const LANDING = cfg.genericLandingPatterns.map((p) => new RegExp(p, 'i'));
const API_VERIFIED = new Set(cfg.apiVerified);

/** Strip tags/scripts so patterns test visible text only. */
const visibleText = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

export function judgePage(job: Pick<Job, 'applyUrl'>, sourceId: string, r: { status: number; finalUrl: string; body: string; redirected: boolean }): Verdict {
  if (r.status === 404 || r.status === 410) return { status: 'dead', method: 'page', reason: `HTTP ${r.status}` };
  if (r.status < 200 || r.status >= 300) return { status: 'unknown', method: 'page', reason: `HTTP ${r.status}` };
  if (r.redirected) {
    const final = new URL(r.finalUrl);
    const orig = new URL(job.applyUrl);
    const keepsId = r.finalUrl.includes(sourceId) || final.pathname === orig.pathname;
    if (!keepsId && LANDING.some((re) => re.test(final.pathname + final.search))) {
      return { status: 'dead', method: 'page', reason: `redirected to ${final.pathname}` };
    }
  }
  const text = visibleText(r.body);
  const hit = DEAD.find((re) => re.test(text));
  if (hit) return { status: 'dead', method: 'page', reason: `page says: ${text.match(hit)?.[0]}` };
  return { status: 'live', method: 'page' };
}

/** Per-source API check for JS-app careers sites. */
async function apiCheck(http: Http, company: Company, job: Job, sourceId: string): Promise<Verdict> {
  try {
    switch (company.source) {
      case 'workday': {
        const d = await http.json<any>(`https://${company.host}/wday/cxs/${company.tenant}/${company.site}${sourceId}`);
        const ok = d?.jobPostingInfo && d.jobPostingInfo.posted !== false && d.jobPostingInfo.canApply !== false;
        return { status: ok ? 'live' : 'dead', method: 'api', reason: ok ? undefined : 'not accepting applications' };
      }
      case 'oracle': {
        const d = await http.json<any>(`https://${company.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?onlyData=true&finder=ById;Id=%22${sourceId}%22,siteNumber=${company.siteNumber}`);
        return d.items?.length ? { status: 'live', method: 'api' } : { status: 'dead', method: 'api', reason: 'requisition gone' };
      }
      case 'rippling': {
        await http.json<any>(`https://ats.rippling.com/api/v2/board/${company.board}/jobs/${sourceId}`);
        return { status: 'live', method: 'api' };
      }
      case 'lever': {
        await http.json<any>(`https://api.lever.co/v0/postings//`);
        return { status: 'live', method: 'api' };
      }
      case 'greenhouse': {
        await http.json<any>(`https://boards-api.greenhouse.io/v1/boards/${company.board}/jobs/${sourceId}`);
        return { status: 'live', method: 'api' };
      }
      default:
        // TikTok / Ashby: the feed is the posting API itself; membership in the latest feed is the check.
        return { status: 'live', method: 'feed' };
    }
  } catch (e) {
    if (e instanceof HttpError && (e.status === 404 || e.status === 410)) return { status: 'dead', method: 'api', reason: `HTTP ${e.status}` };
    return { status: 'unknown', method: 'api', reason: String((e as Error).message ?? e) };
  }
}

export async function verify(http: Http, company: Company, job: Job, sourceId: string): Promise<Verdict> {
  if (API_VERIFIED.has(company.source!)) return apiCheck(http, company, job, sourceId);
  try {
    const r = await http.probe(job.applyUrl);
    const v = judgePage(job, sourceId, r);
    // The page refused automated clients (401/403/429…): ask the official board API instead.
    if (v.status === 'unknown' && r.status >= 400 && r.status < 500) return apiCheck(http, company, job, sourceId);
    return v;
  } catch (e) {
    // The page is off-limits (robots.txt) or unreachable: fall back to the official API.
    if (e instanceof RobotsDisallowed) return apiCheck(http, company, job, sourceId);
    return { status: 'unknown', method: 'page', reason: String((e as Error).message ?? e) };
  }
}
