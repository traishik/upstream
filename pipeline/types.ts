/** Shared pipeline types. */

export type SourceType =
  | 'greenhouse' | 'lever' | 'ashby' | 'workday' | 'oracle' | 'amazon'
  | 'apple' | 'tiktok' | 'amd' | 'rippling' | 'successfactors';

export interface Company {
  name: string;
  slug: string;
  tier: 'A' | 'B' | 'C';
  careersUrl: string;
  mode: 'fetch' | 'link-only';
  source?: SourceType;
  board?: string;
  host?: string;
  tenant?: string;
  site?: string;
  siteNumber?: string;
  proofUrl?: string;
  proof?: 'confirmed' | 'pending';
  logo?: string;
  enabled: boolean;
  /** Override config/pipeline.yaml → details.maxPerCompanyPerRun for slow sources. */
  maxDetailsPerRun?: number;
  notes?: string;
}

/** What a fetcher returns for one posting, before normalization. */
export interface RawJob {
  sourceId: string;
  title: string;
  locations: string[];        // human-readable, as given
  countryCodes?: string[];    // ISO-2 when the source provides it
  remote?: boolean;
  workplace?: 'onsite' | 'hybrid' | 'remote';
  team?: string;
  employmentType?: string;    // raw text, e.g. "Full time", "FULL_TIME"
  postedAt?: string;          // ISO
  applyUrl: string;
  sourceUrl: string;
  descriptionHtml?: string;   // raw (unsanitized) when provided by the list call
  salary?: { min?: number; max?: number; currency?: string; period?: string; text?: string };
  /** Extra source facts that help classification (department, category, job family…). */
  hints?: string[];
}

export interface FetchContext {
  company: Company;
  http: import('./http.ts').Http;
  log: (msg: string) => void;
  /** Budget for detail fetches this run (details for new jobs come first). */
  detailBudget: number;
  /** IDs we already hold a description for; fetchers can skip their detail calls. */
  haveDescription: Set<string>;
}

export interface Fetcher {
  /** Return every current US-relevant posting (filtering to US may also happen in the normalizer). */
  list(ctx: FetchContext): Promise<RawJob[]>;
  /** Fill descriptionHtml (and anything else) for jobs that need it. Mutates the jobs. */
  details?(ctx: FetchContext, jobs: RawJob[]): Promise<number | void>;  // returns detail calls made
}

export type Level =
  | 'internship' | 'new-grad' | 'mid' | 'senior' | 'staff' | 'manager'
  | 'senior-manager' | 'director' | 'vp';

export type EmploymentType = 'full-time' | 'part-time' | 'internship' | 'contract';

/** The normalized, published job (section 4.5 of the brief). */
export interface Job {
  id: string;
  company: string;      // slug
  title: string;
  function: string;     // function id from config/classifier.yaml
  level: Level;
  employmentType: EmploymentType;
  isFrontline: boolean;
  locations: string[];
  workplace: 'onsite' | 'hybrid' | 'remote';
  team?: string;
  postedAt?: string;
  firstSeenAt: string;
  lastVerifiedAt: string;
  applyUrl: string;
  sourceUrl: string;
  descriptionHtml?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; period?: string; text?: string };
}
