import { useEffect, useMemo, useRef, useState } from 'react';
import JobRowView from './JobRowView';
import { EMPLOYMENT, LEVEL_SHORT, RADAR, WORKPLACE, freshness, minToMs, postedOrSeen, type CompanyInfo, type Facet, type Row } from '@/lib/jobs';

/**
 * The job board (React island).
 * Data strategy (section 4.8): the newest ~300 roles arrive with the page. Listing files (one per
 * function, no descriptions) load only when a filter, search or "show more" needs them, so the first
 * view stays small. All filter state lives in the URL, so any search can be shared.
 */
interface Props {
  total: number;
  functions: Facet[];
  levels: Facet[];
  companies: Pick<CompanyInfo, 'slug' | 'name' | 'tier' | 'mode' | 'count'>[];
  newest: Row[];
  includeFrontline: boolean;
  /** House or direct creatives from config/ads.yaml (empty = no list ads). */
  ads?: { id?: string; eyebrow?: string; sponsor?: string; headline: string; body?: string; cta?: string; url: string }[];
}

type Filters = {
  q: string; fn: string[]; level: string; type: string; company: string; tier: string; workplace: string;
  loc: string; posted: string; sort: 'newest' | 'company'; frontline: '' | 'only' | 'hide';
  radar: '' | 'hide-long' | 'fresh';
};
const EMPTY: Filters = { q: '', fn: [], level: '', type: '', company: '', tier: '', workplace: '', loc: '', posted: '', sort: 'newest', frontline: '', radar: '' };
const PAGE = 48;
const AD_EVERY = 12;

function readUrl(): Filters {
  const p = new URLSearchParams(location.search);
  const csv = (k: string) => (p.get(k) ?? '').split(',').filter(Boolean);
  return {
    q: p.get('q') ?? '', fn: csv('function'), level: p.get('level') ?? '', type: p.get('type') ?? '', company: p.get('company') ?? '',
    tier: p.get('tier') ?? '', workplace: p.get('workplace') ?? '', loc: p.get('loc') ?? '', posted: p.get('posted') ?? '',
    sort: p.get('sort') === 'company' ? 'company' : 'newest', frontline: (p.get('frontline') as Filters['frontline']) ?? '',
    radar: (p.get('radar') as Filters['radar']) ?? '',
  };
}
function writeUrl(f: Filters) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.fn.length) p.set('function', f.fn.join(','));
  for (const k of ['level', 'type', 'company', 'tier', 'workplace', 'loc', 'posted', 'frontline', 'radar'] as const) if (f[k]) p.set(k, f[k]);
  if (f.sort !== 'newest') p.set('sort', f.sort);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}
const isDefault = (f: Filters) => !f.q && !f.fn.length && !f.level && !f.type && !f.company && !f.tier && !f.workplace && !f.loc && !f.posted && !f.frontline && !f.radar && f.sort === 'newest';

export default function JobBoard({ total, functions, levels, companies, newest, includeFrontline, ads = [] }: Props) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, Row[]>>({});
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [wantAll, setWantAll] = useState(false);
  const [lastVisit, setLastVisit] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inflight = useRef(new Set<string>());

  const names = useMemo(() => Object.fromEntries(companies.map((c) => [c.slug, c.name])), [companies]);
  const tiers = useMemo(() => Object.fromEntries(companies.map((c) => [c.slug, c.tier])), [companies]);
  const prerendered = useMemo(() => new Set(newest.map((r) => r.i)), [newest]);

  // URL → state on mount; remember the previous visit for the "new since last visit" highlight.
  useEffect(() => {
    setF(readUrl());
    setReady(true);
    setNow(Date.now());
    try {
      const prev = Number(localStorage.getItem('upstream:lastVisit'));
      if (prev) setLastVisit(prev);
      localStorage.setItem('upstream:lastVisit', String(Date.now()));
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { if (ready) writeUrl(f); setLimit(PAGE); }, [f, ready]);

  // Analytics: what people search and filter for (debounced; never anything personal).
  const lastTracked = useRef<Filters>(EMPTY);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const prev = lastTracked.current;
      const track = (window as any).upstreamTrack as undefined | ((e: string, p?: object) => void);
      if (track) {
        if (f.q !== prev.q && f.q.trim().length >= 2) track('search', { q: f.q.trim().toLowerCase().slice(0, 60), results: resultsCount.current });
        for (const k of ['level', 'type', 'company', 'tier', 'workplace', 'posted', 'radar', 'sort', 'frontline'] as const) if (f[k] !== prev[k] && f[k]) track('filter', { key: k, value: String(f[k]).slice(0, 40) });
        for (const id of f.fn) if (!prev.fn.includes(id)) track('filter', { key: 'function', value: id });
        if (f.loc !== prev.loc && f.loc.trim().length >= 2) track('filter', { key: 'location', value: f.loc.trim().toLowerCase().slice(0, 40) });
      }
      lastTracked.current = f;
    }, 1200);
    return () => clearTimeout(t);
  }, [f, ready]);
  const resultsCount = useRef(0);

  // Which listing files does the current view need?
  const needed = useMemo(() => {
    if (!ready) return [];
    if (isDefault(f) && !wantAll) return [];
    return (f.fn.length ? f.fn : functions.filter((x) => x.count > 0).map((x) => x.id)).filter((id) => !loaded[id]);
  }, [f, ready, wantAll, loaded, functions]);

  useEffect(() => {
    const todo = needed.filter((id) => !inflight.current.has(id));
    if (!todo.length) return;
    setLoading(true);
    // Biggest-first isn't needed: load the selected functions, smallest files first for quick feedback.
    const order = [...todo].sort((a, b) => (functions.find((x) => x.id === a)?.count ?? 0) - (functions.find((x) => x.id === b)?.count ?? 0));
    (async () => {
      for (const id of order) {
        inflight.current.add(id);
        try {
          const res = await fetch(`/data/idx/${id}.json`);
          const rows: Row[] = res.ok ? await res.json() : [];
          setLoaded((m) => ({ ...m, [id]: rows }));
        } catch {
          setLoaded((m) => ({ ...m, [id]: [] }));
        }
      }
      setLoading(false);
    })();
  }, [needed, functions]);

  const source: Row[] = useMemo(() => {
    if (!ready || (isDefault(f) && !wantAll)) return newest;
    const ids = f.fn.length ? f.fn : functions.map((x) => x.id);
    const rows = ids.flatMap((id) => loaded[id] ?? []);
    // While files stream in, keep showing the matching newest roles so the page never goes blank.
    if (!rows.length) return newest.filter((r) => !f.fn.length || f.fn.includes(r.f));
    return rows;
  }, [f, ready, wantAll, loaded, newest, functions]);

  const results = useMemo(() => {
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    const locQ = f.loc.toLowerCase().trim();
    const cutoff = f.posted ? now - ({ '24h': 1, '7d': 7, '30d': 30 }[f.posted] ?? 0) * 864e5 : 0;
    const out = source.filter((r) => {
      if (f.level && !f.level.split(',').includes(r.l)) return false;
      if (f.type && r.e !== f.type) return false;
      if (f.company && r.c !== f.company) return false;
      if (f.tier && tiers[r.c] !== f.tier) return false;
      if (f.workplace && r.w !== f.workplace) return false;
      if (f.frontline === 'only' && !r.fl) return false;
      if (f.frontline === 'hide' && r.fl) return false;
      if (cutoff && postedOrSeen(r) < cutoff) return false;
      if (f.radar) {
        const fr = freshness(r, now);
        if (f.radar === 'fresh' && fr.tier !== 'fresh') return false;
        if (f.radar === 'hide-long' && (fr.tier === 'long' || fr.tier === 'evergreen')) return false;
      }
      if (locQ && !(locQ === 'remote' ? r.w === 'remote' : r.loc.some((l) => l.toLowerCase().includes(locQ)))) return false;
      if (words.length) {
        const hay = `${r.t} ${names[r.c] ?? ''} ${r.loc.join(' ')}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    if (f.sort === 'company') out.sort((a, b) => (names[a.c] ?? '').localeCompare(names[b.c] ?? '') || postedOrSeen(b) - postedOrSeen(a));
    else out.sort((a, b) => postedOrSeen(b) - postedOrSeen(a));
    return out;
  }, [source, f, names, tiers, now]);

  const set = (patch: Partial<Filters>) => setF((cur) => ({ ...cur, ...patch }));
  const toggleFn = (id: string) => set({ fn: f.fn.includes(id) ? f.fn.filter((x) => x !== id) : [...f.fn, id] });
  const field = 'h-12 w-full rounded-[var(--radius)] border border-hairline bg-surface px-4 text-sm text-ink placeholder:text-muted transition-colors duration-200 hover:border-hairline-strong focus:border-accent focus:outline-none';
  const showingAll = !(isDefault(f) && !wantAll);
  resultsCount.current = results.length;
  const shown = results.slice(0, limit);
  const fnLabel = Object.fromEntries(functions.map((x) => [x.id, x.label]));

  return (
    <div className="flex flex-col gap-8">
      {/* Search + filters */}
      <div className="flex flex-col gap-6">
        <label className="relative block">
          <span className="sr-only">Search roles</span>
          <input type="search" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search title, company or city" className={`${field} h-14 pl-12 text-base`} />
          <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.25"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </label>

        <fieldset>
          <legend className="meta mb-3">Function</legend>
          <div className="flex flex-wrap gap-2">
            {functions.filter((x) => x.count > 0).map((x) => {
              const on = f.fn.includes(x.id);
              return (
                <button key={x.id} type="button" aria-pressed={on} onClick={() => toggleFn(x.id)}
                  className={`h-9 rounded-full border px-4 text-sm transition-colors duration-200 ${on ? 'border-accent bg-accent/10 text-accent' : 'border-hairline text-muted hover:border-hairline-strong hover:text-ink'}`}>
                  {x.label} <span className="font-mono text-xs">{x.count.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Select label="Level" value={f.level} onChange={(v) => set({ level: v })} options={[['', 'All levels'], ...levels.filter((l) => l.count).map((l) => [l.id, LEVEL_SHORT[l.id] ?? l.label] as [string, string])]} cls={field} />
          <Select label="Type" value={f.type} onChange={(v) => set({ type: v })} options={[['', 'All types'], ...Object.entries(EMPLOYMENT)]} cls={field} />
          <Select label="Company" value={f.company} onChange={(v) => set({ company: v })} options={[['', 'All companies'], ...companies.filter((c) => c.mode === 'fetch' && c.count).map((c) => [c.slug, c.name] as [string, string])]} cls={field} />
          <Select label="Tier" value={f.tier} onChange={(v) => set({ tier: v })} options={[['', 'All tiers'], ['A', 'S&P top 50'], ['B', 'Top tech'], ['C', 'Leading private']]} cls={field} />
          <Select label="Workplace" value={f.workplace} onChange={(v) => set({ workplace: v })} options={[['', 'Anywhere'], ...Object.entries(WORKPLACE)]} cls={field} />
          <label className="block">
            <span className="meta mb-2 block">Location</span>
            <input value={f.loc} onChange={(e) => set({ loc: e.target.value })} placeholder="City, state or “remote”" className={field} />
          </label>
          <Select label="Posted" value={f.posted} onChange={(v) => set({ posted: v })} options={[['', 'Any time'], ['24h', 'Past 24 hours'], ['7d', 'Past week'], ['30d', 'Past month']]} cls={field} />
          <Select label="Ghost-job radar" value={f.radar} onChange={(v) => set({ radar: v as Filters['radar'] })} options={[['', 'Show all'], ['hide-long', `Hide roles open ${RADAR.longDays}+ days`], ['fresh', `Fresh only (≤ ${RADAR.freshDays} days)`]]} cls={field} />
          <Select label="Sort" value={f.sort} onChange={(v) => set({ sort: v as Filters['sort'] })} options={[['newest', 'Newest first'], ['company', 'Company A–Z']]} cls={field} />
          {includeFrontline && (
            <Select label="Frontline & hourly" value={f.frontline} onChange={(v) => set({ frontline: v as Filters['frontline'] })} options={[['', 'Show all'], ['only', 'Only frontline'], ['hide', 'Hide frontline']]} cls={field} />
          )}
        </div>
      </div>

      {/* Result summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <p className="meta text-ink" aria-live="polite">
          {showingAll ? `${results.length.toLocaleString()} roles` : `Newest ${results.length} of ${total.toLocaleString()} live roles`}
          {loading && <span className="ml-3 text-muted">· loading more…</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {f.fn.map((id) => <button key={id} onClick={() => toggleFn(id)} className="meta rounded-full border border-hairline px-3 py-1 hover:border-accent">{fnLabel[id]} ×</button>)}
          {!isDefault(f) && <button onClick={() => setF(EMPTY)} className="meta link">Clear all</button>}
        </div>
      </div>

      {/* Results */}
      <h2 className="sr-only">Results</h2>
      {shown.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-4 px-4 py-24 text-center">
          <span className="rule-accent inline-block" aria-hidden="true" />
          <h3 className="text-[length:var(--t-h2)]">Nothing here yet</h3>
          <p className="max-w-md text-muted">New roles land every few hours. Try widening your filters, or tell us which company we're missing.</p>
          <a href="/feedback?type=missing-company" className="link text-sm">Suggest a company →</a>
        </div>
      ) : (
        <ul className="divide-y divide-hairline border-y border-hairline">
          {shown.flatMap((r, idx) => {
            const row = <JobRowView key={r.i} row={r} companyName={names[r.c] ?? r.c} isNew={lastVisit !== null && minToMs(r.fs) > lastVisit} prerendered={prerendered} now={now} />;
            if (ads.length && idx > 0 && idx % AD_EVERY === 0) {
              const ad = ads[(idx / AD_EVERY - 1) % ads.length];
              const ext = /^https?:/.test(ad.url);
              return [
                <li key={`ad-${idx}`} className="py-4">
                  <aside aria-label="Sponsored" className="relative min-h-[112px] rounded-[var(--radius)] border border-hairline bg-surface">
                    <span className="meta absolute right-3 top-3 !text-[0.625rem]">Sponsored</span>
                    <div className="flex h-full flex-col justify-center gap-2 p-6 pr-24">
                      <p className="meta text-accent">{ad.sponsor ? `Sponsor · ${ad.sponsor}` : ad.eyebrow ?? 'House'}</p>
                      <p className="font-serif text-xl">{ad.headline}</p>
                      {ad.body && <p className="text-sm text-muted">{ad.body}</p>}
                      <a href={ad.url} className="link w-fit text-sm" data-track="ad_click" data-track-props={JSON.stringify({ id: ad.id ?? ad.headline.slice(0, 40), placement: 'list' })} {...(ext ? { target: '_blank', rel: 'noopener sponsored' } : {})}>{ad.cta ?? 'Learn more'} →</a>
                    </div>
                  </aside>
                </li>,
                row,
              ];
            }
            return [row];
          })}
        </ul>
      )}

      {(results.length > limit || !showingAll) && (
        <div className="flex justify-center">
          <button type="button" onClick={() => { if (!showingAll) setWantAll(true); setLimit((n) => n + PAGE); (window as any).upstreamTrack?.('show_more', { value: showingAll ? 'more' : 'browse_all' }); }}
            className="inline-flex h-12 items-center rounded-full border border-hairline-strong px-8 text-sm transition-colors duration-200 hover:border-accent">
            {showingAll ? `Show more (${(results.length - limit).toLocaleString()} left)` : `Browse all ${total.toLocaleString()} roles`}
          </button>
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options, cls }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; cls: string }) {
  return (
    <label className="block">
      <span className="meta mb-2 block">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
