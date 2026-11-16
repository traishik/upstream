// Static QA over the built site (dist/). Run after `npm run build`:  npm run qa
// Checks every HTML page for broken internal links, SEO basics, accessibility basics, safe external
// links, valid JSON-LD, and page-weight budgets. Exits 1 if any check fails.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = new URL('../dist/', import.meta.url).pathname.replace(/%20/g, ' ');
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(DIST);
const pages = files.filter((f) => f.endsWith('.html'));
const failures = [];
const warnings = [];
const fail = (page, msg) => failures.push(`${page}: ${msg}`);
const warn = (page, msg) => warnings.push(`${page}: ${msg}`);

const exists = (urlPath) => {
  const p = decodeURIComponent(urlPath.split(/[?#]/)[0]);
  if (p === '' || p === '/') return existsSync(join(DIST, 'index.html'));
  const c = [join(DIST, p), join(DIST, p, 'index.html'), join(DIST, `${p}.html`)];
  return c.some((x) => existsSync(x) && (statSync(x).isFile() || existsSync(join(x, 'index.html'))));
};
// Routes that exist only at runtime (Pages Functions) or are filled in client-side.
const DYNAMIC = [/^\/api\//, /^\/jobs\/view\/?$/];

let checkedLinks = 0;
for (const file of pages) {
  const page = '/' + relative(DIST, file).replace(/index\.html$/, '');
  const html = readFileSync(file, 'utf8');
  const noindex = /name="robots" content="noindex"/.test(html);

  // SEO basics
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  if (!title) fail(page, 'missing <title>');
  else if (title.length > 70) warn(page, `title is ${title.length} chars (Google shows ~60)`);
  if (!/<meta name="description" content="[^"]{20,}/.test(html)) fail(page, 'missing/short meta description');
  if (!/<link rel="canonical"/.test(html)) fail(page, 'missing canonical');
  if (!/<html lang="en"/.test(html)) fail(page, 'missing <html lang>');
  if (!/property="og:image"/.test(html)) fail(page, 'missing og:image');
  const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1s !== 1 && !page.startsWith('/jobs/view') && !page.startsWith('/saved')) (noindex ? warn : fail)(page, `${h1s} <h1> elements (want 1)`);

  // Accessibility basics
  for (const img of html.match(/<img\b[^>]*>/g) ?? []) if (!/\balt=/.test(img)) fail(page, `img without alt: ${img.slice(0, 80)}`);
  for (const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const attrs = m[2];
    if (/type="(hidden|submit)"/.test(attrs) || /tabindex="-1"/.test(attrs)) continue;
    const id = attrs.match(/\bid="([^"]+)"/)?.[1];
    const before = html.slice(Math.max(0, m.index - 600), m.index);
    const wrapped = before.lastIndexOf('<label') > before.lastIndexOf('</label>');
    if (!wrapped && !(id && html.includes(`for="${id}"`)) && !/aria-label=/.test(attrs)) fail(page, `form control without a label: <${m[1]} ${attrs.slice(0, 60)}>`);
  }
  if (!/href="#main"/.test(html)) fail(page, 'missing skip link');

  // Links
  for (const m of html.matchAll(/<a\b([^>]*)>/g)) {
    const attrs = m[1];
    const href = attrs.match(/\bhref="([^"]*)"/)?.[1];
    if (href === undefined) continue;
    if (/target="_blank"/.test(attrs) && !/rel="[^"]*noopener/.test(attrs)) fail(page, `target=_blank without rel=noopener: ${href}`);
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    checkedLinks++;
    if (DYNAMIC.some((re) => re.test(href.split(/[?#]/)[0]))) continue;
    if (!exists(href)) fail(page, `broken internal link: ${href}`);
  }

  // JSON-LD must parse
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]);
      if (d['@type'] === 'JobPosting' && (!d.title || !d.hiringOrganization || !d.datePosted || !d.description)) fail(page, 'JobPosting missing required fields');
    } catch { fail(page, 'invalid JSON-LD'); }
  }
}

// Budgets
const jsFiles = files.filter((f) => f.endsWith('.js'));
const gz = (f) => gzipSync(readFileSync(f)).length;
const totalJs = jsFiles.reduce((a, f) => a + gz(f), 0);
const manifest = join(DIST, 'data', 'manifest.json');
const manifestGz = existsSync(manifest) ? gz(manifest) : 0;
const idxDir = join(DIST, 'data', 'idx');
const idx = existsSync(idxDir) ? readdirSync(idxDir).map((f) => ({ f, gz: gz(join(idxDir, f)) })) : [];
const biggestIdx = idx.sort((a, b) => b.gz - a.gz)[0];
const homeGz = gz(join(DIST, 'index.html'));
const jobsGz = gz(join(DIST, 'jobs', 'index.html'));
if (manifestGz > 400_000) fail('/data/manifest.json', `${(manifestGz / 1024).toFixed(0)} KB gz exceeds 400 KB`);
if (jobsGz > 500_000) fail('/jobs/', `HTML ${(jobsGz / 1024).toFixed(0)} KB gz exceeds 500 KB`);
if (files.length > 20000) fail('dist', `${files.length} files exceeds Cloudflare's 20,000-file limit`);
for (const f of files) if (statSync(f).size > 25 * 1024 * 1024) fail(relative(DIST, f), 'file exceeds 25 MB');

// sitemap + robots
const sitemap = files.find((f) => /sitemap-0\.xml$/.test(f));
if (!sitemap) fail('sitemap', 'missing sitemap-0.xml');
else if (/styleguide|\/status/.test(readFileSync(sitemap, 'utf8'))) fail('sitemap', 'contains private pages');
if (!readFileSync(join(DIST, 'robots.txt'), 'utf8').includes('Sitemap:')) fail('robots.txt', 'missing Sitemap line');

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`Pages: ${pages.length} · files: ${files.length} · internal links checked: ${checkedLinks}`);
console.log(`JS total (gz): ${kb(totalJs)} · home HTML: ${kb(homeGz)} · /jobs HTML: ${kb(jobsGz)} · manifest: ${kb(manifestGz)} · largest listing file: ${biggestIdx ? `${biggestIdx.f} ${kb(biggestIdx.gz)}` : 'n/a'}`);
if (warnings.length) console.log(`\n${warnings.length} warning(s):\n  ${[...new Set(warnings)].slice(0, 40).join('\n  ')}`);
if (failures.length) {
  console.log(`\n✗ ${failures.length} failure(s):\n  ${[...new Set(failures)].slice(0, 80).join('\n  ')}`);
  process.exit(1);
}
console.log('\n✓ All static QA checks passed');
