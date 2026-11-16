/** Approved Inside Track notes, exported by `npm run admin -- insiders:publish` into content/insiders.json. */
import notes from '@content/insiders.json';
export interface InsiderNote {
  id: string; company: string; name?: string; role?: string; tenure?: string; tip?: string;
  referralUrl?: string; referralNote?: string; createdAt: string; expiresAt?: string;
}
const all = notes as InsiderNote[];
/** Referrals past their expiry are hidden; tips stay. */
export function visibleNotes(company?: string, now = Date.now()): InsiderNote[] {
  return all
    .filter((n) => !company || n.company === company)
    .map((n) => (n.referralUrl && n.expiresAt && new Date(n.expiresAt).getTime() < now ? { ...n, referralUrl: undefined, referralNote: undefined } : n))
    .filter((n) => n.tip || n.referralUrl)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function sharedAgo(iso: string, now = Date.now()): string {
  const d = Math.max(0, (now - new Date(iso).getTime()) / 864e5);
  if (d < 1) return 'today';
  if (d < 14) return `${Math.round(d)} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}
