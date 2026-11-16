# Phase 0 — Source discovery, volume estimate, data architecture

Run: Saturday 2026-11-14, ~01:30–03:00 PT. Every check used plain HTTP with an honest User-Agent
(`Upstream-discovery/0.1 …`), ≤1 req/s per host, plus a normal in-app browser view for JS-only pages.
No blocks were bypassed. Raw probe output lives in the session scratchpad; nothing here is from memory.

## Headline findings

1. **About 80k US listings are fetchable. After excluding frontline roles, expect ~55–65k live roles on the site.** That's larger than first guessed, so the data architecture below is built for 100k.
2. **Workday was down for weekend maintenance during this run.** Every `wd1`/`wd5` tenant redirected to a maintenance page (only Salesforce on `wd12` answered). About 30 companies depend on Workday, so their counts below are **estimates, marked `est.`**, and their tenant/site IDs must be re-confirmed on a weekday. This also tells us something about the product: Workday goes dark on weekends, so the 24h grace window for failed fetches matters.
3. **Eightfold-hosted careers sites forbid all crawlers** (`User-agent: * / Disallow: /`) while allow-listing named job aggregators. That rules out Microsoft, Micron, Qualcomm, Netflix, Applied Materials and Lam. Google's robots.txt also disallows its job results, and Goldman's careers host disallows everything. These become **link-only**.
4. **Several careers sites block non-browser clients** (HTTP 403 from Akamai and similar): Tesla, Intel, J&J, Caterpillar, Wells Fargo, ServiceNow, PayPal, DoorDash, xAI, OpenAI landing pages. Where the company's **Workday tenant** is reachable and its robots.txt allows it (`/wday/cxs/` is not disallowed), we can still fetch. The proof link then has to be confirmed by looking at the careers page in a normal browser, once, by hand. Tesla blocks even its robots.txt, so we skip it.
5. **Greenhouse/Ashby/Lever boards are the easy, reliable core:** 32 companies, ~11.8k US jobs, with documented public APIs and no robots restrictions on the API hosts. Most of them set their job URLs to the company's own domain (`stripe.com/jobs/search?gh_jid=…`), which is the strongest possible proof.

## Source table

Legend. **Reliability:** High = documented public JSON API; Med = the careers site's own undocumented JSON or server-rendered HTML; Low = fragile or partial. **Rec:** fetch / link-only (company page on Upstream with a "Browse on their site" link and no listings) / skip.
**Proof:** ✅ confirmed (careers page links to the board, or the board's job URLs are on the company domain) · ⏳ pending (JS page or 403, to confirm in the browser during Phase 2/6).
FL = estimated frontline/hourly share.

### Tier A — S&P top 50

| Company | Source | Endpoint / ID | Proof | US jobs | FL | Rel. | robots / ToS notes | Rec |
|---|---|---|---|---|---|---|---|---|
| NVIDIA | Workday | `nvidia.wd5` / `NVIDIAExternalCareerSite` | ⏳ | ~2,000 est. | <5% | High* | careers page loads its own search widget; Workday API not disallowed | fetch |
| Alphabet (Google) | Google Careers | google.com/about/careers | — | ~3,000 est. | <5% | — | **robots disallows `/about/careers/applications/jobs/results`** | link-only |
| Apple | jobs.apple.com (server-rendered JSON) | `search?location=united-states-USA&page=N`, 20/page | ✅ own domain | **4,566** | ~35% (Retail Specialist etc.) | Med | no robots.txt published; read Apple site terms before Phase 6 | fetch (Phase 6) |
| Microsoft | Eightfold | apply.careers.microsoft.com | — | ~3,000 est. | <5% | — | **robots `Disallow: /`** | link-only |
| Amazon | amazon.jobs JSON | `/en/search.json` (description included) | ✅ own domain | **≥10,000** (API caps `hits` at 10k; true US likely 15–25k) | ~20% | High | only `/internal` disallowed | fetch, split queries by category to get past the 10k cap |
| Broadcom | Workday | `broadcom.wd1` / site TBC | ⏳ | ~500 est. | <5% | High* | | fetch |
| Tesla | own | tesla.com/careers | — | ~3,000 est. | ~50% | — | **403 on every request, including robots.txt** | skip (link-only card) |
| Meta | own (GraphQL) | metacareers.com | — | ~2,000 est. | <5% | — | `/ajax/` disallowed; Meta's terms prohibit automated collection | link-only |
| Walmart | Workday | `walmart.wd5` (site name TBC) | ⏳ | ~3,000 corp. est. + very large hourly | ~85% | Med | **careers.walmart.com disallows `/api` and `/results`**. The Workday host is separate and allowed, but this goes against the spirit of their rules. Your call. | ask you |
| Berkshire Hathaway | — | holding company | — | — | — | — | no single careers page | `enabled: false` |
| Eli Lilly | Phenom → Workday | careers.lilly.com; `lilly.wd5` (site TBC) | ⏳ | ~1,000 est. | ~10% | High* | Phenom robots only blocks apply/chat paths | fetch |
| JPMorgan Chase | Oracle HCM | `jpmc.fa.oraclecloud.com` / `CX_1001` | ✅ linked from jpmorganchase.com/careers | **5,194 global**, ~3,100 US est. | ~25% (branch) | High | public HCM REST API | fetch |
| Micron | Eightfold | micron.eightfold.ai | — | ~800 est. | ~20% | — | **`Disallow: /`** | link-only |
| AMD | iCIMS via Jibe | `careers.amd.com/api/jobs?country=United States` | ✅ own domain | **730** | <5% | High | no disallow rules | fetch |
| Exxon Mobil | SuccessFactors (server-rendered HTML) | `jobs.exxonmobil.com/search/` | ✅ own domain | **176** | ~20% | Med | apply/services paths disallowed (we don't touch them) | fetch |
| Visa | Workday | `visa.wd5` (TBC) | ⏳ | ~600 est. | <5% | High* | careers page redirected to Workday maintenance (confirms Workday) | fetch |
| Intel | Workday | `intel.wd1` / `External` (TBC) | ⏳ (careers site 403) | ~1,000 est. | ~10% | High* | jobs.intel.com blocks bots; proof by hand | fetch if proof OK |
| Johnson & Johnson | Workday | `jj.wd5` (TBC) | ⏳ (403) | ~1,500 est. | ~10% | High* | careers site blocks bots | fetch if proof OK |
| Oracle | Oracle HCM | `eeho.fa.us2.oraclecloud.com` / `CX_45001` | ✅ | **2,858 global**, ~1,200 US est. | <5% | High | | fetch |
| Costco | own (costco.com) | TBC | ⏳ | mostly hourly | ~95% | Low | heavy bot protection on costco.com | link-only for now |
| Cisco | Phenom → Workday | careers.cisco.com; `cisco.wd5` (TBC) | ⏳ | ~1,000 est. | <5% | High* | | fetch |
| Mastercard | Phenom → Workday | `mastercard.wd1` / `CorporateCareers` | ✅ (linked on careers page) | ~500 est. | <5% | High* | | fetch |
| Caterpillar | Workday | `cat.wd5` (TBC) | ⏳ (403) | ~1,000 est. | ~40% | High* | careers site blocks bots | fetch if proof OK |
| Chevron | Radancy + Eightfold | careers.chevron.com | ⏳ | ~300 est. | ~20% | Low | `/search-jobs/` disallowed; Eightfold disallowed | link-only unless a Workday tenant is confirmed |
| AbbVie | own (Phenom-like) | careers.abbvie.com | ⏳ | ~800 est. | ~10% | Med | `/jobs?*` disallowed. That's the listing query, so we'd need a Workday tenant | TBC |
| Netflix | Eightfold | explore.jobs.netflix.net | — | ~400 est. | <5% | — | **`Disallow: /`** | link-only |
| Bank of America | Avature + Workday | `ghr.wd1` / `Lateral-US` (seen on careers page) | ✅ | ~2,000 est. | ~40% (tellers, branches) | High* | | fetch |
| Lam Research | Eightfold | careers.lamresearch.com | — | ~600 est. | ~20% | — | **`Disallow: /`** | link-only |
| UnitedHealth Group | Radancy/Phenom | careers.unitedhealthgroup.com | ⏳ | ~5,000 est. | ~40% (clinical/hourly) | Low | `/search-jobs/` disallowed | link-only unless a Workday tenant is confirmed |
| Coca-Cola | Workday | `coke.wd1` (site TBC) | ⏳ | ~400 est. | ~40% | High* | careers page redirected to Workday maintenance | fetch |
| Applied Materials | Eightfold | careers.appliedmaterials.com | — | ~1,000 est. | ~15% | — | **`Disallow: /`** | link-only |
| Procter & Gamble | Phenom → Workday | `pg.wd5` (TBC) | ⏳ | ~600 est. | ~30% | High* | | fetch |
| Palantir | Lever | `palantir` | ✅ | **237** | 0 | High | | fetch |
| Morgan Stanley | own | morganstanley.com/careers (404 on /careers/) | ⏳ | ~1,000 est. | ~10% | Low | TBC | investigate |
| GE Aerospace | Phenom → Workday | `geaerospace.wd5` (TBC) | ⏳ | ~1,500 est. | ~35% | High* | | fetch |
| Home Depot | Workday | `homedepot.wd5` / `CareerDepot` (seen on careers page) | ✅ | ~1,500 corp. est. + large hourly | ~85% | High* | | fetch (most rows will be frontline) |
| Goldman Sachs | own (higher.gs.com) | higher.gs.com | — | ~800 est. | <5% | — | **`Disallow: /`** | link-only |
| Philip Morris Intl. | Phenom | pmi.com/careers | ⏳ | ~200 est. | ~20% | Low | | investigate |
| Merck | Phenom → Workday | `msd.wd5` / `SearchJobs` (seen on careers page) | ✅ | ~800 est. | ~10% | High* | | fetch |
| Texas Instruments | Oracle HCM | `edbz.fa.us2.oraclecloud.com` / `CX` | ✅ | **915 global**, ~550 US est. | ~30% (fab techs) | High | | fetch |
| GE Vernova | Workday | `gevernova.wd5` / `Vernova_ExternalSite` | ✅ (job links on careers page) | ~1,500 est. | ~35% | High* | | fetch |
| KLA | Workday (TBC) | kla.com (JS bot challenge) | ⏳ | ~400 est. | ~10% | Low | JS challenge on kla.com | proof by hand, then fetch |
| RTX | Phenom → Workday | `globalhr.wd5` (TBC) | ⏳ | ~3,000 est. | ~25% | High* | | fetch |
| Linde | Workday (TBC) | linde.com/careers (404) | ⏳ | ~500 est. | ~40% | Low | | investigate |
| Wells Fargo | Workday (TBC) | wellsfargojobs.com (403) | ⏳ | ~2,000 est. | ~40% | High* | careers site blocks bots | fetch if proof OK |
| Qualcomm | Eightfold | careers.qualcomm.com | — | ~1,000 est. | <5% | — | **`Disallow: /`** | link-only |
| Citigroup | Eightfold + Workday | `citi.wd5` (seen on jobs.citi.com) | ✅ | ~2,500 est. | ~20% | High* | Eightfold disallowed, Workday allowed | fetch via Workday |
| American Express | Oracle HCM | `egug.fa.us2.oraclecloud.com` / `CX_1` | ✅ | **312 global**, ~200 US est. | ~20% | High | | fetch |
| IBM | own search API | `www-api.ibm.com/search/api/v2` → careers.ibm.com | ✅ own domain | ~1,000 est. | <5% | Med | no rules on www-api; careers.ibm.com only blocks tracking params | fetch (Phase 6) |

\* High once the Workday tenant/site ID is confirmed on a weekday.

### Tier B — top tech

| Company | Source | Endpoint / ID | Proof | US jobs | FL | Rel. | Notes | Rec |
|---|---|---|---|---|---|---|---|---|
| Salesforce | Workday | `salesforce.wd12` / `External_Career_Site` | ✅ | **1,612 global**, ~900 US est. | 0 | High | the only Workday tenant that answered today | fetch |
| Adobe | Phenom → Workday | `adobe.wd5` (TBC) | ⏳ | ~800 est. | 0 | High* | | fetch |
| Uber | own | uber.com/careers | — | ~800 est. | 0 | — | **`*/api/` disallowed, 406 to bots** | link-only |
| Airbnb | Greenhouse | `airbnb` | ✅ (URLs on careers.airbnb.com) | ~150 | 0 | High | | fetch |
| Snowflake | Ashby | `snowflake` | ⏳ | **271** | 0 | High | | fetch |
| ServiceNow | Workday (TBC) | careers.servicenow.com (403) | ⏳ | ~800 est. | 0 | High* | | fetch if proof OK |
| Workday | Workday | `workday.wd5` / `Workday` | ✅ | ~600 est. | 0 | High* | | fetch |
| Intuit | Radancy → Workday (TBC) | jobs.intuit.com | ⏳ | ~500 est. | ~10% | High* | `/search-jobs/` disallowed; use Workday | fetch |
| PayPal | Workday (TBC) | careers.pypl.com (403) | ⏳ | ~400 est. | 0 | High* | | fetch if proof OK |
| Block | Greenhouse | `block` | ✅ (URLs on block.xyz) | **159** | 0 | High | | fetch |
| Pinterest | Greenhouse | `pinterest` | ✅ (pinterestcareers.com) | **155** | 0 | High | | fetch |
| Snap | careers.snap.com JSON | `/api/jobs` (all jobs in one call) | ✅ own domain | **151** | 0 | Med | no robots rules | fetch |
| DoorDash | Greenhouse | `doordashusa` | ⏳ (careers site 403) | **425** | ~5% | High | | fetch |
| Lyft | Greenhouse | `lyft` | ⏳ | **77** | 0 | High | job URLs point at app.careerpuck.com. Apply must go to the Greenhouse posting instead | fetch |
| Coinbase | Greenhouse | `coinbase` | ✅ | **238** | 0 | High | | fetch |
| Robinhood | Greenhouse | `robinhood` | ✅ | **143** | 0 | High | | fetch |
| Dropbox | Greenhouse | `dropbox` | ✅ | **44** | 0 | High | | fetch |
| CrowdStrike | Workday | `crowdstrike.wd5` / `crowdstrikecareers` | ✅ | ~600 est. | 0 | High* | | fetch |
| Palo Alto Networks | Workday | `paloaltonetworks.wd5` (site TBC) | ✅ | ~700 est. | 0 | High* | | fetch |
| Datadog | Greenhouse | `datadog` | ✅ | **235** | 0 | High | | fetch |
| Cloudflare | Greenhouse | `cloudflare` | ✅ (browser) | ~300 (479 global) | 0 | High | location field says "Hybrid"; US comes from `offices` | fetch |
| MongoDB | Greenhouse | `mongodb` | ✅ | **105** | 0 | High | | fetch |
| Reddit | Greenhouse | `reddit` | ✅ | **138** | 0 | High | | fetch |
| Roblox | Greenhouse | `roblox` | ✅ | **251** | 0 | High | | fetch |
| Figma | Greenhouse | `figma` | ✅ | **94** | 0 | High | | fetch |
| Instacart | Greenhouse | `instacart` | ✅ | **83** | 0 | High | | fetch |
| Zoom | Workday (TBC) | careers.zoom.us | ⏳ | ~200 est. | 0 | High* | | fetch |

### Tier C — leading private

| Company | Source | Endpoint / ID | Proof | US jobs | FL | Rel. | Notes | Rec |
|---|---|---|---|---|---|---|---|---|
| TikTok | lifeattiktok.com JSON | `api.lifeattiktok.com/.../search/job/posts` | ✅ own domain | ~1,500 est. (4,265 global) | <5% | Med | no robots rules on API host | fetch |
| OpenAI | Ashby | `openai` | ✅ (browser) | **705** | 0 | High | | fetch |
| Anthropic | Greenhouse | `anthropic` | ✅ | **596** | 0 | High | | fetch |
| Stripe | Greenhouse | `stripe` | ✅ | **342** | 0 | High | | fetch |
| Databricks | Greenhouse | `databricks` | ✅ | **400** | 0 | High | | fetch |
| SpaceX | Greenhouse | `spacex` | ✅ (browser) | **2,746** | ~40% (technicians) | High | | fetch |
| Anduril | Greenhouse | `andurilindustries` | ⏳ | **2,546** | ~25% | High | | fetch |
| Scale AI | Greenhouse | `scaleai` | ⏳ | **143** | 0 | High | | fetch |
| Ramp | Ashby | `ramp` | ✅ | **180** | 0 | High | an old Greenhouse board still has 1 stale job. Ignore it | fetch |
| Rippling | Rippling ATS | `ats.rippling.com/api/v2/board/rippling/jobs` | ⏳ | **345** | 0 | High | only `/internal/` disallowed | fetch |
| xAI | Greenhouse | `xai` | ⏳ (x.ai 403) | **274** | ~10% | High | | fetch |
| Perplexity | Ashby | `perplexity` | ⏳ | **121** | 0 | High | | fetch |
| Plaid | Ashby | `plaid` | ⏳ | **133** | 0 | High | | fetch |
| Notion | Ashby | `notion` | ✅ | **80** | 0 | High | | fetch |
| Discord | Greenhouse | `discord` | ⏳ | **26** | 0 | High | | fetch |
| Epic Games | Greenhouse | `epicgames` | ✅ | **57** | 0 | High | | fetch |

**Scorecard:** 91 enabled candidates →
- **~70 fetch**: 32 on Greenhouse/Ashby/Lever/Rippling, ~28 on Workday, 4 on Oracle HCM, ~7 on companies' own JSON or HTML
- **~13 link-only or skip**: Google, Microsoft, Meta, Tesla, Netflix, Micron, Qualcomm, Applied Materials, Lam, Goldman, Uber, Costco, plus Chevron/UNH unless a Workday tenant turns up
- **~5 to investigate**: Morgan Stanley, PMI, Linde, AbbVie, KLA

## Volume estimate

| Bucket | US jobs (all) | after `includeFrontline: false` |
|---|---|---|
| Greenhouse/Ashby/Lever/Rippling (measured) | ~11,800 | ~10,000 |
| Amazon, Apple, Oracle HCM ×4, AMD, Exxon, Snap, TikTok, IBM, Salesforce (mostly measured) | ~29,000 | ~23,000 |
| Workday tenants (estimated, confirm on a weekday) | ~39,000 + large hourly at Walmart/Home Depot | ~28,000 |
| **Total** | **~80,000** | **~55,000–65,000** |

- **Description size** (measured on Stripe, Anthropic, Airbnb, SpaceX; Amazon ~3 KB, AMD ~13 KB): about **7 KB average** raw HTML, ~5 KB after sanitizing.
- **Total description data:** 60k × 5 KB ≈ **300 MB raw**, about 70 MB gzipped on the wire. That's far too big to commit to git every 6 hours, which confirms that decision.
- **Listing index** (no descriptions, ~150 B/job): 60k ≈ 9 MB raw, ~1.8 MB gzipped. That's just over the 1.5 MB up-front budget, so it has to be split.

### Pipeline cost per run (polite, 1 req/s per host)
- Listing fetches: Amazon ~250 calls, Apple ~230, Workday ~20 calls × 28 tenants (all on different hosts, so they run in parallel). Wall time ~5 minutes.
- Liveness checks: re-checking 60k jobs every 48h ≈ 7.5k per run. The biggest single host (Amazon, ~2.5k per run) takes ~45 min. That fits inside the 6h Actions job limit with lots of room, but it's the slowest part, so we cap per-host checks per run.

## Data architecture decision

Design target: **100k jobs** (headroom over the ~60k estimate).

1. **Listing index, split by function.** 18 function files (`/data/idx/<function>.json`, compact arrays) plus a `manifest.json` with counts, facets, `lastRefreshed` and the newest ~300 roles for the home page and the default /jobs view.
   - First load = manifest + the newest-roles slice ≈ **60–120 KB gz**.
   - Choosing a function loads that one file (biggest, Software Engineering, ~300–450 KB gz).
   - Free-text search across *all* functions streams the remaining files in the background on the first keystroke (~2 MB gz total, cached), and searches the newest slice instantly in the meantime.
   - In-browser search: MiniSearch over title + company + location.
2. **Descriptions in shards.** Each job's id-hash prefix maps it to one of 256 shard files (`/data/desc/ab.json`, ~250 jobs, ~1.2 MB raw / ~250 KB gz each). The detail page fetches exactly one shard. Hash bucketing keeps shards stable between runs, so Cloudflare re-uploads only the shards that changed.
3. **One detail route.** `/jobs/<id>/` is a Cloudflare `_redirects` rewrite (200) to a single detail page, so every job gets a clean, shareable URL.
4. **SEO pre-render:** the newest **5,000** job pages as static HTML.
   - File count ≈ 5,000 + 256 + 18 + ~500 assets/logos ≈ **6k of the 20k limit**.
   - Every file is far below 25 MB.
   - Tradeoff: older jobs are found by search engines only through the sitemap plus a client-rendered page. More pre-rendering would raise build and upload time without much SEO benefit for listings that change daily.
5. **Why not Pagefind:** its fragment-per-page model spends the file budget, and its faceting is weaker than the structured filters /jobs needs.
6. **State between runs:** the Actions cache holds `state.json` (~10–15 MB: firstSeenAt, lastVerifiedAt and content hash per job, plus last-known jobs for the 24h grace). If the cache is evicted, the pipeline rebuilds from the live site's own `/data` files. The repo gets only `data/run-report.json` and a small counts summary (keep-alive).

## What's working, what's fragile, what I'd cut

- **Working:** Greenhouse/Ashby/Lever/Rippling (32 companies), Amazon, AMD, Oracle HCM (4), Snap, TikTok, Salesforce. That's ~40 companies on solid, allowed JSON today.
- **Fragile:**
  - Workday site IDs are unconfirmed. Workday also has a weekend maintenance window.
  - Apple, IBM and Exxon depend on parsing HTML or an undocumented API.
  - Amazon's 10k cap means queries must be partitioned.
  - "Proof" is still pending for ~25 companies whose careers pages are JavaScript-only or return 403. I'll confirm those once each in the browser.
- **I'd cut:**
  - Costco, Walmart (unless you OK the robots question) and the link-only set from v1 fetching
  - Running the generic HTML "no longer accepting" check on JavaScript-app pages, since it can't work there. Feed membership + the source's own per-job endpoint is the real liveness signal.

## Decisions I need from you

1. **Walmart:** careers.walmart.com disallows `/api` and `/results`, but its Workday tenant is a separate, allowed host. Fetch from Workday, or make it link-only?
2. **Link-only companies:** OK to show them on /companies with a "Browse on their site →" card and no listings? It's honest, and the brand still shows up.
3. **Apple & IBM** (Med reliability, own-site data): OK to include in Phase 2, or hold for Phase 6?
4. **Blocked careers sites with an allowed Workday tenant** (Intel, J&J, Caterpillar, Wells Fargo, ServiceNow, PayPal): OK to fetch from Workday once I've confirmed the proof link by viewing their careers page in a normal browser?

## Decisions (Traishik, 2026-11-14)

1. **Walmart:** fetch from its Workday tenant.
2. **Link-only companies:** show them on /companies with a "Browse on their site" card. Copy: positive, "we keep knocking" tone (see /styleguide).
3. **Apple & IBM:** include them in Phase 2.
4. **Blocked careers sites with an allowed Workday tenant** (Intel, J&J, Caterpillar, Wells Fargo, ServiceNow, PayPal): fetch from Workday after confirming proof by hand.

Standing rule: **whenever a source allows it, fetch the full job details** (description, metadata). Don't settle for list-only data.
