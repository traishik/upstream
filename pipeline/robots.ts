/**
 * Minimal robots.txt support (RFC 9309): groups by user-agent, Allow/Disallow with `*` and `$`,
 * longest-match wins, Allow wins ties. We match our product token, falling back to `*`.
 * If robots.txt can't be fetched (4xx), everything is allowed; on 5xx/network errors we fail closed.
 */
type Rule = { allow: boolean; pattern: string };

export function parseRobots(txt: string, agentToken: string): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let cur: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && cur) {
      lastWasAgent = false;
      if (key === 'disallow' && val === '') continue; // empty Disallow = allow all
      cur.rules.push({ allow: key === 'allow', pattern: val });
    } else {
      lastWasAgent = false;
    }
  }
  const token = agentToken.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

const toRegex = (pattern: string) => {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
};

export function isAllowed(rules: Rule[], pathAndQuery: string): boolean {
  let best: Rule | null = null;
  for (const r of rules) {
    if (!toRegex(r.pattern).test(pathAndQuery)) continue;
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

export class Robots {
  private cache = new Map<string, Promise<Rule[] | 'deny-all'>>();
  private token: string;
  constructor(userAgent: string, private get: (url: string) => Promise<Response>) {
    this.token = userAgent.split('/')[0];
  }
  private load(origin: string) {
    let p = this.cache.get(origin);
    if (!p) {
      p = (async () => {
        try {
          const res = await this.get(`${origin}/robots.txt`);
          if (res.status >= 400 && res.status < 500) { await res.body?.cancel(); return []; }
          if (!res.ok) { await res.body?.cancel(); return 'deny-all' as const; }
          const txt = await res.text();
          if (/<html/i.test(txt.slice(0, 500))) return []; // HTML error page in place of robots.txt
          return parseRobots(txt, this.token);
        } catch {
          return 'deny-all' as const;
        }
      })();
      this.cache.set(origin, p);
    }
    return p;
  }
  async allowed(u: URL): Promise<boolean> {
    if (u.pathname === '/robots.txt') return true;
    const rules = await this.load(u.origin);
    if (rules === 'deny-all') return false;
    return isAllowed(rules, u.pathname + u.search);
  }
}
