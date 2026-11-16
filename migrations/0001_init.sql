-- Feedback and Inside Track storage (Cloudflare D1). No IP addresses are stored anywhere.
CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('idea','bug','missing-company','praise','other','report')),
  message     TEXT NOT NULL,
  email       TEXT,                       -- optional, only if the person wants a reply
  can_quote   INTEGER NOT NULL DEFAULT 0, -- "you can quote me" (first name only)
  context     TEXT,                       -- e.g. topic=removal, job id, company (no personal data)
  status      TEXT NOT NULL DEFAULT 'new' -- new | read | shipped | archived
);
CREATE INDEX IF NOT EXISTS feedback_created ON feedback (created_at);

CREATE TABLE IF NOT EXISTS insider_notes (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  company       TEXT NOT NULL,             -- company slug from config/companies.yaml
  name          TEXT,                      -- first name or NULL (anonymous)
  role          TEXT,
  tenure        TEXT,
  tip           TEXT,
  referral_url  TEXT,                      -- must match the company's allowlisted domains/boards
  referral_note TEXT,
  reply_email   TEXT,                      -- private: owner only, never published
  renew_token   TEXT NOT NULL,             -- private link lets the submitter renew a referral
  expires_at    TEXT,                      -- referrals hide after 90 days unless renewed
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','removed')),
  reviewed_at   TEXT,
  reports       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS insider_status ON insider_notes (status, company);
