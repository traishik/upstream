import type { Fetcher, RawJob } from '../types.ts';
import { HttpError } from '../http.ts';
import { pool, relativePosted, toIso } from './util.ts';

/**
 * Workday candidate-experience (CXS) API, the same JSON the company's Workday careers site uses.
 * - Lists are filtered to the United States via the country facet when the tenant exposes one.
 * - Workday caps `total` at 2,000 per query, so large boards are split by a facet (job family).
 * - Job details (full description, all locations, time type) come from the per-job endpoint.
 * Workday tenants go down for maintenance on weekends; failures fall back to the 24h grace window.
 */
const US_ID = 'bc33aa3152ec42d4995f4791a106ed09';
const PAGE = 20;
const CAP = 2000;

type Facet = { facetParameter: string; values?: { id: string; descriptor: string; count?: number; facetParameter?: string; values?: any[] }[] };

/** Find a facet value anywhere in the (sometimes nested) facet tree. */
function findFacet(facets: Facet[], test: (param: string, v: any) => boolean): { param: string; id: string } | null {
  for (const f of facets) {
    for (const v of f.values ?? []) {
      if (v.id && test(f.facetParameter, v)) return { param: f.facetParameter, id: v.id };
      if (v.values) {
        const nested = findFacet([v as unknown as Facet], test);
        if (nested) return nested;
      }
    }
  }
  return null;
}

export const workday: Fetcher = {
  async list({ company, http, log }) {
    const base = `https://${company.host}/wday/cxs/${company.tenant}/${company.site}`;
    const search = (appliedFacets: Record<string, string[]>, offset: number) =>
      http.json<{ total: number; jobPostings: any[]; facets?: Facet[] }>(`${base}/jobs`, {
        body: { appliedFacets, limit: PAGE, offset, searchText: '' },
      });

    const first = await search({}, 0);
    const us = findFacet(first.facets ?? [], (p, v) => /country/i.test(p) && (v.id === US_ID || /^united states/i.test(v.descriptor)));
    const baseFacets: Record<string, string[]> = us ? { [us.param]: [us.id] } : {};
    if (!us) log('no US country facet; filtering by location text');

    const head = us ? await search(baseFacets, 0) : first;
    // Partition big boards by job family so each query stays under Workday's 2,000 cap.
    let partitions: Record<string, string[]>[] = [baseFacets];
    if (head.total >= CAP) {
      const fam = (head.facets ?? []).find((f) => /jobFamily/i.test(f.facetParameter)) ?? (head.facets ?? []).find((f) => (f.values?.length ?? 0) > 1 && f.values!.every((v) => v.id));
      if (fam?.values?.length) {
        partitions = fam.values.filter((v) => v.id).map((v) => ({ ...baseFacets, [fam.facetParameter]: [v.id] }));
        log(`${head.total}+ jobs: split into ${partitions.length} queries by ${fam.facetParameter}`);
      } else {
        log(`warning: ${head.total}+ jobs and no facet to split by; results may be truncated`);
      }
    }

    const byPath = new Map<string, RawJob>();
    for (const facets of partitions) {
      let offset = 0;
      let total = Infinity;
      while (offset < Math.min(total, CAP)) {
        const page = offset === 0 && facets === baseFacets && partitions.length === 1 ? head : await search(facets, offset);
        if (offset === 0) total = page.total ?? 0; // Workday reports total only on the first page
        for (const p of page.jobPostings ?? []) {
          if (!p.externalPath || byPath.has(p.externalPath)) continue;
          const url = `https://${company.host}/en-US/${company.site}${p.externalPath}`;
          byPath.set(p.externalPath, {
            sourceId: p.externalPath, // stable across runs; bulletFields vary by tenant
            title: p.title,
            // "4 Locations" is resolved from details; the path's first segment is the primary location.
            locations: /^\d+ Locations$/i.test(p.locationsText ?? '') ? [pathLocation(p.externalPath)] : [p.locationsText ?? pathLocation(p.externalPath)],
            countryCodes: us ? ['US'] : undefined,
            postedAt: relativePosted(p.postedOn),
            applyUrl: url,
            sourceUrl: url,
            hints: [`workday-path:${p.externalPath}`],
          });
        }
        if (!page.jobPostings?.length) break;
        offset += PAGE;
      }
    }
    return [...byPath.values()];
  },

  async details({ company, http, log, detailBudget, haveDescription }, jobs) {
    const base = `https://${company.host}/wday/cxs/${company.tenant}/${company.site}`;
    const todo = jobs.filter((j) => !haveDescription.has(j.sourceId)).slice(0, detailBudget);
    let failed = 0;
    await pool(todo, 1, async (j) => {
      const path = j.hints?.find((h) => h.startsWith('workday-path:'))?.slice(13);
      if (!path) return;
      try {
        const d = await http.json<{ jobPostingInfo: any }>(`${base}${path}`);
        const info = d.jobPostingInfo ?? {};
        j.descriptionHtml = info.jobDescription;
        j.locations = [info.location, ...(info.additionalLocations ?? [])].filter(Boolean);
        const iso2 = info.jobRequisitionLocation?.country?.alpha2Code;
        if (iso2) j.countryCodes = [iso2];
        j.employmentType = info.timeType ?? j.employmentType;
        j.postedAt = toIso(info.startDate) ?? j.postedAt;
        if (info.externalUrl) j.applyUrl = info.externalUrl;
      } catch (e) {
        failed++;
        if (!(e instanceof HttpError && e.status === 404)) throw e;
      }
    });
    return todo.length;
    if (failed) log(`${failed} detail pages missing (404)`);
  },
};

/** "/job/US-CA-Santa-Clara/Title_JR123" → "US-CA-Santa-Clara" → "US, CA, Santa Clara" (best effort). */
function pathLocation(path: string): string {
  const seg = path.split('/')[2] ?? '';
  return seg.replace(/-/g, ' ').replace(/^([A-Z]{2}) ([A-Z]{2}) /, '$1, $2, ');
}
