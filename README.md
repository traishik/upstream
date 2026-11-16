# Upstream

Jobs straight from company career pages. Every listing comes from the company's own careers site (or the hiring system that site uses), is checked to be live, and links straight to the official posting.

> **Live:** https://upstreamjobs.pages.dev · **Code:** https://github.com/traishik/upstream · Refreshes every 6 hours via GitHub Actions.
> Owner's guide (costs, analytics, SEO, positioning): `docs/owner-guide.md` · QA report: `docs/qa-report.md`.

## Quick start

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # Node 24 lives here on this Mac
npm install
npm run pipeline        # fetch + verify jobs → public/data (takes 1–3h the first time; polite 1 req/s per site)
npm run dev             # http://localhost:4321
```

Other commands:

| Command | What it does |
|---|---|
| `npm run pipeline -- --only=stripe,openai` | Refresh just these companies |
| `npm run pipeline -- --skip-liveness` | Fetch without checking apply links (nothing new gets published) |
| `npm test` | Classifier (124 titles), normalizer, sanitizer and liveness tests |
| `npm run check` | Type-check |
| `npm run contrast` | WCAG AA check of every color pair in both themes |
| `npm run tier-a-diff -- list.txt` | Compare a pasted S&P top-50 list with Tier A |

## Where things live

| Path | What |
|---|---|
| `config/companies.yaml` | Company registry. One line per company; `enabled: false` hides it; `denylist` honors removal requests |
| `config/pipeline.yaml` | Cadence, `includeFrontline`, politeness limits, grace window, drop guard, liveness budget |
| `config/classifier.yaml` | Function / level / employment / frontline rules (regex lists, no code) |
| `config/liveness.yaml` | "Job closed" text patterns and redirect rules |
| `pipeline/` | Fetchers (one per source type), normalizer, classifier, liveness, run orchestration |
| `public/data/` | Generated: `manifest.json`, `idx/<function>.json` (listings), `desc/<xx>.json` (full jobs, 256 shards) |
| `data/run-report.json` | Per-company results of the last run. Rendered at `/status` |
| `content/` | Editable copy (`copy.ts`) and About page (`about.md`) |
| `src/` | Astro site. React islands only for the board, detail loader, saved list and save button |

## Adding a company

Usually one line in `config/companies.yaml`, if it uses a supported source (Greenhouse, Lever, Ashby, Workday, Oracle HCM, Rippling):

```yaml
- { name: Acme, slug: acme, tier: B, careersUrl: "https://acme.com/careers", mode: fetch, source: greenhouse, board: acme, proofUrl: "https://acme.com/careers", proof: confirmed, enabled: true }
```

Before enabling it: confirm the company's own careers page links to that exact board (`proofUrl`), and check its robots.txt and terms. If a company doesn't allow automated access, use `mode: link-only`.

## Toggling frontline / hourly roles

Set `includeFrontline: true` in `config/pipeline.yaml` and run the pipeline. A "Frontline & hourly" filter appears on /jobs automatically.

## Pipeline guarantees

- Honest User-Agent (`UpstreamBot`), robots.txt checked before every request, ≤ 1 request/second per host, exponential backoff on 429/5xx. No proxies, no CAPTCHA solving, no headless browsers.
- A job is published only if it's in the company's latest feed **and** its apply link passed a check in the last 48h (page check, or the official per-job API for JavaScript-only career sites).
- A failing company keeps its last-known jobs for 24h, then they're dropped. One broken company never breaks the run.
- If the published total falls more than 50% from the last run, outputs aren't overwritten and the report says why (exit code 2, so the deploy step can skip).
- Salary is shown only when the posting states it. Never estimated.
- Descriptions belong to the companies: sanitized with an allowlist, credited, and linked to the original.

## Modules: turning sections on and off

Every section is a module under `src/modules/<id>/`. The registry is `site.config.ts`:

```ts
{ id: 'books', enabled: false, navLabel: 'Books', navOrder: 6, homepageWidget: true }
```

Flip `enabled` and rebuild. A disabled module produces **no routes, no nav item and no bundle weight**, because its pages are only injected into the build when it's on (see `upstreamModules()` in `astro.config.mjs`).

**Adding a new module** (example: `events`):

1. Create `src/modules/events/pages/index.astro`:
   ```astro
   ---
   import Base from '@/layouts/Base.astro';
   ---
   <Base title="Events"><section class="mx-auto max-w-4xl px-4 py-16"><h1>Events</h1></section></Base>
   ```
2. Optional homepage widget: `src/modules/events/widget.astro`.
3. Register its routes in `src/modules/index.ts`:
   ```ts
   events: { routes: [{ pattern: '/events', entrypoint: 'pages/index.astro' }], widget: 'widget.astro' },
   ```
4. Add it to `site.config.ts` (and to the `ModuleId` type): `{ id: 'events', enabled: true, navLabel: 'Events', navOrder: 6, homepageWidget: true }`.

`projects`, `books` and `resources` are scaffolded and disabled. Add Markdown files to `content/<id>/` and switch them on.

## Cloudflare setup (one time)

You need a free Cloudflare account. Everything below fits the free plan.

```bash
npx wrangler login
npx wrangler d1 create upstream                 # copy the database_id into wrangler.toml
npm run db:migrate                              # creates the feedback + insider_notes tables
npx wrangler pages project create upstreamjobs --production-branch main
```

**Turnstile (spam check):** Cloudflare dashboard → Turnstile → Add widget for `upstreamjobs.pages.dev` (and your custom domain later).
- Site key (public): put it in Pages → Settings → Environment variables as `PUBLIC_TURNSTILE_SITE_KEY` for builds. In GitHub Actions it's a repository variable.
- Secret: `npx wrangler pages secret put TURNSTILE_SECRET --project-name upstreamjobs`.
- Until then the site uses Cloudflare's documented **test** keys, which always pass. Fine locally, not in production.

**Rate limiting:** the free plan includes one WAF rate-limiting rule. Add it for `/api/*` (e.g. 5 requests per 10 seconds). The functions also honor an optional `RATE_LIMITER` binding.

**GitHub secrets** (for the Phase 5 workflow): `CLOUDFLARE_API_TOKEN` (Pages:Edit + D1:Edit) and `CLOUDFLARE_ACCOUNT_ID`.

**Local end-to-end test** (functions + local D1):

```bash
cp .dev.vars.example .dev.vars      # Cloudflare's test Turnstile secret
npm run db:migrate:local
npm run pages:dev                   # http://localhost:8788
```

## Feedback and Inside Track moderation

There's no admin web page, so there's no admin password to leak. You manage everything from your terminal through your own `wrangler` login:

| Command | Does |
|---|---|
| `npm run admin -- feedback:list` | Latest 25 notes |
| `npm run admin -- feedback:export` | CSV to `exports/` (git-ignored; may contain emails) |
| `npm run admin -- insiders:pending` | Tips/referrals waiting for review, plus reported ones |
| `npm run admin -- insiders:approve <id>` · `reject` · `remove` | Moderate |
| `npm run admin -- insiders:publish` | Writes approved notes (public fields only) to `content/insiders.json`. Commit it, and the next build shows them |

Add `--local` to any command to use the local dev database. "You asked, we shipped" lives in `content/changelog.md`.

## Ads

Everything is in `config/ads.yaml`:
- **house** (default): promotes our own pages.
- **direct**: add a sponsor with `start`/`end` dates and `placements`. It wins over everything else while active.
- **network**: set `enabled: true`, `client` and per-placement slot ids **only after the network approves the site**. The script is lazy-loaded when a slot nears the screen. The privacy page switches to the network/cookie wording automatically. If you enable it for EU/UK visitors, add a consent banner first (AdSense requires a certified CMP there).

Ads never appear between a reader and an Apply button.

## Tracking performance

- **Visitors, unique users and clicks:** `npm run admin -- stats` (terminal) or `npm run admin -- stats:report` (an HTML dashboard in `exports/`). Data is first-party and anonymous; see `/privacy`.
- **Traffic sources and page speed (optional):** Cloudflare dashboard → Workers & Pages → upstreamjobs → Metrics → enable **Web Analytics** (free, cookie-free).
- **Google:** verify the site in [Search Console](https://search.google.com/search-console). Use the HTML-tag method: set `PUBLIC_GOOGLE_SITE_VERIFICATION` as a GitHub Actions variable (or in `.env`), rebuild, then submit `https://upstreamjobs.pages.dev/sitemap-index.xml`.

## Deploying by hand

```bash
npm run build && npm run qa
npx wrangler pages deploy dist --project-name upstreamjobs --branch main
```

GitHub Actions does this automatically after every 6-hour refresh (`.github/workflows/refresh.yml`). Change the schedule there and in `config/pipeline.yaml → cadence`.
