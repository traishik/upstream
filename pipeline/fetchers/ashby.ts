import type { Fetcher, RawJob } from '../types.ts';
import { toIso } from './util.ts';

/** Ashby public posting API: one call, descriptions and (where published) compensation included. */
export const ashby: Fetcher = {
  async list({ company, http }) {
    const data = await http.json<{ jobs: any[] }>(
      `https://api.ashbyhq.com/posting-api/job-board/${company.board}?includeCompensation=true`,
    );
    return data.jobs.filter((j) => j.isListed !== false).map((j): RawJob => {
      const addr = j.address?.postalAddress;
      const primary = [addr?.addressLocality, addr?.addressRegion, addr?.addressCountry].filter(Boolean).join(', ') || j.location;
      const secondary = (j.secondaryLocations ?? []).map((s: any) => {
        const a = s.address?.postalAddress ?? s.address;
        return [s.location ?? a?.addressLocality, a?.addressRegion, a?.addressCountry].filter(Boolean).join(', ');
      });
      const comp = j.compensation;
      const tier = comp?.summaryComponents?.find((c: any) => c.compensationType === 'Salary') ?? null;
      const wp = String(j.workplaceType ?? '').toLowerCase();
      return {
        sourceId: j.id,
        title: j.title,
        locations: [primary, ...secondary].filter(Boolean),
        remote: j.isRemote,
        workplace: wp === 'remote' ? 'remote' : wp === 'hybrid' ? 'hybrid' : wp === 'onsite' ? 'onsite' : undefined,
        team: j.team ?? j.department,
        employmentType: j.employmentType,
        postedAt: toIso(j.publishedAt),
        applyUrl: j.jobUrl,
        sourceUrl: j.jobUrl,
        descriptionHtml: j.descriptionHtml,
        salary: tier
          ? { min: tier.minValue ?? undefined, max: tier.maxValue ?? undefined, currency: tier.currencyCode, period: tier.interval, text: comp?.compensationTierSummary }
          : undefined,
        hints: [j.department, j.team].filter(Boolean),
      };
    });
  },
};
