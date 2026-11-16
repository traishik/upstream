import { useEffect, useState } from 'react';
import { EMPLOYMENT, LEVEL_SHORT, RADAR, WORKPLACE, formatSalary, freshness, freshnessLabel, readSaved, timeAgo, writeSaved, type JobRecord } from '@/lib/jobs';
import { Monogram } from './JobRowView';

/** Save role (localStorage only, no accounts). */
export function SaveButton({ id, title, company }: { id: string; title: string; company: string }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(Boolean(readSaved()[id])), [id]);
  const toggle = () => {
    const all = readSaved();
    if (all[id]) delete all[id];
    else all[id] = { id, t: title, c: company, savedAt: Date.now() };
    writeSaved(all);
    setSaved(Boolean(all[id]));
    (window as any).upstreamTrack?.(all[id] ? 'save' : 'unsave', { company, job: id });
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={saved}
      className={`inline-flex h-14 items-center gap-2 rounded-full border px-6 text-sm transition-colors duration-200 ${saved ? 'border-accent text-accent' : 'border-hairline-strong hover:border-accent'}`}>
      <span aria-hidden="true">{saved ? '★' : '☆'}</span> {saved ? 'Saved' : 'Save role'}
    </button>
  );
}

/**
 * Full job detail. Rendered to static HTML for pre-rendered pages (SaveButton hydrates separately)
 * and on the client for /jobs/view/?id=.
 */
export interface DetailAd { id?: string; eyebrow?: string; sponsor?: string; headline: string; body?: string; cta?: string; url: string }

export default function JobDetail({ job, companyName, functionLabel, now, interactive = true, saveSlot, ad }: {
  job: JobRecord; companyName: string; functionLabel: string; now?: number; interactive?: boolean; saveSlot?: React.ReactNode;
  /** From config/ads.yaml; omitted when the ads module is off. Sidebar on desktop, below the description on mobile. */
  ad?: DetailAd | null;
}) {
  const host = (() => { try { return new URL(job.applyUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const salary = formatSalary(job.salaryRange);
  const toMin = (iso?: string) => (iso ? Math.round(new Date(iso).getTime() / 60000) : undefined);
  const fr = freshness({ p: toMin(job.postedAt), fs: toMin(job.firstSeenAt)! }, now);
  const meta = [job.locations.slice(0, 3).join(' · ') + (job.locations.length > 3 ? ` +${job.locations.length - 3} more` : ''), WORKPLACE[job.workplace], EMPLOYMENT[job.employmentType]].filter(Boolean);
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
      <article className="min-w-0">
        <a href={`/companies/${job.company}/`} className="inline-flex items-center gap-3 text-sm text-muted hover:text-ink">
          <Monogram name={companyName} size="sm" /> {companyName}
        </a>
        <h1 className="mt-6 text-[length:var(--t-h1)]">{job.title}</h1>
        <p className="mt-4 text-muted">{meta.join(' · ')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="meta inline-flex h-6 items-center rounded-full border border-hairline px-2.5 !text-[0.625rem]">{LEVEL_SHORT[job.level] ?? job.level}</span>
          <span className="meta inline-flex h-6 items-center rounded-full border border-hairline px-2.5 !text-[0.625rem]">{functionLabel}</span>
          {job.team && <span className="meta inline-flex h-6 items-center rounded-full border border-hairline px-2.5 !text-[0.625rem]">{job.team}</span>}
        </div>
        {salary && <p className="mt-6 text-sm"><span className="meta mr-3">Pay range (from the posting)</span>{salary}</p>}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href={job.applyUrl} target="_blank" rel="noopener" data-track="apply_click" data-track-props={JSON.stringify({ company: job.company, job: job.id })}
            className="group inline-flex h-14 items-center justify-center gap-3 rounded-full bg-accent-fill px-8 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-fill-strong">
            Apply on {companyName} <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            <span className="sr-only">(opens the official posting in a new tab)</span>
          </a>
          {interactive && <SaveButton id={job.id} title={job.title} company={job.company} />}
          {!interactive && saveSlot}
        </div>
        <p className="meta mt-6 flex flex-wrap items-center gap-2" suppressHydrationWarning>
          <span className="inline-block size-1.5 rounded-full bg-live" aria-hidden="true" />
          Last verified {timeAgo(new Date(job.lastVerifiedAt).getTime(), now)} · from {host}
        </p>
        <p className="meta mt-2" suppressHydrationWarning>
          {freshnessLabel(fr)}{fr.basis === 'posted' && job.postedAt ? ` · posted ${new Date(job.postedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
        </p>
        {(fr.tier === 'long' || fr.tier === 'evergreen') && (
          <p className="mt-4 max-w-xl rounded-[var(--radius)] border border-accent/40 p-4 text-sm text-muted">
            <span className="meta mr-2 text-accent">Ghost-job radar</span>
            This role has been open {fr.days} days. That can mean a hard-to-fill role or an evergreen posting that hires on a rolling basis. Still worth a shot; a referral or a direct note to the team helps most here.
          </p>
        )}

        <div className="prose-job mt-12">
          {job.descriptionHtml ? (
            <div dangerouslySetInnerHTML={{ __html: job.descriptionHtml }} />
          ) : (
            <p className="text-muted">The full description lives on {companyName}'s site. We're fetching it and it will appear here soon.</p>
          )}
        </div>
        <p className="mt-12 border-t border-hairline pt-6 text-xs leading-5 text-muted">
          This description belongs to {companyName} and is shown as published on their official careers site.{' '}
          <a className="link" href={job.sourceUrl} target="_blank" rel="noopener">Read the original posting</a>.
          {' '}Something wrong? <a className="link" href={`/feedback?type=other&job=${job.id}`}>Tell us</a>.
        </p>
      </article>
      <aside className="flex flex-col gap-6">
        {ad && (
          <div aria-label="Sponsored" className="relative min-h-[280px] rounded-[var(--radius)] border border-hairline bg-surface">
            <span className="meta absolute right-3 top-3 !text-[0.625rem]">Sponsored</span>
            <div className="flex h-full min-h-[280px] flex-col justify-center gap-2 p-6">
              <p className="meta text-accent">{ad.sponsor ? `Sponsor · ${ad.sponsor}` : ad.eyebrow ?? 'House'}</p>
              <p className="font-serif text-xl">{ad.headline}</p>
              {ad.body && <p className="text-sm text-muted">{ad.body}</p>}
              <a href={ad.url} className="link w-fit text-sm" data-track="ad_click" data-track-props={JSON.stringify({ id: ad.id ?? ad.headline.slice(0, 40), placement: 'detail' })} {...(/^https?:/.test(ad.url) ? { target: '_blank', rel: 'noopener sponsored' } : {})}>{ad.cta ?? 'Learn more'} →</a>
            </div>
          </div>
        )}
        <a href={`/insiders/share?company=${job.company}`} className="rounded-[var(--radius)] border border-hairline p-6 text-sm transition-colors duration-200 hover:border-accent">
          <p className="meta text-accent">Inside Track</p>
          <p className="mt-2 font-serif text-xl">Work at {companyName}?</p>
          <p className="mt-2 text-muted">Share a tip or a referral with people applying here.</p>
        </a>
      </aside>
    </div>
  );
}
