/** Small helpers shared by fetchers. */

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain text (with \n line breaks) → simple HTML paragraphs and bullet lists. */
export function textToHtml(text: string): string {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  return blocks
    .map((b) => {
      const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 1 && lines.every((l) => /^[-•*·]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${escapeHtml(l.replace(/^[-•*·]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${lines.map(escapeHtml).join('<br>')}</p>`;
    })
    .join('');
}

/** Join titled sections into one HTML description. Skips empty sections. */
export function sections(parts: { title?: string; html?: string | null; text?: string | null }[]): string | undefined {
  const out = parts
    .map((p) => {
      const body = p.html ?? (p.text ? textToHtml(p.text) : '');
      if (!body || !body.replace(/<[^>]+>/g, '').trim()) return '';
      return (p.title ? `<h3>${escapeHtml(p.title)}</h3>` : '') + body;
    })
    .filter(Boolean)
    .join('');
  return out || undefined;
}

/** Decode HTML entities in Greenhouse-style escaped content (`&lt;p&gt;` → `<p>`). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

export const toIso = (v: string | number | undefined | null): string | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

/** "Posted 3 Days Ago" / "Posted Today" / "Posted 30+ Days Ago" → ISO date (approximate, Workday). */
export function relativePosted(text: string | undefined, now = new Date()): string | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  const d = new Date(now);
  if (t.includes('today')) return d.toISOString();
  if (t.includes('yesterday')) { d.setUTCDate(d.getUTCDate() - 1); return d.toISOString(); }
  const m = t.match(/(\d+)\+?\s*day/);
  if (m) { d.setUTCDate(d.getUTCDate() - Number(m[1])); return d.toISOString(); }
  return undefined;
}

/** Run async tasks with bounded concurrency. */
export async function pool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); }
  }));
}
