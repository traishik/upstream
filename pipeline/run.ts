/**
 * Pipeline entry point:  npx tsx pipeline/run.ts [--only=slug,slug] [--skip-liveness]
 *
 * 1. Fetch every enabled company (one broken company never breaks the run)
 * 2. Keep US roles, normalize, classify, fetch full details where the source allows
 * 3. Verify apply links: new jobs before they're published, existing ones on a rolling ~40h cycle
 * 4. Guard against pipeline bugs (>50% drop → skip deploy), write data + run report
 * Exit codes: 0 ok · 2 deploy should be skipped (drop guard) · 1 crash
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Classifier } from './classify.ts';
import { loadCompanies, loadPipelineConfig, repoPath } from './config.ts';
import { fetchers } from './fetchers/index.ts';
import { pool } from './fetchers/util.ts';
import { Http } from './http.ts';
import { verify } from './liveness.ts';
import { isUsJob, normalize, sanitize } from './normalize.ts';
import { writeOutputs } from './output.ts';
import { loadState, saveState, seedFromSite, type StoredJob } from './state.ts';
import type { Company, Job } from './types.ts';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const only = typeof args.only === 'string' ? new Set(args.only.split(',')) : null;

const cfg = loadPipelineConfig();
const { companies } = loadCompanies();
const cls = Classifier.load();
const path = (rel: string) => repoPath(rel);
let state = loadState(path(cfg.output.stateFile));
const http = new Http(cfg.http && { userAgent: cfg.userAgent, ...cfg.http }, new Map(Object.entries(state.validators ?? {})));

const startedAt = new Date();
const now = startedAt.toISOString();
const hoursAgo = (iso?: string) => (iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : Infinity);
const log = (scope: string) => (msg: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${scope.padEnd(22)} ${msg}`);

interface CompanyReport {
  slug: string; name: string; mode: string; status: 'ok' | 'error' | 'grace' | 'dropped' | 'link-only' | 'disabled' | 'skipped';
  fetched: number; us: number; added: number; removed: number; dead: number; detailsFetched: number; published: number; error?: string; ms?: number;
}
const reports = new Map<string, CompanyReport>();
const unclassified: { company: string; title: string }[] = [];

// ── 1–2. Fetch, filter, normalize ──────────────────────────────────────────────────────────────
async function runCompany(c: Company) {
  const r: CompanyReport = { slug: c.slug, name: c.name, mode: c.mode, status: 'ok', fetched: 0, us: 0, added: 0, removed: 0, dead: 0, detailsFetched: 0, published: 0 };
  reports.set(c.slug, r);
  if (!c.enabled) { r.status = 'disabled'; return; }
  if (c.mode === 'link-only') { r.status = 'link-only'; return; }
  if (only && !only.has(c.slug)) { r.status = 'skipped'; return; }
  const fetcher = c.source ? fetchers[c.source] : undefined;
  const L = log(c.slug);
  const t0 = Date.now();
  const cs = (state.companies[c.slug] ??= {});
  cs.lastAttemptAt = now;
  try {
    if (!fetcher) throw new Error(`no fetcher for source "${c.source}"`);
    const mine = Object.values(state.jobs).filter((s) => s.job.company === c.slug);
    const prevBySource = new Map(mine.map((s) => [s.sourceId, s]));
    const haveDescription = new Set(mine.filter((s) => s.job.descriptionHtml).map((s) => s.sourceId));
    const ctx = { company: c, http, log: L, detailBudget: cfg.details.maxPerCompanyPerRun, haveDescription };

    const raw = await fetcher.list(ctx);
    r.fetched = raw.length;
    let us = raw.filter(isUsJob);
    if (fetcher.details) {
      // New jobs first, so first-time listings get their full description soonest.
      us = [...us.filter((j) => !prevBySource.has(j.sourceId)), ...us.filter((j) => prevBySource.has(j.sourceId))];
      const n = await fetcher.details(ctx, us);
      r.detailsFetched = typeof n === 'number' ? n : 0;
      us = us.filter(isUsJob); // details can reveal the real country
    }
    r.us = us.length;

    const seen = new Set<string>();
    for (const rj of us) {
      const { job, fnMatched } = normalize(rj, c, cls, now);
      if (seen.has(job.id)) continue;
      seen.add(job.id);
      if (!fnMatched && unclassified.length < 400) unclassified.push({ company: c.slug, title: job.title });
      const prev = state.jobs[job.id];
      if (prev) {
        job.firstSeenAt = prev.job.firstSeenAt;
        job.lastVerifiedAt = prev.job.lastVerifiedAt;
        job.descriptionHtml ??= prev.job.descriptionHtml;
        job.postedAt ??= prev.job.postedAt;
        state.jobs[job.id] = { ...prev, job, sourceId: rj.sourceId, lastSeenAt: now };
      } else {
        r.added++;
        state.jobs[job.id] = { job, sourceId: rj.sourceId, lastSeenAt: now, check: 'pending' };
      }
    }
    // Primary liveness rule: anything not in the latest successful feed is gone.
    for (const s of mine) if (!seen.has(s.job.id)) { delete state.jobs[s.job.id]; r.removed++; }
    cs.lastSuccessAt = now;
    delete cs.lastError;
    L(`ok: ${r.fetched} fetched, ${r.us} US, +${r.added} −${r.removed}, ${r.detailsFetched} detail calls (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  } catch (e) {
    r.error = String((e as Error)?.message ?? e).slice(0, 300);
    cs.lastError = r.error;
    const age = hoursAgo(cs.lastSuccessAt);
    if (age <= cfg.failureGraceHours) {
      r.status = 'grace';
      L(`ERROR (keeping last-known jobs, ${age.toFixed(1)}h old): ${r.error}`);
    } else {
      r.status = Number.isFinite(age) ? 'dropped' : 'error';
      for (const [id, s] of Object.entries(state.jobs)) if (s.job.company === c.slug) { delete state.jobs[id]; r.removed++; }
      L(`ERROR: ${r.error}`);
    }
  }
  r.ms = Date.now() - t0;
}

// ── 3. Liveness ────────────────────────────────────────────────────────────────────────────────
async function runLiveness() {
  const L = log('liveness');
  const bySlug = new Map(companies.map((c) => [c.slug, c]));
  const deadline = Date.now() + cfg.liveness.timeBudgetMinutes * 60_000;
  const due = Object.values(state.jobs).filter((s) =>
    s.lastSeenAt === now && (s.check === 'pending' || hoursAgo(s.lastCheckAt) >= cfg.liveness.recheckEveryHours) &&
    (cfg.includeFrontline || !s.job.isFrontline));
  // New jobs first, then the longest-unverified.
  due.sort((a, b) => (a.check === 'pending' ? 0 : 1) - (b.check === 'pending' ? 0 : 1) || (a.lastCheckAt ?? '').localeCompare(b.lastCheckAt ?? ''));
  const byHost = new Map<string, StoredJob[]>();
  for (const s of due) {
    const c = bySlug.get(s.job.company)!;
    const host = ['workday', 'oracle', 'rippling', 'greenhouse'].includes(c.source!) && c.host ? c.host : new URL(s.job.applyUrl).host;
    (byHost.get(host) ?? byHost.set(host, []).get(host)!).push(s);
  }
  L(`${due.length} checks due across ${byHost.size} hosts (${due.filter((s) => s.check === 'pending').length} new)`);
  let checked = 0, dead = 0, unknown = 0;
  await pool([...byHost.entries()], cfg.liveness.concurrencyHosts, async ([host, list]) => {
    for (const s of list.slice(0, cfg.liveness.maxChecksPerHostPerRun)) {
      if (Date.now() > deadline) return;
      if (!state.jobs[s.job.id]) continue;
      const v = await verify(http, bySlug.get(s.job.company)!, s.job, s.sourceId);
      checked++;
      if (v.status === 'dead') {
        dead++;
        delete state.jobs[s.job.id];
        const rep = reports.get(s.job.company);
        if (rep) rep.dead++;
      } else if (v.status === 'live') {
        s.check = 'live';
        s.lastCheckAt = new Date().toISOString();
        s.checkMethod = v.method;
        s.job.lastVerifiedAt = s.lastCheckAt;
      } else {
        unknown++;
      }
      if (checked % 500 === 0) L(`${checked} checked (${dead} dead, ${unknown} inconclusive)…`);
    }
  });
  L(`done: ${checked} checked, ${dead} dead links caught, ${unknown} inconclusive`);
  return { checked, dead, unknown };
}

// ── main ───────────────────────────────────────────────────────────────────────────────────────
async function main() {
  const L = log('pipeline');
  L(`start · ${companies.length} companies · frontline ${cfg.includeFrontline ? 'included' : 'excluded'}`);
  if (!Object.keys(state.jobs).length && process.env.SEED_FROM_SITE) {
    const validators = state.validators;
    state = await seedFromSite(process.env.SEED_FROM_SITE, L);
    state.validators = validators;
  }
  await pool(companies, 8, runCompany);
  const live = args['skip-liveness'] ? { checked: 0, dead: 0, unknown: 0 } : await runLiveness();

  // Publish: in the latest feed (or within grace), verified within 48h, frontline per config.
  const enabled = new Set(companies.filter((c) => c.enabled && c.mode === 'fetch').map((c) => c.slug));
  const published: Job[] = Object.values(state.jobs)
    .filter((s) => enabled.has(s.job.company) && s.check === 'live' && hoursAgo(s.lastCheckAt) <= 48)
    .filter((s) => cfg.includeFrontline || !s.job.isFrontline)
    // Re-sanitize on publish so sanitizer improvements reach older descriptions too (idempotent).
    .map((s) => ({ ...s.job, descriptionHtml: sanitize(s.job.descriptionHtml) }));
  for (const j of published) reports.get(j.company)!.published++;

  const prevTotal = state.lastPublishedTotal ?? 0;
  const dropped = prevTotal > 0 && published.length < prevTotal * (1 - cfg.maxDropFraction);
  const staleCompanies = [...reports.values()].filter((r) => r.status === 'grace').map((r) => r.slug);

  let out: ReturnType<typeof writeOutputs> | undefined;
  if (!dropped) {
    out = writeOutputs({
      publicDir: path(cfg.output.publicDir), jobs: published, companies, cls, generatedAt: new Date().toISOString(),
      includeFrontline: cfg.includeFrontline, newestForHome: cfg.output.newestForHome, staleCompanies,
    });
    state.lastPublishedTotal = published.length;
  }
  state.validators = Object.fromEntries(http.validators);
  saveState(path(cfg.output.stateFile), state);

  const rs = [...reports.values()];
  const report = {
    startedAt: now,
    finishedAt: new Date().toISOString(),
    durationSec: Math.round((Date.now() - startedAt.getTime()) / 1000),
    skipDeploy: dropped,
    reason: dropped ? `Published total fell from ${prevTotal} to ${published.length} (more than ${cfg.maxDropFraction * 100}%). Likely a pipeline bug, so the deploy was skipped.` : undefined,
    totals: {
      published: published.length, previous: prevTotal,
      fetched: rs.reduce((a, r) => a + r.fetched, 0), us: rs.reduce((a, r) => a + r.us, 0),
      added: rs.reduce((a, r) => a + r.added, 0), removed: rs.reduce((a, r) => a + r.removed, 0),
      deadLinksCaught: live.dead, linksChecked: live.checked, inconclusiveChecks: live.unknown,
      awaitingVerification: Object.values(state.jobs).filter((s) => s.check === 'pending').length,
      httpRequests: http.requests, files: out?.files, indexBytes: out?.idxBytes, manifestBytes: out?.manifestBytes,
      companiesOk: rs.filter((r) => r.status === 'ok').length, companiesFailing: rs.filter((r) => ['error', 'grace', 'dropped'].includes(r.status)).length,
    },
    companies: rs.sort((a, b) => a.name.localeCompare(b.name)),
    unclassified,
  };
  const reportPath = path(cfg.output.reportFile);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  // The site's /status page reads a public copy.
  writeFileSync(path(`${cfg.output.publicDir}/run-report.json`), JSON.stringify(report));
  L(`published ${published.length} roles (was ${prevTotal}) · ${report.totals.httpRequests} requests · ${report.durationSec}s${dropped ? ' · DEPLOY SKIPPED' : ''}`);
  process.exit(dropped ? 2 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
