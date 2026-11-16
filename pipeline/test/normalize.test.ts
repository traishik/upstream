import { describe, expect, it } from 'vitest';
import { cleanLocations, isUsJob, isUsLocation, jobId, sanitize, workplaceOf } from '../normalize.ts';
import type { RawJob } from '../types.ts';

const raw = (o: Partial<RawJob>): RawJob => ({ sourceId: '1', title: 'Engineer', locations: [], applyUrl: 'https://x', sourceUrl: 'https://x', ...o });

describe('US location detection', () => {
  const us = ['San Francisco, CA', 'New York, NY', 'US, WA, Seattle', 'Remote - US', 'United States', 'Austin, Texas', 'Seattle', 'Remote (US)', 'USA', 'Arlington, Virginia, USA', 'Carmel, CA, United States', 'Washington, DC'];
  const notUs = ['Dublin', 'London, UK', 'Toronto, ON', 'Bangalore, India', 'Singapore', 'Remote - EMEA', 'Vancouver, BC', 'Tokyo, Japan'];
  for (const l of us) it(`US: ${l}`, () => expect(isUsLocation(l)).toBe(true));
  for (const l of notUs) it(`not US: ${l}`, () => expect(isUsLocation(l)).toBe(false));
  it('country codes win', () => {
    expect(isUsJob(raw({ locations: ['Somewhere'], countryCodes: ['US'] }))).toBe(true);
    expect(isUsJob(raw({ locations: ['Seattle'], countryCodes: ['CA'] }))).toBe(false);
  });
  it('bare Remote counts as US-remote', () => expect(isUsJob(raw({ locations: ['Remote'] }))).toBe(true));
  it('any US location qualifies a multi-location job', () => expect(isUsJob(raw({ locations: ['Dublin', 'New York, NY'] }))).toBe(true));
});

describe('workplace', () => {
  it('explicit wins', () => expect(workplaceOf(raw({ workplace: 'hybrid', locations: ['Remote'] }))).toBe('hybrid'));
  it('remote from location', () => expect(workplaceOf(raw({ locations: ['Remote - US'] }))).toBe('remote'));
  it('hybrid from location', () => expect(workplaceOf(raw({ locations: ['Hybrid'] }))).toBe('hybrid'));
  it('defaults to onsite', () => expect(workplaceOf(raw({ locations: ['Austin, TX'] }))).toBe('onsite'));
});

describe('locations cleanup', () => {
  it('puts US first, normalizes Workday style, dedupes', () =>
    expect(cleanLocations(['Dublin', 'US, CA, Santa Clara', 'Santa Clara, CA', 'Hybrid'])).toEqual(['Santa Clara, CA', 'Dublin']));
  it('never returns empty', () => expect(cleanLocations(['Hybrid'])).toEqual(['United States']));
});

describe('sanitizer', () => {
  it('removes scripts, iframes, handlers, styles and classes', () => {
    const out = sanitize('<div class="x" style="color:red" onclick="evil()"><script>alert(1)</script><iframe src="//e"></iframe><p onmouseover="x">Hi <b>there</b></p></div>')!;
    expect(out).not.toMatch(/script|iframe|onclick|onmouseover|style=|class=|alert/);
    expect(out).toContain('<strong>there</strong>');
  });
  it('keeps safe links and forces rel/target', () => {
    const out = sanitize('<a href="https://example.com" onclick="x">a</a><a href="javascript:alert(1)">b</a>')!;
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="noopener nofollow"');
    expect(out).not.toContain('javascript:');
  });
  it('maps h1 to h3 and drops empty paragraphs', () => expect(sanitize('<h1>T</h1><p> </p><p>x</p>')).toBe('<h3>T</h3><p>x</p>'));
});

describe('ids', () => {
  it('are stable and company-scoped', () => {
    expect(jobId('stripe', '123')).toBe(jobId('stripe', '123'));
    expect(jobId('stripe', '123')).not.toBe(jobId('airbnb', '123'));
    expect(jobId('stripe', '123')).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('sanitizer: empty links', () => {
  it('drops links with no text (screen readers announce them as blank)', () =>
    expect(sanitize('<p>See <a href="https://x.com/benefits"></a> our benefits</p>')).toBe('<p>See  our benefits</p>'));
});
