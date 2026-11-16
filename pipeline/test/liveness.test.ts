import { describe, expect, it } from 'vitest';
import { judgePage } from '../liveness.ts';

const job = { applyUrl: 'https://careers.example.com/jobs/12345/software-engineer' };
const page = (o: Partial<{ status: number; finalUrl: string; body: string; redirected: boolean }>) => ({
  status: 200, finalUrl: job.applyUrl, body: '<h1>Software Engineer</h1><button>Apply</button>', redirected: false, ...o,
});

describe('liveness: page verdicts', () => {
  it('2xx job page is live', () => expect(judgePage(job, '12345', page({})).status).toBe('live'));
  it('404 / 410 is dead', () => {
    expect(judgePage(job, '12345', page({ status: 404 })).status).toBe('dead');
    expect(judgePage(job, '12345', page({ status: 410 })).status).toBe('dead');
  });
  it('5xx is unknown (keep previous state, retry later)', () => expect(judgePage(job, '12345', page({ status: 503 })).status).toBe('unknown'));
  it('"no longer accepting applications" is dead', () =>
    expect(judgePage(job, '12345', page({ body: '<p>This job is no longer accepting applications.</p>' })).status).toBe('dead'));
  it('"position has been filled" is dead', () =>
    expect(judgePage(job, '12345', page({ body: '<div>Sorry, this position has been filled</div>' })).status).toBe('dead'));
  it('"job not found" is dead', () => expect(judgePage(job, '12345', page({ body: 'Job not found' })).status).toBe('dead'));
  it('redirect to a generic search page is dead', () =>
    expect(judgePage(job, '12345', page({ redirected: true, finalUrl: 'https://careers.example.com/jobs?error=true' })).status).toBe('dead'));
  it('redirect to /careers is dead', () =>
    expect(judgePage(job, '12345', page({ redirected: true, finalUrl: 'https://careers.example.com/careers' })).status).toBe('dead'));
  it('redirect that keeps the job id is live', () =>
    expect(judgePage(job, '12345', page({ redirected: true, finalUrl: 'https://careers.example.com/en/jobs/12345' })).status).toBe('live'));
  it('dead-text inside <script> is ignored', () =>
    expect(judgePage(job, '12345', page({ body: '<script>var msg="This job is no longer available"</script><h1>Engineer</h1>' })).status).toBe('live'));
});
