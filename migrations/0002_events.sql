-- First-party, privacy-friendly usage events. No IP, no user agent, no cookies.
-- vid = random anonymous browser id (rotates every 30 days); sid = random per-tab session id.
CREATE TABLE IF NOT EXISTS events (
  day     TEXT NOT NULL,          -- YYYY-MM-DD (UTC)
  ts      TEXT NOT NULL,
  event   TEXT NOT NULL,
  path    TEXT,
  props   TEXT,                   -- small JSON object, allowlisted keys only
  ref     TEXT,                   -- referring site's hostname (page views only)
  device  TEXT,                   -- 'mobile' | 'desktop' (derived, the user agent itself is discarded)
  vid     TEXT,
  sid     TEXT
);
CREATE INDEX IF NOT EXISTS events_day_event ON events (day, event);
