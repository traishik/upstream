/**
 * Polite HTTP client.
 * - Honest User-Agent with a contact URL
 * - At most 1 request/second per host (configurable)
 * - Exponential backoff with jitter on 429 / 5xx / network errors; honors Retry-After
 * - robots.txt checked before every request (see robots.ts)
 * - ETag / If-Modified-Since for GETs, cached in memory per run (and persisted via state)
 */
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import { Robots } from './robots.ts';

export interface HttpOptions {
  userAgent: string;
  minIntervalMsPerHost: number;
  timeoutMs: number;
  maxRetries: number;
}

export class HttpError extends Error {
  constructor(public status: number, public url: string, message?: string) {
    super(message ?? `HTTP ${status} for ${url}`);
  }
}

export class RobotsDisallowed extends Error {
  constructor(public url: string) { super(`robots.txt disallows ${url}`); }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Plain HTTP(S) transport on node:https. We use it instead of the built-in fetch because fetch
 * always adds browser-style CORS headers (`sec-fetch-mode: cors`), which some career-site
 * firewalls (Workday) reject. This is an ordinary, honest client: same User-Agent, nothing spoofed.
 * Follows up to 5 redirects and decompresses gzip/deflate/br. Returns a standard Response.
 */
async function send(url: string, init: { method: string; headers: Record<string, string>; body?: string }, timeoutMs: number, hops = 0): Promise<Response> {
  const u = new URL(url);
  const mod = u.protocol === 'http:' ? http : https;
  const headers: Record<string, string> = { 'Accept-Encoding': 'gzip, deflate, br', ...init.headers };
  if (init.body !== undefined) headers['Content-Length'] = String(Buffer.byteLength(init.body));
  const { status, resHeaders, buf } = await new Promise<{ status: number; resHeaders: http.IncomingHttpHeaders; buf: Buffer }>((resolve, reject) => {
    const req = mod.request(u, { method: init.method, headers, timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => { size += c.length; if (size <= 30_000_000) chunks.push(c); });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, resHeaders: res.headers, buf: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`timeout after ${timeoutMs}ms: ${url}`)));
    req.on('error', reject);
    req.end(init.body);
  });
  if ([301, 302, 303, 307, 308].includes(status) && resHeaders.location && hops < 5) {
    const next = new URL(resHeaders.location, u).toString();
    const method = status === 303 || ((status === 301 || status === 302) && init.method === 'POST') ? 'GET' : init.method;
    const res = await send(next, { ...init, method, body: method === 'GET' ? undefined : init.body }, timeoutMs, hops + 1);
    Object.defineProperty(res, 'redirected', { value: true });
    return res;
  }
  const enc = String(resHeaders['content-encoding'] ?? '');
  const body = enc.includes('br') ? zlib.brotliDecompressSync(buf) : enc.includes('gzip') ? zlib.gunzipSync(buf) : enc.includes('deflate') ? zlib.inflateSync(buf) : buf;
  const h = new Headers();
  for (const [k, v] of Object.entries(resHeaders)) if (v !== undefined && k !== 'content-encoding' && k !== 'content-length') h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  const res = new Response(status === 204 || status === 304 ? null : new Uint8Array(body), { status, headers: h });
  Object.defineProperty(res, 'url', { value: url });
  Object.defineProperty(res, 'redirected', { value: hops > 0 });
  return res;
}

export interface Validators { etag?: string; lastModified?: string }

export class Http {
  private nextSlot = new Map<string, number>();
  /** Hosts that answered 429 get 3× the normal spacing for the rest of the run. */
  private slowHosts = new Set<string>();
  readonly robots: Robots;
  requests = 0;
  constructor(private o: HttpOptions, public validators: Map<string, Validators> = new Map()) {
    this.robots = new Robots(o.userAgent, (url) => this.raw(url, { method: 'GET' }, false));
  }

  /** Wait for this host's next free slot (serializes requests per host). */
  private async throttle(host: string) {
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot.get(host) ?? 0);
    this.nextSlot.set(host, slot + this.o.minIntervalMsPerHost * (this.slowHosts.has(host) ? 3 : 1));
    if (slot > now) await sleep(slot - now);
  }

  private async raw(url: string, init: RequestInit, checkRobots = true): Promise<Response> {
    const u = new URL(url);
    if (checkRobots && !(await this.robots.allowed(u))) throw new RobotsDisallowed(url);
    let attempt = 0;
    for (;;) {
      await this.throttle(u.host);
      this.requests++;
      try {
        const res = await send(url, {
          method: init.method ?? 'GET',
          headers: { 'User-Agent': this.o.userAgent, 'Accept-Language': 'en-US,en;q=0.8', ...((init.headers as Record<string, string>) ?? {}) },
          body: typeof init.body === 'string' ? init.body : undefined,
        }, this.o.timeoutMs);
        if ((res.status === 429 || res.status >= 500) && attempt < this.o.maxRetries) {
          const ra = Number(res.headers.get('retry-after'));
          // Rate-limited: back off hard (5s, 15s, 45s, 90s…) and slow this host down for the rest of the run.
          const backoff = res.status === 429 ? Math.min(5000 * 3 ** attempt, 90_000) : 2 ** attempt * 1000;
          if (res.status === 429) this.slowHosts.add(u.host);
          const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 120_000) : backoff + Math.random() * 500;
          await res.body?.cancel();
          attempt++;
          await sleep(wait);
          continue;
        }
        return res;
      } catch (e) {
        if (attempt >= this.o.maxRetries) throw e;
        attempt++;
        await sleep(2 ** attempt * 1000 + Math.random() * 500);
      }
    }
  }

  /** GET (or POST when body given) and parse JSON. Throws HttpError on non-2xx. */
  async json<T = any>(url: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
    const init: RequestInit = {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: { Accept: 'application/json', ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    };
    const res = await this.raw(url, init);
    if (!res.ok) { await res.body?.cancel(); throw new HttpError(res.status, url); }
    return (await res.json()) as T;
  }

  /** GET text with conditional-request support. Returns null on 304 (unchanged). */
  async text(url: string, opts: { conditional?: boolean; headers?: Record<string, string> } = {}): Promise<string | null> {
    const v = opts.conditional ? this.validators.get(url) : undefined;
    const headers: Record<string, string> = { ...opts.headers };
    if (v?.etag) headers['If-None-Match'] = v.etag;
    if (v?.lastModified) headers['If-Modified-Since'] = v.lastModified;
    const res = await this.raw(url, { method: 'GET', headers });
    if (res.status === 304) return null;
    if (!res.ok) { await res.body?.cancel(); throw new HttpError(res.status, url); }
    if (opts.conditional) {
      const etag = res.headers.get('etag') ?? undefined;
      const lastModified = res.headers.get('last-modified') ?? undefined;
      if (etag || lastModified) this.validators.set(url, { etag, lastModified });
    }
    return res.text();
  }

  /** Low-level request for liveness checks: returns status, final URL and (truncated) body. */
  async probe(url: string): Promise<{ status: number; finalUrl: string; body: string; redirected: boolean }> {
    const res = await this.raw(url, { method: 'GET', headers: { Accept: 'text/html,application/xhtml+xml' } });
    const reader = res.body?.getReader();
    let body = '';
    if (reader) {
      const dec = new TextDecoder();
      while (body.length < 400_000) {
        const { value, done } = await reader.read();
        if (done) break;
        body += dec.decode(value, { stream: true });
      }
      await reader.cancel().catch(() => {});
    }
    return { status: res.status, finalUrl: res.url || url, body, redirected: res.redirected };
  }
}
