import { describe, expect, it } from 'vitest';
import { referralAllowed } from '../api/insiders';
import { CONTACT_RE, EMAIL_RE } from '../api/_shared';

const stripe = ['stripe.com', 'boards.greenhouse.io/stripe', 'job-boards.greenhouse.io/stripe'];

describe('Inside Track referral allowlist', () => {
  it('accepts the company domain and subdomains', () => {
    expect(referralAllowed('https://stripe.com/jobs/listing/123?ref=abc', stripe)).toBe(true);
    expect(referralAllowed('https://www.stripe.com/jobs', stripe)).toBe(true);
    expect(referralAllowed('https://careers.stripe.com/x', stripe)).toBe(true);
  });
  it("accepts only the company's own board on a shared ATS", () => {
    expect(referralAllowed('https://job-boards.greenhouse.io/stripe/jobs/1?gh_src=ref', stripe)).toBe(true);
    expect(referralAllowed('https://job-boards.greenhouse.io/someoneelse/jobs/1', stripe)).toBe(false);
    expect(referralAllowed('https://job-boards.greenhouse.io/stripefake/jobs/1', stripe)).toBe(false);
  });
  it('rejects look-alikes, http, credentials and shorteners', () => {
    expect(referralAllowed('https://stripe.com.evil.io/jobs', stripe)).toBe(false);
    expect(referralAllowed('https://evilstripe.com/jobs', stripe)).toBe(false);
    expect(referralAllowed('http://stripe.com/jobs', stripe)).toBe(false);
    expect(referralAllowed('https://user:pw@stripe.com/jobs', stripe)).toBe(false);
    expect(referralAllowed('https://bit.ly/abc', stripe)).toBe(false);
    expect(referralAllowed('not a url', stripe)).toBe(false);
  });
});

describe('contact details filter', () => {
  it('catches emails and phone numbers in public text', () => {
    expect(CONTACT_RE.test('email me at jane.doe@gmail.com')).toBe(true);
    expect(CONTACT_RE.test('call +1 (555) 123-4567')).toBe(true);
    expect(CONTACT_RE.test('Read the eng blog before your loop; it helps a lot in 2026.')).toBe(false);
  });
  it('validates reply emails', () => {
    expect(EMAIL_RE.test('a@b.co')).toBe(true);
    expect(EMAIL_RE.test('not-an-email')).toBe(false);
  });
});
