import type { Fetcher, RawJob } from '../types.ts';
import { sections, toIso } from './util.ts';

/**
 * amazon.jobs search JSON (the endpoint amazon.jobs itself uses). Descriptions are included.
 * The API stops at 10,000 hits per query, so we split US results by state.
 */
const BASE = 'https://www.amazon.jobs/en/search.json';
const PAGE = 100;
const CAP = 10_000;

export const amazon: Fetcher = {
  async list({ http, log }) {
    const q = (extra: string, offset: number, limit = PAGE) =>
      http.json<any>(`${BASE}?normalized_country_code%5B%5D=USA&result_limit=${limit}&offset=${offset}&sort=recent${extra}`);

    const facetRes = await q('&facets%5B%5D=normalized_state_name', 0, 1);
    const stateFacet: Record<string, number>[] = facetRes.facets?.normalized_state_name_facet ?? [];
    const states = stateFacet.map((o) => Object.entries(o)[0]).filter(Boolean) as [string, number][];
    const parts: [string, number][] = states.length ? states : [['', facetRes.hits]];
    log(`${facetRes.hits} US hits across ${states.length} states`);

    const out = new Map<string, RawJob>();
    for (const [state, count] of parts) {
      const extra = state ? `&normalized_state_name%5B%5D=${encodeURIComponent(state)}` : '';
      if (count > CAP) log(`warning: ${state} has ${count} jobs (> ${CAP}); some will be missed`);
      for (let offset = 0; offset < Math.min(count, CAP); offset += PAGE) {
        const res = await q(extra, offset);
        if (!res.jobs?.length) break;
        for (const j of res.jobs) {
          if (out.has(j.id_icims)) continue;
          const locs: string[] = (j.locations ?? []).map((l: string) => {
            try { return JSON.parse(l).normalizedLocation as string; } catch { return null; }
          }).filter(Boolean);
          const url = `https://www.amazon.jobs${j.job_path}`;
          out.set(j.id_icims, {
            sourceId: j.id_icims,
            title: j.title,
            locations: locs.length ? locs : [j.normalized_location ?? j.location],
            countryCodes: ['US'],
            team: j.team?.label ?? j.job_family,
            employmentType: j.job_schedule_type,
            postedAt: toIso(j.posted_date),
            applyUrl: url,
            sourceUrl: url,
            descriptionHtml: sections([
              { html: j.description },
              { title: 'Basic qualifications', html: j.basic_qualifications },
              { title: 'Preferred qualifications', html: j.preferred_qualifications },
            ]),
            hints: [j.job_category, j.job_family, j.business_category, j.is_intern ? 'intern' : '', j.is_manager ? 'manager' : ''].filter(Boolean),
          });
        }
      }
    }
    return [...out.values()];
  },
};
