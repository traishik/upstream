import { LEVEL_SHORT, WORKPLACE, freshness, freshnessLabel, jobHref, minToMs, timeAgo, type Row } from '@/lib/jobs';

/** React twin of JobRow.astro: used by the board, the home page and saved roles. */
export function Monogram({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.replace(/\(.*?\)/g, '').replace(/[^A-Za-z0-9& ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const dim = { sm: 'size-8 text-sm', md: 'size-10 text-base', lg: 'size-16 text-2xl' }[size];
  return (
    <span aria-hidden="true" className={`inline-grid shrink-0 place-items-center rounded-full border border-hairline bg-surface ${dim}`}>
      <span className="font-serif text-ink">{initials}</span>
    </span>
  );
}

export function Pill({ children, tone = 'default', title }: { children: React.ReactNode; tone?: 'default' | 'accent' | 'new' | 'live'; title?: string }) {
  const tones = { default: 'border-hairline text-muted', accent: 'border-accent/50 text-accent', new: 'border-accent-fill bg-accent-fill text-on-accent', live: 'border-live/50 text-live' };
  return <span title={title} className={`meta inline-flex h-6 items-center rounded-full border px-2.5 !text-[0.625rem] ${tones[tone]}`}>{children}</span>;
}

export default function JobRowView({ row, companyName, isNew, prerendered, now }: {
  row: Row; companyName: string; isNew?: boolean; prerendered?: Set<string>; now?: number;
}) {
  const extra = row.loc.length > 1 ? ` +${row.loc.length - 1}` : '';
  const fr = freshness(row, now);
  return (
    <li className="group relative">
      <a href={jobHref(row.i, prerendered)} className="grid grid-cols-[auto_1fr] items-start gap-4 px-4 py-6 transition-colors duration-200 hover:bg-surface sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-6">
        <Monogram name={companyName} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {companyName}
            {isNew && <Pill tone="new">New since last visit</Pill>}
          </p>
          <h3 className="mt-1 font-sans text-base font-medium leading-6 tracking-normal text-ink transition-colors duration-200 group-hover:text-accent sm:text-lg">{row.t}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{(row.loc[0] ?? 'United States') + extra}</span>
            <Pill>{WORKPLACE[row.w] ?? row.w}</Pill>
            <Pill>{LEVEL_SHORT[row.l] ?? row.l}</Pill>
            {row.e !== 'full-time' && <Pill>{row.e === 'contract' ? 'Contract' : row.e === 'part-time' ? 'Part-time' : 'Internship'}</Pill>}
            {fr.tier === 'fresh' && <Pill tone="live">{freshnessLabel(fr)}</Pill>}
            {(fr.tier === 'long' || fr.tier === 'evergreen') && <Pill tone="accent" title="Open a long time. It may be an evergreen posting; a referral helps.">{freshnessLabel(fr)}</Pill>}
            {row.s && <span className="text-xs">{row.s}</span>}
          </div>
        </div>
        <p className="meta col-start-2 flex items-center gap-2 sm:col-start-3 sm:justify-self-end" suppressHydrationWarning>
          <span className="inline-block size-1.5 rounded-full bg-live" aria-hidden="true" />
          Verified live · {timeAgo(minToMs(row.v), now)}
        </p>
      </a>
    </li>
  );
}
