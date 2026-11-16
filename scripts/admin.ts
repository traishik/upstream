/**
 * Owner-only admin CLI. Talks to D1 through your own logged-in `wrangler`, so there is no admin
 * page and no admin password to protect on the public site.
 *
 *   npm run admin -- feedback:list                 latest 25 notes
 *   npm run admin -- feedback:export [--since=2026-11-01]   → exports/feedback-<date>.csv
 *   npm run admin -- insiders:pending              notes waiting for review (with report counts)
 *   npm run admin -- insiders:approve <id> [<id>…]
 *   npm run admin -- insiders:reject  <id> [<id>…]
 *   npm run admin -- insiders:remove  <id>         take down an already-published note
 *   npm run admin -- insiders:publish              approved notes → content/insiders.json (then rebuild/deploy)
 *
 *   npm run admin -- stats [--days=30]         visitors, unique users, clicks, searches (terminal)
 *   npm run admin -- stats:report [--days=30]  the same as an HTML dashboard in exports/
 *   npm run admin -- stats:prune               delete events older than 13 months
 *
 * Add --local to work against the local dev database (wrangler pages dev) instead of production.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const cmd = args[0];
const local = args.includes('--local');
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const ids = args.slice(1).filter((a) => !a.startsWith('--'));
const root = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

function sql<T = Record<string, unknown>>(query: string): T[] {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'upstream', local ? '--local' : '--remote', '--json', '--command', query], {
    cwd: root('.'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  });
  const parsed = JSON.parse(out);
  return (Array.isArray(parsed) ? parsed[0]?.results : parsed?.results) ?? [];
}

const checkIds = (list: string[]) => {
  if (!list.length) throw new Error('Give at least one id.');
  for (const i of list) if (!/^[0-9a-f-]{36}$/i.test(i)) throw new Error(`Not an id: ${i}`);
  return list.map((i) => `'${i}'`).join(',');
};
const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Quote everything; neutralize spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

switch (cmd) {
  case 'feedback:list': {
    const rows = sql<any>('SELECT created_at, type, substr(message,1,90) AS message, email IS NOT NULL AS has_email, can_quote, context FROM feedback ORDER BY created_at DESC LIMIT 25');
    console.table(rows);
    break;
  }
  case 'feedback:export': {
    const since = flag('since');
    if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error('--since must be YYYY-MM-DD');
    const rows = sql<any>(`SELECT id, created_at, type, message, email, can_quote, context, status FROM feedback ${since ? `WHERE created_at >= '${since}'` : ''} ORDER BY created_at`);
    const cols = ['id', 'created_at', 'type', 'message', 'email', 'can_quote', 'context', 'status'];
    mkdirSync(root('exports'), { recursive: true });
    const file = root(`exports/feedback-${new Date().toISOString().slice(0, 10)}.csv`);
    writeFileSync(file, [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n'));
    console.log(`${rows.length} notes → ${file}  (exports/ is git-ignored; it may contain emails)`);
    break;
  }
  case 'insiders:pending': {
    const rows = sql<any>("SELECT id, created_at, company, name, role, substr(tip,1,70) AS tip, referral_url, reports FROM insider_notes WHERE status = 'pending' OR (status = 'approved' AND reports > 0) ORDER BY reports DESC, created_at");
    if (!rows.length) console.log('Nothing waiting. 🌤');
    for (const r of rows) {
      console.log(`\n${r.id}  ${r.company}  ${r.created_at.slice(0, 10)}${r.reports ? `  ⚠ ${r.reports} report(s)` : ''}`);
      console.log(`  ${[r.name, r.role].filter(Boolean).join(' · ') || 'Anonymous'}`);
      if (r.tip) console.log(`  tip: ${r.tip}${r.tip.length >= 70 ? '…' : ''}`);
      if (r.referral_url) console.log(`  referral: ${r.referral_url}`);
    }
    break;
  }
  case 'insiders:approve':
  case 'insiders:reject':
  case 'insiders:remove': {
    const status = { 'insiders:approve': 'approved', 'insiders:reject': 'rejected', 'insiders:remove': 'removed' }[cmd];
    sql(`UPDATE insider_notes SET status = '${status}', reviewed_at = '${new Date().toISOString()}' WHERE id IN (${checkIds(ids)})`);
    console.log(`${ids.length} note(s) → ${status}. Run insiders:publish, then rebuild, to update the site.`);
    break;
  }
  case 'insiders:publish': {
    const rows = sql<any>("SELECT id, company, name, role, tenure, tip, referral_url, referral_note, created_at, expires_at FROM insider_notes WHERE status = 'approved' ORDER BY created_at DESC");
    // Only public fields leave the database: never reply_email or renew_token.
    const pub = rows.map((r) => ({
      id: r.id, company: r.company, name: r.name ?? undefined, role: r.role ?? undefined, tenure: r.tenure ?? undefined,
      tip: r.tip ?? undefined, referralUrl: r.referral_url ?? undefined, referralNote: r.referral_note ?? undefined,
      createdAt: r.created_at, expiresAt: r.expires_at ?? undefined,
    }));
    writeFileSync(root('content/insiders.json'), JSON.stringify(pub, null, 2) + '\n');
    console.log(`${pub.length} approved note(s) → content/insiders.json`);
    break;
  }
  case 'stats':
  case 'stats:report': {
    const days = Math.min(365, Math.max(1, Number(flag('days') ?? 30)));
    const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    const W = `day >= '${since}'`;
    const daily = sql<any>(`SELECT day, COUNT(DISTINCT vid) AS visitors, COUNT(DISTINCT sid) AS visits, SUM(event = 'page_view') AS pageviews, SUM(event = 'apply_click') AS applies FROM events WHERE ${W} GROUP BY day ORDER BY day`);
    const [tot] = sql<any>(`SELECT COUNT(DISTINCT vid) AS visitors, COUNT(DISTINCT sid) AS visits, SUM(event = 'page_view') AS pageviews, SUM(event = 'apply_click') AS applies, SUM(event = 'save') AS saves, SUM(event = 'insider_submit') AS insider, SUM(event = 'feedback_submit') AS feedback FROM events WHERE ${W}`);
    const top = (label: string, where: string, count = 'COUNT(*)') =>
      sql<any>(`SELECT ${label} AS label, ${count} AS n FROM events WHERE ${W} AND ${where} GROUP BY label ORDER BY n DESC LIMIT 15`);
    const sections: [string, any[]][] = [
      ['Top pages', top('path', "event = 'page_view'")],
      ['Where visitors come from', top("COALESCE(ref, '(direct / unknown)')", "event = 'page_view'")],
      ['Apply clicks by company', top("json_extract(props, '$.company')", "event = 'apply_click'")],
      ['Top searches', top("json_extract(props, '$.q')", "event = 'search'")],
      ['Filters used', top("json_extract(props, '$.key') || ' = ' || json_extract(props, '$.value')", "event = 'filter'")],
      ['Link-only careers clicks', top("json_extract(props, '$.company')", "event = 'careers_click'")],
      ['All interactions', top('event', "event != 'page_view'")],
      ['Devices (unique visitors)', top('device', '1 = 1', 'COUNT(DISTINCT vid)')],
    ];
    const conv = tot?.visitors ? ((Number(tot.applies) / Number(tot.visitors)) * 100).toFixed(1) : '0';
    if (cmd === 'stats') {
      console.log(`\nLast ${days} days (since ${since})`);
      console.table([{ ...tot, 'apply clicks per 100 visitors': conv }]);
      for (const [t, rows] of sections) { console.log(`\n${t}`); console.table(rows); }
      break;
    }
    const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    const bars = (rows: any[]) => {
      const max = Math.max(1, ...rows.map((r) => Number(r.n)));
      return rows.length
        ? `<table>${rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="n">${r.n}</td><td class="bar"><span style="width:${(Number(r.n) / max) * 100}%"></span></td></tr>`).join('')}</table>`
        : '<p class="empty">No data yet.</p>';
    };
    const maxV = Math.max(1, ...daily.map((d) => Number(d.visitors)));
    const chart = `<svg viewBox="0 0 ${Math.max(1, daily.length) * 24} 120" class="chart" role="img" aria-label="Unique visitors per day">${daily
      .map((d, i) => { const h = (Number(d.visitors) / maxV) * 100; return `<rect x="${i * 24 + 4}" y="${110 - h}" width="16" height="${h}" rx="2"><title>${d.day}: ${d.visitors} visitors, ${d.pageviews} page views, ${d.applies} apply clicks</title></rect>`; })
      .join('')}</svg>`;
    const card = (k: string, v: unknown) => `<div class="card"><div class="k">${k}</div><div class="v">${typeof v === 'string' ? v : Number(v ?? 0).toLocaleString()}</div></div>`;
    const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Upstream stats</title>
<style>body{font:15px/1.5 system-ui;margin:40px auto;max-width:960px;padding:0 16px;background:#f6f2ea;color:#1d1c1a}h1{font:400 40px Georgia,serif;margin:0}h2{font:400 22px Georgia,serif;margin-top:40px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:24px}.card{border:1px solid #ddd5c6;border-radius:4px;padding:16px;background:#efe9dd}
.k{font:11px ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#5f5a51}.v{font-size:28px}table{width:100%;border-collapse:collapse}td{padding:6px 8px;border-bottom:1px solid #ddd5c6}
td.n{text-align:right;width:60px;font-family:ui-monospace,monospace}td.bar{width:40%}td.bar span{display:block;height:8px;background:#c9a96e;border-radius:2px}.chart{width:100%;height:160px}.chart rect{fill:#c9a96e}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 32px}@media(max-width:700px){.grid{grid-template-columns:1fr}}.empty,.note{color:#5f5a51}</style>
<h1>Upstream stats</h1><p class="note">Last ${days} days · generated ${new Date().toUTCString()}</p>
<div class="cards">${card('Unique visitors', tot?.visitors)}${card('Visits', tot?.visits)}${card('Page views', tot?.pageviews)}${card('Apply clicks', tot?.applies)}${card('Saves', tot?.saves)}${card('Inside Track notes', tot?.insider)}${card('Feedback notes', tot?.feedback)}${card('Applies per 100 visitors', conv)}</div>
<h2>Unique visitors per day</h2>${chart}<div class="grid">${sections.map(([t, rows]) => `<div><h2>${t}</h2>${bars(rows)}</div>`).join('')}</div>
<p class="note" style="margin-top:40px">Anonymous, first-party data: no cookies, no IP addresses. Visitors with Do Not Track or Global Privacy Control are never counted.</p>`;
    mkdirSync(root('exports'), { recursive: true });
    const file = root(`exports/stats-${new Date().toISOString().slice(0, 10)}.html`);
    writeFileSync(file, html);
    console.log(`Dashboard → ${file}`);
    break;
  }
  case 'stats:prune': {
    const cutoff = new Date(Date.now() - 395 * 864e5).toISOString().slice(0, 10);
    sql(`DELETE FROM events WHERE day < '${cutoff}'`);
    console.log(`Deleted events older than ${cutoff} (13-month retention).`);
    break;
  }
  default:
    console.log(readFileHeader());
}

function readFileHeader() {
  return 'Commands: stats [--days=N] · stats:report · stats:prune · feedback:list · feedback:export [--since=YYYY-MM-DD] · insiders:pending · insiders:approve|reject|remove <id…> · insiders:publish   (add --local for the dev database)';
}
