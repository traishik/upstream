/**
 * Site-wide configuration. One source of truth for names, copy hooks and the module registry.
 * Change a value here; nothing else needs to move.
 */
export const site = {
  name: 'Upstream', // [SITE NAME] placeholder: working name
  tagline: 'Real jobs. Real companies. Straight from the source.', // [TAGLINE] placeholder
  owner: 'Traishik Akuli',
  url: 'https://upstreamjobs.pages.dev', // swap for the custom domain later
  /** Data older than this shows a quiet "may be stale" notice. */
  staleAfterHours: 24,
  /** Cloudflare Turnstile site key (public by design). The secret lives only in Cloudflare. */
  turnstileSiteKey: '0x4AAAAAAGCwElHHNvKy2G4y',
  /** Cloudflare Web Analytics token (free; Pages → Metrics → Web Analytics). Empty = off. */
  cfAnalyticsToken: '',
  /** Which serif carries headlines. Bodoni Moda chosen at the Phase 1 review (2026-11-14). */
  displaySerif: 'bodoni' as 'cormorant' | 'bodoni',
} as const;

export type ModuleId =
  | 'jobs'
  | 'companies'
  | 'about'
  | 'feedback'
  | 'ads'
  | 'insiders'
  | 'projects'
  | 'books'
  | 'resources';

export interface ModuleEntry {
  id: ModuleId;
  enabled: boolean;
  navLabel?: string;
  navOrder?: number;
  homepageWidget?: boolean;
}

/** Module registry. Wired into routing/nav in Phase 4. Flip `enabled` to turn a section on or off. */
export const modules: ModuleEntry[] = [
  { id: 'jobs', enabled: true, navLabel: 'Jobs', navOrder: 1, homepageWidget: true },
  { id: 'companies', enabled: true, navLabel: 'Companies', navOrder: 2, homepageWidget: true },
  { id: 'about', enabled: true, navLabel: 'About', navOrder: 4 },
  { id: 'feedback', enabled: true, navLabel: 'Feedback', navOrder: 5 },
  { id: 'ads', enabled: true, homepageWidget: true },
  // Inside Track: tips and referral links shared by people who work at listed companies.
  // Built in Phase 4 alongside feedback (same Turnstile + D1 + moderation path).
  { id: 'insiders', enabled: true, navLabel: 'Inside Track', navOrder: 3, homepageWidget: true },
  { id: 'projects', enabled: false, navLabel: 'Projects', navOrder: 5 },
  { id: 'books', enabled: false, navLabel: 'Books', navOrder: 6 },
  { id: 'resources', enabled: false, navLabel: 'Resources', navOrder: 7 },
];
