import type { Fetcher, RawJob } from '../types.ts';
import { HttpError } from '../http.ts';
import { pool, sections, toIso } from './util.ts';

/**
 * Oracle Recruiting Cloud (HCM) public candidate-experience REST API, used by the company's
 * own careers site (JPMorgan Chase, Oracle, Texas Instruments, American Express).
 * The list gives titles/locations; full descriptions come from the per-requisition endpoint.
 */
const PAGE = 25;

export const oracle: Fetcher = {
  async list({ company, http }) {
    const base = `https://${company.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`;
    const out: RawJob[] = [];
    let offset = 0;
    let total = Infinity;
    while (offset < total) {
      const url = `${base}?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${company.siteNumber},limit=${PAGE},offset=${offset},sortBy=POSTING_DATES_DESC`;
      const res = await http.json<any>(url);
      const item = res.items?.[0];
      total = item?.TotalJobsCount ?? 0;
      const reqs: any[] = item?.requisitionList ?? [];
      if (!reqs.length) break;
      for (const r of reqs) {
        const country = r.PrimaryLocationCountry;
        const secondary = (r.secondaryLocations ?? []).map((s: any) => s.Name).filter(Boolean);
        const anyUs = country === 'US' || secondary.some((s: string) => /United States/.test(s));
        if (!anyUs) continue;
        const url = `https://${company.host}/hcmUI/CandidateExperience/en/sites/${company.siteNumber}/job/${r.Id}`;
        out.push({
          sourceId: String(r.Id),
          title: r.Title,
          locations: [r.PrimaryLocation, ...secondary].filter(Boolean),
          countryCodes: country ? [country] : undefined,
          workplace: /remote/i.test(r.WorkplaceType ?? '') ? 'remote' : /hybrid/i.test(r.WorkplaceType ?? '') ? 'hybrid' : undefined,
          employmentType: r.JobSchedule ?? undefined,
          postedAt: toIso(r.PostedDate),
          applyUrl: url,
          sourceUrl: url,
          hints: [r.JobFamily, r.JobFunction, r.Category].filter(Boolean),
        });
      }
      offset += PAGE;
    }
    return out;
  },

  async details({ company, http, detailBudget, haveDescription }, jobs) {
    const todo = jobs.filter((j) => !haveDescription.has(j.sourceId)).slice(0, detailBudget);
    await pool(todo, 1, async (j) => {
      const url = `https://${company.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${j.sourceId}%22,siteNumber=${company.siteNumber}`;
      try {
        const d = (await http.json<any>(url)).items?.[0];
        if (!d) return;
        j.descriptionHtml = sections([
          { html: d.ExternalDescriptionStr },
          { title: 'Responsibilities', html: d.ExternalResponsibilitiesStr },
          { title: 'Qualifications', html: d.ExternalQualificationsStr },
        ]);
        j.employmentType = d.JobSchedule ?? j.employmentType;
        if (d.WorkplaceType) j.workplace = /remote/i.test(d.WorkplaceType) ? 'remote' : /hybrid/i.test(d.WorkplaceType) ? 'hybrid' : 'onsite';
        j.hints = [...(j.hints ?? []), d.Category, d.JobFunction, d.JobFamily].filter(Boolean);
      } catch (e) {
        if (!(e instanceof HttpError && e.status === 404)) throw e;
      }
    });
    return todo.length;
  },
};
