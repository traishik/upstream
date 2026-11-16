import { useEffect, useState } from 'react';
import { readSaved, shardOf, writeSaved, type JobRecord, type SavedEntry } from '@/lib/jobs';
import { Monogram } from './JobRowView';

/** /saved: the roles this browser saved. Each one is re-checked against the live data. */
export default function SavedList({ names }: { names: Record<string, string> }) {
  const [items, setItems] = useState<(SavedEntry & { live?: boolean; job?: JobRecord })[] | null>(null);

  useEffect(() => {
    const saved = Object.values(readSaved()).sort((a, b) => b.savedAt - a.savedAt);
    setItems(saved);
    const shards = [...new Set(saved.map((s) => shardOf(s.id)))];
    Promise.all(shards.map((k) => fetch(`/data/desc/${k}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))))
      .then((list: Record<string, JobRecord>[]) => {
        const all = Object.assign({}, ...list) as Record<string, JobRecord>;
        setItems(saved.map((s) => ({ ...s, live: Boolean(all[s.id]), job: all[s.id] })));
      });
  }, []);

  const remove = (id: string) => {
    const all = readSaved();
    delete all[id];
    writeSaved(all);
    setItems((cur) => cur?.filter((x) => x.id !== id) ?? null);
  };

  if (items === null) return <p className="meta py-16">Loading your saved roles…</p>;
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <span className="rule-accent inline-block" aria-hidden="true" />
        <h2 className="text-[length:var(--t-h2)]">No saved roles yet</h2>
        <p className="max-w-md text-muted">Tap “Save role” on any job to keep it here. It stays on this device only; no account needed.</p>
        <a href="/jobs" className="link text-sm">Browse live roles →</a>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-hairline border-y border-hairline">
      {items.map((s) => (
        <li key={s.id} className="flex items-center gap-4 px-4 py-6 sm:px-6">
          <Monogram name={names[s.c] ?? s.c} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">{names[s.c] ?? s.c}</p>
            {s.live === false ? (
              <>
                <p className="mt-1 font-medium text-muted line-through decoration-hairline-strong">{s.t}</p>
                <p className="mt-1 text-sm text-muted">This one has closed. The company took it down, so we did too. It happens to the best roles; there are more like it.</p>
              </>
            ) : (
              <a href={`/jobs/view/?id=${s.id}`} className="mt-1 block font-medium hover:text-accent">{s.t}</a>
            )}
          </div>
          <button type="button" onClick={() => remove(s.id)} className="meta hover:text-ink">Remove</button>
        </li>
      ))}
    </ul>
  );
}
