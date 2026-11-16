import { useEffect, useState } from 'react';

/**
 * Filter bar (React island). In the styleguide it shows the interaction and URL-state pattern;
 * in Phase 3 it drives the real index. Filter state lives in the URL so searches can be shared.
 */
const FUNCTIONS = ['Software Engineering', 'Product Management', 'Data, AI & ML', 'Design & Research', 'Sales & Partnerships', 'Finance & Accounting', 'Operations & Supply Chain'];
const LEVELS = ['Internship', 'New Grad / Early Career', 'Mid', 'Senior', 'Staff / Principal', 'Manager', 'Senior Manager', 'Director', 'VP & Executive'];
const WORKPLACE = ['Any', 'Remote', 'Hybrid', 'Onsite'] as const;
const POSTED = [['', 'Any time'], ['24h', 'Past 24 hours'], ['7d', 'Past week'], ['30d', 'Past month']] as const;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function FilterBar({ syncUrl = true }: { syncUrl?: boolean }) {
  const [q, setQ] = useState('');
  const [fns, setFns] = useState<string[]>([]);
  const [level, setLevel] = useState('');
  const [workplace, setWorkplace] = useState<(typeof WORKPLACE)[number]>('Any');
  const [posted, setPosted] = useState('');

  useEffect(() => {
    if (!syncUrl) return;
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (fns.length) p.set('function', fns.map(slug).join(','));
    if (level) p.set('level', slug(level));
    if (workplace !== 'Any') p.set('workplace', workplace.toLowerCase());
    if (posted) p.set('posted', posted);
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }, [q, fns, level, workplace, posted, syncUrl]);

  const toggleFn = (f: string) => setFns((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  const field = 'h-12 w-full rounded-[var(--radius)] border border-hairline bg-surface px-4 text-sm text-ink placeholder:text-muted transition-colors duration-200 hover:border-hairline-strong focus:border-accent focus:outline-none';

  return (
    <div className="flex flex-col gap-6">
      <label className="relative block">
        <span className="sr-only">Search roles</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, company or city" className={`${field} h-14 pl-12 text-base`} />
        <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.25"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </label>

      <fieldset>
        <legend className="meta mb-3">Function</legend>
        <div className="flex flex-wrap gap-2">
          {FUNCTIONS.map((f) => {
            const on = fns.includes(f);
            return (
              <button key={f} type="button" aria-pressed={on} onClick={() => toggleFn(f)}
                className={`h-9 rounded-full border px-4 text-sm transition-colors duration-200 ${on ? 'border-accent bg-accent/10 text-accent' : 'border-hairline text-muted hover:border-hairline-strong hover:text-ink'}`}>
                {f}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="meta mb-2 block">Level</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={field}>
            <option value="">All levels</option>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="meta mb-2">Workplace</legend>
          <div className="flex h-12 rounded-[var(--radius)] border border-hairline p-1" role="radiogroup">
            {WORKPLACE.map((w) => (
              <button key={w} type="button" role="radio" aria-checked={workplace === w} onClick={() => setWorkplace(w)}
                className={`flex-1 rounded-[var(--radius)] text-sm transition-colors duration-200 ${workplace === w ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}>
                {w}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="meta mb-2 block">Posted</span>
          <select value={posted} onChange={(e) => setPosted(e.target.value)} className={field}>
            {POSTED.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
