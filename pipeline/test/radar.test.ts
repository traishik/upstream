import { describe, expect, it } from 'vitest';
import { freshness, freshnessLabel } from '../../src/lib/jobs.ts';

const now = Date.UTC(2026, 10, 16);
const min = (daysAgo: number) => Math.round((now - daysAgo * 864e5) / 60000);

describe('ghost-job radar', () => {
  it('fresh within 3 days', () => expect(freshness({ p: min(2), fs: min(2) }, now).tier).toBe('fresh'));
  it('posted today label', () => expect(freshnessLabel(freshness({ p: min(0), fs: min(0) }, now))).toBe('Posted today'));
  it('normal between 4 and 59 days', () => expect(freshness({ p: min(30), fs: min(1) }, now).tier).toBe('normal'));
  it('long at 60+ days', () => expect(freshness({ p: min(75), fs: min(1) }, now)).toMatchObject({ tier: 'long', days: 75 }));
  it('evergreen at 120+ days', () => expect(freshness({ p: min(200), fs: min(1) }, now).tier).toBe('evergreen'));
  it('never flags long-open without a real posted date', () => expect(freshness({ fs: min(90) }, now)).toMatchObject({ basis: 'seen', tier: 'normal' }));
  it('labels by basis', () => {
    expect(freshnessLabel(freshness({ p: min(75), fs: min(1) }, now))).toBe('Open 75 days');
    expect(freshnessLabel(freshness({ fs: min(10) }, now))).toBe('Seen 10+ days');
  });
});
