import type { Fetcher, RawJob } from '../types.ts';
import { decodeEntities, toIso } from './util.ts';

function payRange(r: any[] | undefined): RawJob['salary'] {
  const p = r?.[0];
  if (!p) return undefined;
  return { min: p.min_cents != null ? p.min_cents / 100 : undefined, max: p.max_cents != null ? p.max_cents / 100 : undefined, currency: p.currency_type, period: 'year', text: p.title };
}

/** Greenhouse public Job Board API: one call returns every posting with full content. */
export const greenhouse: Fetcher = {
  async list({ company, http }) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${company.board}/jobs?content=true&pay_transparency=true`;
    const data = await http.json<{ jobs: any[] }>(url);
    return data.jobs.map((j): RawJob => {
      const offices: string[] = (j.offices ?? []).flatMap((o: any) => [o.location, o.name].filter(Boolean));
      const loc = j.location?.name ? [j.location.name] : [];
      const boardUrl = `https://job-boards.greenhouse.io/${company.board}/jobs/${j.id}`;
      // Apply on the company's own domain when the board points there; Lyft's careerpuck mirror is a
      // third-party host, so fall back to the official Greenhouse posting in that case.
      const abs: string = j.absolute_url ?? boardUrl;
      const applyUrl = /careerpuck\.com/.test(abs) ? boardUrl : abs;
      const meta: any[] = j.metadata ?? [];
      const metaText = meta.map((m) => `${m.name}: ${Array.isArray(m.value) ? m.value.join(', ') : m.value ?? ''}`);
      return {
        sourceId: String(j.id),
        title: j.title,
        locations: [...loc, ...offices.filter((o) => !loc.includes(o))],
        team: j.departments?.[0]?.name,
        postedAt: toIso(j.first_published) ?? toIso(j.updated_at),
        applyUrl,
        sourceUrl: boardUrl,
        descriptionHtml: j.content ? decodeEntities(j.content) : undefined,
        salary: payRange(j.pay_input_ranges),
        hints: [...(j.departments ?? []).map((d: any) => d.name), ...metaText],
      };
    });
  },
};
