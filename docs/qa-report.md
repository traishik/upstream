# QA report

Date: 2026-11-16 · Build: local production build (`astro build` + `wrangler pages dev`), then live checks after deploy (section 5).

## 1. How to re-run everything

```bash
npm test             # 212 unit tests: classifier, normalizer, sanitizer, liveness, radar, endpoints
npm run check        # TypeScript (site)
npx tsc -p functions/tsconfig.json   # TypeScript (Pages Functions)
npm run build && npm run qa          # static QA over every built page (links, SEO, a11y, budgets)
npm run contrast     # WCAG AA for every color pair in both themes
```

## 2. Automated results

| Suite | Result |
|---|---|
| Unit tests (`vitest`) | **212 / 212 pass** |
| Type-check, site (`astro check`) | 0 errors, 0 warnings |
| Type-check, functions | 0 errors |
| Static QA (`scripts/qa.mjs`): 158 pages, 3,708 internal links | **All pass** (1 warning: /styleguide has 2 `<h1>`, intentional; page is noindex) |
| Contrast: 24 color pairs × 2 themes | All AA |
| Lighthouse (mobile), see §4 | 97–99 performance · 94–100 accessibility before fixes · 100 best practices · 100 SEO |

Static QA covers: broken internal links, `<title>` length, meta description, canonical, `lang`, Open Graph image, one `<h1>`, `img alt`, labelled form controls, skip link, `target=_blank` safety, JSON-LD validity (JobPosting required fields), file-count and file-size limits (Cloudflare: 20,000 files / 25 MB), payload budgets, sitemap privacy and robots.txt.

## 3. Manual test cases

| # | Area | Steps | Expected | Result |
|---|---|---|---|---|
| T1 | Home | Open `/` | Hero with live counts, entry paths, function chips with counts, featured companies, newest roles, house ad, Inside Track prompt | Pass |
| T2 | Theme | Toggle Ivory ⇄ Evening, reload | Theme persists; no flash | Pass |
| T3 | Board: function filter | `/jobs`, click "Software Engineering" | List narrows, URL gets `?function=software-engineering`, count updates | Pass |
| T4 | Board: search | Type "engineer" | Results filter as you type; URL `?q=engineer` | Pass |
| T5 | Board: shareable URL | Open `/jobs?function=software-engineering&q=engineer` directly | Same filters restored | Pass |
| T6 | Board: empty state | Search "zzzz" | "Nothing here yet…" with "Suggest a company" link | Pass |
| T7 | Board: ghost-job radar | Filter "Hide roles open 60+ days" / "Fresh only" | Long-open roles hidden / only ≤3-day roles shown; badges on rows | Pass |
| T8 | Board: new since last visit | Visit, come back after a refresh | New roles flagged | Pass (by logic; needs two data refreshes to see live) |
| T9 | Board: list ads | Scroll past 12 rows | One sponsored card per 12 rows, never inside a row | Pass |
| T10 | Detail (pre-rendered) | Open a newest role | Title, company, metadata, level/function, full sanitized description, "Last verified", Apply button opens official posting in a new tab with `rel=noopener` | Pass |
| T11 | Detail (client) | `/jobs/view/?id=<older id>` | Same layout, loads one description shard | Pass |
| T12 | Detail: closed role | `/jobs/view/?id=000000000000` | Gentle "This role has closed" message | Pass |
| T13 | Save | Click "Save role", open `/saved` | Role listed; Remove works; closed roles marked gently | Pass |
| T14 | Companies | `/companies`, then a link-only company (e.g. Google) | Grid by tier with live counts; link-only card with "Explore careers" link | Pass |
| T15 | Company page | `/companies/zoom` | Newest roles, "See all" link to filtered board, radar share (when ≥10 dated roles), Inside Track prompt | Pass |
| T16 | Feedback (JS) | Submit an idea | In-place "Thank you" message; row in D1 | Pass |
| T17 | Feedback (no JS) | POST form without JS | 303 redirect back with `?sent=1` and thank-you | Pass |
| T18 | Feedback deep links | `/feedback?type=missing-company`, `?topic=removal`, `?report=<id>` | Form pre-filled; headline and placeholder adapt | Pass |
| T19 | Feedback validation | Bad type, empty message, 20 KB message, honeypot filled | 400 `type,message` / 413 `too-large` / silent success (bot) | Pass |
| T20 | Inside Track submit | Tip + Stripe referral on stripe.com | Accepted, stored as pending | Pass |
| T21 | Inside Track safety | Referral on `stripe.com.evil.io`; email in tip | Rejected: `referral-domain`, `contact-details` | Pass |
| T22 | Moderation CLI | `insiders:pending` → `approve` → `publish` → rebuild | Note appears on /insiders and the company page; private fields never exported | Pass |
| T23 | Feedback export | `feedback:export` | CSV with all notes; formula-injection safe | Pass |
| T24 | Analytics | Page view, search, filter, Apply click, save | Events stored with anonymous id only (no IP/UA); stats dashboard renders | Pass |
| T25 | Analytics opt-out | Browser with Global Privacy Control / DNT | Nothing sent | Pass (by code path) |
| T26 | Modules | Enable `books`, build; disable, build | `/books` route + nav link appear / disappear entirely | Pass |
| T27 | Ads config | House mode (default) | House creatives; privacy page says "no ad network" | Pass |
| T28 | Privacy | `/privacy` | Matches actual data practices (analytics, forms, ads) | Pass |
| T29 | 404 | `/does-not-exist` | Friendly 404 | Pass |
| T30 | Mobile 375px | Home, /jobs, detail, /insiders/share | No horizontal scroll; menu works; Apply button prominent | Pass |
| T31 | Keyboard | Tab through header, filters, rows, Apply | Visible focus ring; skip link works | Pass |
| T32 | Pipeline: politeness | Inspect `pipeline/http.ts`, run log | robots.txt honored, ≤1 req/s/host, 429 backoff, honest UA | Pass |
| T33 | Pipeline: failure isolation | A company errors | Others unaffected; last-known jobs kept ≤24h | Pass (unit + run log) |
| T34 | Pipeline: drop guard | Published total falls >50% | Outputs not overwritten; exit code 2; deploy skipped | Pass (by code path) |

## 4. Bugs found and fixed

| ID | Severity | Found by | Bug | Fix |
|---|---|---|---|---|
| B1 | High | Pipeline run | Workday returned HTTP 429 to every request from Node's built-in `fetch` (it adds a browser CORS header Workday rejects); ~28 companies would have failed | Switched the pipeline's transport to plain `node:https` with the same honest User-Agent |
| B2 | High | Pipeline run | Workday paging stopped after page 1 (Workday only reports `total` on the first page) | Read the total from the first page only |
| B3 | High | Pipeline run | Output went to a folder literally named `Claude%20Folder` (URL-encoded path with a space) | Use `fileURLToPath` everywhere |
| B4 | Medium | Pipeline run | Rippling listed each job once per location, so duplicates were collapsed (230 published instead of ~345) | Merge Rippling rows by id |
| B5 | Medium | Pipeline run | Some company job pages refuse automated clients (403), so 123 Epic Games jobs were "inconclusive" and hidden | Fall back to the official job-board API to verify those |
| B6 | Medium | Browser | Hero headline invisible when animations don't run (bots, Lighthouse, slow devices) | Text always visible; only the decorative glow fades |
| B7 | Medium | Browser | Pages showed "0 roles" when the dev server started from the parent folder | Find the project root reliably |
| B8 | Medium | Build | Production build couldn't find `config/ads.yaml` (path relative to the output bundle) | Shared project-root helper |
| B9 | Low | Static QA | Referral URL and note fields had no accessible label | `aria-label`s added |
| B10 | Low | Static QA | Some job page titles were 80+ characters (cut off in Google) | Titles capped near 60 characters |
| B11 | Low | Lighthouse | Function chip counts were too faint (contrast) | Full-strength muted color |
| B12 | Low | Lighthouse | Job rows jumped from `<h1>` to `<h3>` (heading order) | Added section headings |
| B13 | Low | Lighthouse | Some companies' descriptions contain empty links (blank to screen readers) | Sanitizer drops empty links; re-sanitized on every publish |
| B14 | Low | Pipeline report | "Detail calls" per company counted every request in the run | Each fetcher reports its own count |
| B15 | Low | Shell edit | Stray NUL bytes in the layout file after an automated edit | Removed; scanned all files |

## 5. Known limitations (not bugs)

- **First-run coverage:** checking every new apply link at 1 request/second means Amazon's ~12k roles take more than one run to fully verify. The 6-hour schedule catches up within a day.
- **Parked companies:** Walmart, Eli Lilly, AbbVie (Workday site IDs unresolved); ServiceNow, Intuit, UNH, Linde, PMI and IBM are link-only for now. Exxon's fetcher is planned.
- **Ad network mode:** with a network switched on, only the home slot renders network ads; list and detail fall back to house ads. Add a consent banner before enabling for EU/UK.
- **Inside Track:** we can't verify that a submitter works at the company; the disclaimer and pre-moderation cover this.
- **Unused Turnstile widget** `0x4AAAAAAGCv-…` (from the first project name) can be deleted in the Cloudflare dashboard → Turnstile.
