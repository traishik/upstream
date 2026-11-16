import type { Fetcher, RawJob } from '../types.ts';
import { escapeHtml, toIso } from './util.ts';

/** Lever public postings API: one call returns everything, descriptions included. */
export const lever: Fetcher = {
  async list({ company, http }) {
    const data = await http.json<any[]>(`https://api.lever.co/v0/postings/${company.board}?mode=json`);
    return data.map((j): RawJob => {
      const lists = (j.lists ?? []).map((l: any) => `<h3>${escapeHtml(l.text ?? '')}</h3><ul>${l.content ?? ''}</ul>`).join('');
      const s = j.salaryRange;
      return {
        sourceId: j.id,
        title: j.text,
        locations: j.categories?.allLocations?.length ? j.categories.allLocations : [j.categories?.location].filter(Boolean),
        countryCodes: j.country ? [j.country] : undefined,
        workplace: j.workplaceType === 'remote' ? 'remote' : j.workplaceType === 'hybrid' ? 'hybrid' : j.workplaceType === 'onsite' ? 'onsite' : undefined,
        team: j.categories?.team,
        employmentType: j.categories?.commitment,
        postedAt: toIso(j.createdAt),
        applyUrl: j.hostedUrl,
        sourceUrl: j.hostedUrl,
        descriptionHtml: [j.description, lists, j.additional].filter(Boolean).join(''),
        salary: s ? { min: s.min, max: s.max, currency: s.currency, period: s.interval } : undefined,
        hints: [j.categories?.team, j.categories?.department].filter(Boolean),
      };
    });
  },
};
