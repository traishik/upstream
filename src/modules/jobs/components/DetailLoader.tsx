import { useEffect, useState } from 'react';
import JobDetail, { type DetailAd } from './JobDetail';
import { shardOf, type JobRecord } from '@/lib/jobs';

/** /jobs/view/?id=… : loads one description shard and renders the job. */
export default function DetailLoader({ names, functionLabels, ad }: { names: Record<string, string>; functionLabels: Record<string, string>; ad?: DetailAd | null }) {
  const [state, setState] = useState<{ job?: JobRecord; missing?: boolean }>({});
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('id') ?? location.pathname.match(/\/jobs\/([0-9a-f]{12})/)?.[1] ?? '';
    if (!/^[0-9a-f]{12}$/.test(id)) { setState({ missing: true }); return; }
    fetch(`/data/desc/${shardOf(id)}.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((shard: Record<string, JobRecord>) => {
        const job = shard[id];
        setState(job ? { job } : { missing: true });
        if (job) document.title = `${job.title} · ${names[job.company] ?? job.company}`;
      })
      .catch(() => setState({ missing: true }));
  }, [names]);

  if (state.missing) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <span className="rule-accent inline-block" aria-hidden="true" />
        <h1 className="text-[length:var(--t-h2)]">This role has closed</h1>
        <p className="max-w-md text-muted">It's no longer on the company's careers page, so we've taken it down. That's how we keep this list honest. There's plenty more where it came from.</p>
        <a href="/jobs" className="link text-sm">Browse live roles →</a>
      </div>
    );
  }
  if (!state.job) return <p className="meta py-24 text-center">Loading role…</p>;
  const j = state.job;
  return <JobDetail job={j} companyName={names[j.company] ?? j.company} functionLabel={functionLabels[j.function] ?? j.function} ad={ad} />;
}
