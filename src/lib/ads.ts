/** Reads config/ads.yaml at build time and picks a creative for each placement. */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { fromRoot } from './root';

export type Placement = 'home' | 'list' | 'detail';
export interface Creative { id: string; eyebrow?: string; sponsor?: string; headline: string; body?: string; cta?: string; url: string; placements: Placement[]; start?: string; end?: string }
interface AdsConfig {
  network: { enabled: boolean; provider: string; client: string; slots: Record<Placement, string> };
  direct: Creative[];
  house: Creative[];
}

const cfg = parse(readFileSync(fromRoot('config', 'ads.yaml'), 'utf8')) as AdsConfig;

export const networkEnabled = () => Boolean(cfg.network?.enabled && cfg.network.client);
export const networkConfig = () => cfg.network;

const day = (d: string | Date) => new Date(d).toISOString().slice(0, 10);
/** Direct sponsors in their date window win; otherwise network (if on); otherwise house. */
export function pick(placement: Placement, seed = 0, today = new Date()): { kind: 'direct' | 'network' | 'house'; creative?: Creative } {
  const t = day(today);
  const direct = (cfg.direct ?? []).filter((c) => c.placements?.includes(placement) && (!c.start || day(c.start) <= t) && (!c.end || t <= day(c.end)));
  if (direct.length) return { kind: 'direct', creative: direct[seed % direct.length] };
  if (networkEnabled() && cfg.network.slots?.[placement]) return { kind: 'network' };
  const house = (cfg.house ?? []).filter((c) => c.placements?.includes(placement));
  return { kind: 'house', creative: house[seed % Math.max(1, house.length)] };
}

/** House/direct creatives for client-side rotation in the job list. */
export const listCreatives = () => {
  const p = pick('list');
  return p.kind === 'network' ? [] : [p.creative!, ...(cfg.house ?? []).filter((c) => c.placements?.includes('list') && c.id !== p.creative?.id)];
};
