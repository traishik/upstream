/** Turns RawJob → Job: US filter, workplace, sanitized HTML, stable id, classification. */
import { createHash } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import type { Classifier } from './classify.ts';
import type { Company, Job, RawJob } from './types.ts';

const STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia', PR: 'Puerto Rico',
};
const STATE_NAMES = Object.values(STATES).filter((s) => s !== 'Washington' && s !== 'Georgia'); // ambiguous with DC / the country
const US_CITIES = [
  'San Francisco', 'New York', 'NYC', 'Seattle', 'Austin', 'Boston', 'Chicago', 'Los Angeles', 'Bay Area', 'Mountain View', 'Palo Alto',
  'Sunnyvale', 'Menlo Park', 'San Jose', 'Santa Clara', 'Cupertino', 'Redmond', 'Bellevue', 'Denver', 'Atlanta', 'Miami', 'Dallas',
  'Houston', 'Washington, DC', 'Washington DC', 'Washington D.C.', 'Arlington', 'Pittsburgh', 'Portland', 'San Diego', 'Irvine', 'Raleigh',
  'Phoenix', 'Salt Lake City', 'Boulder', 'Nashville', 'Philadelphia', 'Minneapolis', 'Detroit', 'Columbus', 'Brooklyn', 'Hawthorne',
  'Costa Mesa', 'Oakland', 'Emeryville', 'Redwood City', 'South San Francisco', 'San Mateo', 'Jersey City', 'Charlotte', 'Plano',
];
const NON_US = /\b(canada|united kingdom|\buk\b|ireland|india|germany|france|japan|singapore|australia|brazil|mexico|china|netherlands|spain|poland|israel|korea|taiwan|london|dublin|toronto|vancouver|bangalore|bengaluru|hyderabad|berlin|paris|tokyo|sydney|amsterdam|zurich|tel aviv|são paulo|sao paulo|emea|apac|latam|ontario|british columbia)\b/i;

/** Does one location string look like the United States? */
export function isUsLocation(loc: string): boolean {
  const s = loc.trim();
  if (!s) return false;
  if (/united states|\bUSA\b|\bU\.S\.A?\b|^US\b|\bUS$|\bUS[,\s-]|\bUS\)|\(US|AMER - US|North America/i.test(s)) return true;
  if (NON_US.test(s)) return false;
  const m = s.match(/,\s*([A-Z]{2})\b/);
  if (m && STATES[m[1]]) return true;
  if (STATE_NAMES.some((n) => new RegExp(`\\b${n}\\b`, 'i').test(s))) return true;
  if (US_CITIES.some((c) => s.toLowerCase().includes(c.toLowerCase()))) return true;
  return false;
}

export function isUsJob(raw: RawJob): boolean {
  if (raw.countryCodes?.length) return raw.countryCodes.some((c) => c === 'US' || c === 'USA');
  if (raw.locations.some(isUsLocation)) return true;
  // A bare "Remote" (no country anywhere) from a US company counts as US-remote.
  return raw.locations.length > 0 && raw.locations.every((l) => /^\s*(remote|distributed|anywhere)\s*$/i.test(l));
}

export function workplaceOf(raw: RawJob): Job['workplace'] {
  if (raw.workplace) return raw.workplace;
  const all = raw.locations.join(' | ');
  if (raw.remote || /\bremote\b|distributed|work from home|\bWFH\b/i.test(all) || /\bremote\b/i.test(raw.title)) {
    return /hybrid/i.test(all) ? 'hybrid' : 'remote';
  }
  if (/hybrid/i.test(all)) return 'hybrid';
  return 'onsite';
}

/** Tidy location strings: US ones first, de-duplicated, "Remote" normalized. */
export function cleanLocations(locs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const sorted = [...locs].sort((a, b) => Number(isUsLocation(b)) - Number(isUsLocation(a)));
  for (let l of sorted) {
    l = l.replace(/\s+/g, ' ').replace(/^US,\s*([A-Z]{2}),\s*(.+)$/, '$2, $1').replace(/,\s*(United States( of America)?|USA)$/i, '').trim();
    if (/^(hybrid|in-office|distributed)$/i.test(l)) continue;
    if (!l || seen.has(l.toLowerCase())) continue;
    seen.add(l.toLowerCase());
    out.push(l);
  }
  return out.length ? out : ['United States'];
}

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'h2', 'h3', 'h4', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
  nonTextTags: ['script', 'style', 'textarea', 'noscript', 'iframe', 'object', 'embed', 'svg', 'form', 'button', 'select'],
  transformTags: {
    h1: 'h3', h5: 'h4', h6: 'h4', b: 'strong', i: 'em',
    div: (tagName, attribs) => ({ tagName: 'p', attribs: {} }),
    a: (tagName, attribs) => ({ tagName: 'a', attribs: { href: attribs.href ?? '', rel: 'noopener nofollow', target: '_blank' } }),
  },
  exclusiveFilter: (frame) => ['p', 'li', 'h2', 'h3', 'h4', 'strong', 'em', 'a'].includes(frame.tag) && !frame.text.trim() && !frame.mediaChildren?.length,
};

/** Allowlist sanitizer: no scripts, iframes, event handlers, classes or inline styles. */
export function sanitize(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const clean = sanitizeHtml(html, { ...SANITIZE, allowedAttributes: { a: ['href', 'rel', 'target'] } })
    .replace(/(<br\s*\/?>\s*){3,}/g, '<br><br>')
    .replace(/<p>\s*<\/p>/g, '')
    .trim();
  return clean || undefined;
}

export const jobId = (company: string, sourceId: string) =>
  createHash('sha1').update(`${company}:${sourceId}`).digest('hex').slice(0, 12);

export function normalize(raw: RawJob, company: Company, cls: Classifier, now: string): { job: Job; fnMatched: boolean } {
  const fn = cls.fn(raw.title, raw.hints ?? []);
  const employmentType = cls.employment(raw.title, raw.employmentType);
  let level = cls.level(raw.title, company.slug, raw.hints ?? []);
  if (employmentType === 'internship') level = 'internship';
  const s = raw.salary;
  const job: Job = {
    id: jobId(company.slug, raw.sourceId),
    company: company.slug,
    title: raw.title.replace(/\s+/g, ' ').trim(),
    function: fn.id,
    level,
    employmentType,
    isFrontline: cls.isFrontline(raw.title),
    locations: cleanLocations(raw.locations),
    workplace: workplaceOf(raw),
    team: raw.team || undefined,
    postedAt: raw.postedAt,
    firstSeenAt: now,
    lastVerifiedAt: now,
    applyUrl: raw.applyUrl,
    sourceUrl: raw.sourceUrl,
    descriptionHtml: sanitize(raw.descriptionHtml),
    // Only what the source states. Never estimated.
    salaryRange: s && (s.min || s.max || s.text) ? { min: s.min, max: s.max, currency: s.currency, period: s.period, text: s.text } : undefined,
  };
  return { job, fnMatched: fn.matched };
}
