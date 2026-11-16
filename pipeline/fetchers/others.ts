/** Fetchers for companies that run their own careers APIs: TikTok, AMD, Rippling, Apple. */
import type { Fetcher, RawJob } from '../types.ts';
import { HttpError } from '../http.ts';
import { pool, sections, toIso } from './util.ts';

/** lifeattiktok.com: the site's own search API. Descriptions included. */
export const tiktok: Fetcher = {
  async list({ http }) {
    const out: RawJob[] = [];
    const PAGE = 100;
    for (let offset = 0, total = Infinity; offset < total; offset += PAGE) {
      const res = await http.json<any>('https://api.lifeattiktok.com/api/v1/public/supplier/search/job/posts', {
        headers: { 'website-path': 'tiktok' },
        body: { recruitment_id_list: [], job_category_id_list: [], subject_id_list: [], location_code_list: [], keyword: '', limit: PAGE, offset },
      });
      total = res.data?.count ?? 0;
      const list: any[] = res.data?.job_post_list ?? [];
      if (!list.length) break;
      for (const j of list) {
        // Walk city → state → country.
        const chain: string[] = [];
        let n = j.city_info;
        let country = '';
        while (n) { chain.push(n.en_name); if (n.location_type === 1) country = n.en_name; n = n.parent; }
        const isUs = /United States/.test(country);
        const url = `https://lifeattiktok.com/search/${j.id}`;
        out.push({
          sourceId: j.id,
          title: j.title,
          locations: [chain.slice(0, -1).join(', ') + (isUs ? ', United States' : `, ${country}`)],
          countryCodes: isUs ? ['US'] : [],
          team: j.job_category?.en_name,
          employmentType: j.recruit_type?.en_name,
          applyUrl: url,
          sourceUrl: url,
          descriptionHtml: sections([{ title: 'Responsibilities', text: j.description }, { title: 'Qualifications', text: j.requirement }]),
          hints: [j.job_category?.en_name, j.recruit_type?.en_name, j.job_category?.parent?.en_name].filter(Boolean),
        });
      }
    }
    return out;
  },
};

/** careers.amd.com (iCIMS via Jibe): the site's own jobs API. Descriptions included. */
export const amd: Fetcher = {
  async list({ http }) {
    const out: RawJob[] = [];
    const PAGE = 100;
    for (let page = 1, total = Infinity; (page - 1) * PAGE < total; page++) {
      const res = await http.json<any>(`https://careers.amd.com/api/jobs?page=${page}&limit=${PAGE}&country=United%20States`);
      total = res.totalCount ?? 0;
      const jobs: any[] = res.jobs ?? [];
      if (!jobs.length) break;
      for (const { data: j } of jobs) {
        const url = `https://careers.amd.com/careers-home/jobs/${j.req_id}`;
        out.push({
          sourceId: String(j.req_id),
          title: j.title,
          locations: [[j.city, j.state, j.country].filter(Boolean).join(', ')],
          countryCodes: j.country_code ? [j.country_code] : undefined,
          employmentType: j.employment_type,
          postedAt: toIso(j.posted_date ?? j.create_date),
          applyUrl: j.apply_url ?? url,
          sourceUrl: url,
          descriptionHtml: sections([{ html: j.description }, { title: 'Responsibilities', html: j.responsibilities }, { title: 'Qualifications', html: j.qualifications }]),
          hints: (j.categories ?? []).map((c: any) => c.name),
        });
      }
    }
    return out;
  },
};

/** Rippling ATS public board API. List, then per-job details. */
export const rippling: Fetcher = {
  async list({ company, http }) {
    // The board lists a job once per location; merge them by id.
    const byId = new Map<string, RawJob>();
    for (let page = 0, pages = 1; page < pages; page++) {
      const res = await http.json<any>(`https://ats.rippling.com/api/v2/board/${company.board}/jobs?page=${page}&pageSize=100`);
      pages = res.totalPages ?? 1;
      for (const j of res.items ?? []) {
        const prev = byId.get(j.id);
        if (prev) {
          prev.locations.push(...(j.locations ?? []).map((l: any) => l.name));
          prev.countryCodes!.push(...(j.locations ?? []).map((l: any) => l.countryCode).filter(Boolean));
          continue;
        }
        byId.set(j.id, {
          sourceId: j.id,
          title: j.name,
          locations: (j.locations ?? []).map((l: any) => l.name),
          countryCodes: (j.locations ?? []).map((l: any) => l.countryCode).filter(Boolean),
          workplace: (j.locations ?? []).some((l: any) => l.workplaceType === 'REMOTE') ? 'remote' : (j.locations ?? []).some((l: any) => l.workplaceType === 'HYBRID') ? 'hybrid' : 'onsite',
          team: j.department?.displayName,
          applyUrl: j.url,
          sourceUrl: j.url,
          hints: [j.department?.name].filter(Boolean),
        });
      }
    }
    return [...byId.values()];
  },
  async details({ company, http, detailBudget, haveDescription }, jobs) {
    const todo = jobs.filter((j) => !haveDescription.has(j.sourceId)).slice(0, detailBudget);
    await pool(todo, 1, async (j) => {
      try {
        const d = await http.json<any>(`https://ats.rippling.com/api/v2/board/${company.board}/jobs/${j.sourceId}`);
        const desc = d.description;
        j.descriptionHtml = typeof desc === 'string' ? desc : desc && typeof desc === 'object' ? Object.values(desc).filter((v) => typeof v === 'string').join('') : undefined;
        j.employmentType = d.employmentType?.label ?? d.employmentType?.id ?? j.employmentType;
        j.postedAt = toIso(d.createdOn) ?? j.postedAt;
        const pr = d.payRangeDetails?.[0];
        if (pr) j.salary = { min: pr.rangeStart, max: pr.rangeEnd, currency: pr.currency, period: pr.frequency };
      } catch (e) {
        if (!(e instanceof HttpError && e.status === 404)) throw e;
      }
    });
    return todo.length;
  },
};

/** jobs.apple.com: server-rendered pages carry their data as JSON (window.__staticRouterHydrationData). */
function hydration(html: string): any | null {
  const m = html.match(/window\.__staticRouterHydrationData\s*=\s*JSON\.parse\(("(?:[^"\\]|\\.)*")\)/);
  if (!m) return null;
  try { return JSON.parse(JSON.parse(m[1])); } catch { return null; }
}
function findKey(o: any, key: string): any {
  if (!o || typeof o !== 'object') return undefined;
  if (key in o) return o[key];
  for (const v of Object.values(o)) { const r = findKey(v, key); if (r !== undefined) return r; }
  return undefined;
}

export const apple: Fetcher = {
  async list({ http, log }) {
    const out: RawJob[] = [];
    for (let page = 1, total = Infinity; (page - 1) * 20 < total; page++) {
      const html = await http.text(`https://jobs.apple.com/en-us/search?location=united-states-USA&page=${page}`);
      const d = hydration(html ?? '');
      const sr = d?.loaderData?.search;
      if (!sr) { log(`page ${page}: no data`); break; }
      total = sr.totalRecords ?? 0;
      const rows: any[] = sr.searchResults ?? [];
      if (!rows.length) break;
      for (const r of rows) {
        const url = `https://jobs.apple.com/en-us/details/${r.positionId}/${r.transformedPostingTitle}${r.team?.teamCode ? `?team=${r.team.teamCode}` : ''}`;
        out.push({
          sourceId: String(r.positionId),
          title: r.postingTitle,
          locations: (r.locations ?? []).map((l: any) => [l.name, l.stateProvince, 'United States'].filter(Boolean).join(', ')),
          countryCodes: ['US'],
          remote: r.homeOffice === true,
          team: r.team?.teamName,
          employmentType: r.standardWeeklyHours && r.standardWeeklyHours < 30 ? 'Part time' : undefined,
          postedAt: toIso(r.postDateInGMT),
          applyUrl: url,
          sourceUrl: url,
          // The search result carries a summary; details() replaces it with the full posting.
          descriptionHtml: sections([{ text: r.jobSummary }]),
          hints: [r.team?.teamName, r.team?.teamCode].filter(Boolean),
        });
      }
    }
    return out;
  },
  async details({ http, detailBudget, haveDescription }, jobs) {
    const todo = jobs.filter((j) => !haveDescription.has(j.sourceId)).slice(0, detailBudget);
    await pool(todo, 1, async (j) => {
      try {
        const d = hydration((await http.text(j.sourceUrl)) ?? '');
        if (!d) return;
        const full = sections([
          { text: findKey(d, 'jobSummary') },
          { title: 'Description', text: findKey(d, 'description') },
          { title: 'Minimum qualifications', text: findKey(d, 'minimumQualifications') },
          { title: 'Preferred qualifications', text: findKey(d, 'preferredQualifications') },
        ]);
        if (full) j.descriptionHtml = full;
      } catch (e) {
        if (!(e instanceof HttpError && e.status === 404)) throw e;
      }
    });
    return todo.length;
  },
};
