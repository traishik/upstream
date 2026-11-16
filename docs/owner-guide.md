# Owner's guide

For Traishik. Plain answers on running Upstream: what it costs, how to watch it, and how to grow it. Written 2026-11-16.

## What's live

| | |
|---|---|
| Website | https://upstreamjobs.pages.dev |
| Code | https://github.com/traishik/upstream (public) |
| Job refresh | Every 6 hours (GitHub Actions → Cloudflare Pages) |
| Status page (unlisted) | https://upstreamjobs.pages.dev/status |

## Costs: $0 today

| Service | Free allowance | Our use |
|---|---|---|
| Cloudflare Pages | Unlimited static traffic; direct uploads don't use the 500 builds/month quota | ~300 files per deploy, 4 deploys/day |
| Pages Functions | 100,000 requests/day | Forms + analytics beacons |
| Cloudflare D1 | 5 GB storage, 100,000 writes/day, 5M reads/day | 1 write per page view or tracked click |
| Turnstile | Free | Spam check on forms |
| GitHub Actions | Free for public repos | ~4 runs/day, up to ~5 h each |

**When you'd pay:**
- **A custom domain**, recommended once you commit: about $10–12 a year at cost from Cloudflare Registrar (for example `upstream.jobs` or `getupstream.com`). Cloudflare → Workers & Pages → upstreamjobs → Custom domains. Then change `site.url` in `site.config.ts`.
- **Workers Paid ($5/month)**, only if you pass ~100k tracked events per day (roughly 30–50k daily visitors). That's a great problem to have.

## Tracking visitors and clicks

```bash
npm run admin -- stats                 # last 30 days in the terminal
npm run admin -- stats --days=7
npm run admin -- stats:report          # pretty HTML dashboard → exports/stats-<date>.html
```

You'll see:
- unique visitors, visits and page views
- Apply clicks per company, plus "applies per 100 visitors" (the number that matters most)
- top searches, filters used, saves, link-only careers clicks
- Inside Track and feedback submissions, where visitors come from, mobile vs desktop

For traffic sources and page speed in a dashboard, turn on Cloudflare Web Analytics (free, one click): Cloudflare → Workers & Pages → upstreamjobs → Metrics → Web Analytics.

**What to watch weekly:**
1. Unique visitors (growth)
2. Applies per 100 visitors (is the list useful?)
3. Top searches with few results (companies or roles to add)
4. Returning visitors (are people coming back?)

## Google: realistic expectations

- Nobody can promise a ranking. A new site starts with almost no authority.
- **Broad searches** ("software engineer jobs") are owned by Indeed, LinkedIn and Glassdoor. Don't chase them.
- **Specific searches** ("Anthropic research engineer jobs", "Stripe new grad 2027", "Palantir jobs Denver") are winnable within weeks to months. Every job and company page is built for this: clean titles, descriptions, JobPosting structured data and a sitemap.
- **Google's job search panel** groups duplicates and usually favors the employer's own posting. We'll often sit behind it, and that's fine.
- **Do this once:** verify the site in Google Search Console and submit the sitemap (README → "Tracking performance").
- **Growth will come from people first:**
  - LinkedIn posts about your story and the ghost-job radar
  - r/cscareerquestions and r/jobs, without spamming
  - career-center newsletters at your alma mater
  - Inside Track contributors sharing their own notes

## Competition and what makes Upstream different

There are hundreds of job boards and a few dozen "straight from career pages" sites:
- HiringCafe: the closest and biggest
- Google for Jobs
- Detoxify and Scoutify
- AI tools like Simplify and Jobright
- "verified job" boards like Jobicy

So sourcing alone isn't unique. Upstream's combination is:

1. **Verified-live receipts.** Every role shows when its apply link was last checked and which official site it came from. The status page is public, and closed roles disappear within hours.
2. **Ghost-job radar.** "Open for N days" on every role from the company's own posted date. Roles open 60+ days are flagged, with a filter to hide them, and each company page shows its share of long-open roles. Estimates put ghost listings at roughly 1 in 7 to 1 in 5 US postings.
3. **Inside Track.** Tips and referral links from people who work there, locked to the company's official job board and reviewed by you. A listing becomes a way in.
4. **Calm by design.** No account, no dark patterns, no tracking cookies, built by a job seeker.

**One-line positioning:** *Real roles, verified live, with a way in.*

Ideas that would deepen the moat later:
- weekly "ghost-job radar" posts with company-level data, which journalists love
- email alerts for saved searches
- a "Recently closed" counter per company

## Your weekly routine (about 15 minutes)

```bash
cd ~/"Claude Folder"/upstream && export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"
git pull                                   # get the latest run reports
npm run admin -- insiders:pending          # review new Inside Track notes
npm run admin -- insiders:approve <id>     # …or reject
npm run admin -- insiders:publish && git commit -am "Publish Inside Track notes" && git push
npm run admin -- feedback:list             # read feedback; add shipped ideas to content/changelog.md
npm run admin -- stats                     # how it's going
```

Check `/status` occasionally. If a company shows `error` for more than a day, its careers site probably changed. That's a small config or fetcher fix.
