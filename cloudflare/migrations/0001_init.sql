-- Dawakraft database on Cloudflare D1 (SQLite). Apply once with the cf CLI (see README,
-- "Turning on real accounts"). Ports supabase/migrations 0001-0004 into one file.
-- There is no row-level security in D1: the app's API routes add "owner_id = <signed-in user>"
-- to every query (src/lib/db/*), so each distributor only ever sees and changes their own rows.
-- Timestamps are ISO 8601 text in UTC (e.g. 2026-10-22T10:00:00.000Z), which sorts correctly.
-- D1 always enforces foreign keys, so deleting a user removes their rows too.


-- People who can sign in. Email is the identity; compared case-insensitively.
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) BETWEEN 3 AND 254),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One-time sign-in codes. Only a keyed hash of the code is stored, never the code itself.
CREATE TABLE IF NOT EXISTS login_codes (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL COLLATE NOCASE,
  code_hash  TEXT NOT NULL,
  ip         TEXT NOT NULL DEFAULT '',
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS login_codes_email_created_idx ON login_codes (email, created_at);
CREATE INDEX IF NOT EXISTS login_codes_ip_created_idx ON login_codes (ip, created_at);

-- Signed-in sessions. The cookie holds a random token; only its SHA-256 is stored here.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- Company profile: one row per user.
CREATE TABLE IF NOT EXISTS companies (
  owner_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '' CHECK (length(name) <= 120),
  tagline     TEXT NOT NULL DEFAULT '' CHECK (length(tagline) <= 160),
  phone       TEXT NOT NULL DEFAULT '' CHECK (length(phone) <= 40),
  email       TEXT NOT NULL DEFAULT '' CHECK (length(email) <= 160),
  address     TEXT NOT NULL DEFAULT '' CHECK (length(address) <= 300),
  licence     TEXT NOT NULL DEFAULT '' CHECK (length(licence) <= 200),
  brand_color TEXT NOT NULL DEFAULT '#0B7A63'
              CHECK (length(brand_color) = 7 AND brand_color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
  logo_path   TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Products in the catalog.
CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  composition  TEXT NOT NULL DEFAULT '' CHECK (length(composition) <= 500),
  -- Indications as in the approved leaflet, e.g. 'Hypertension, Angina'. Optional.
  uses         TEXT NOT NULL DEFAULT '' CHECK (length(uses) <= 140),
  form         TEXT NOT NULL DEFAULT '' CHECK (length(form) <= 60),
  pack_size    TEXT NOT NULL DEFAULT '' CHECK (length(pack_size) <= 120),
  -- Rupees with up to 2 decimals (numeric(10,2) in the old Postgres schema).
  mrp          REAL CHECK (mrp IS NULL OR (mrp > 0 AND mrp < 100000000)),
  schedule     TEXT NOT NULL DEFAULT '' CHECK (schedule IN ('', 'None', 'H', 'H1', 'X', 'G')),
  manufacturer TEXT NOT NULL DEFAULT '' CHECK (length(manufacturer) <= 200),
  marketed_by  TEXT NOT NULL DEFAULT '' CHECK (length(marketed_by) <= 200),
  storage      TEXT NOT NULL DEFAULT '' CHECK (length(storage) <= 200),
  category     TEXT NOT NULL DEFAULT 'Other' CHECK (length(category) <= 60),
  scheme       TEXT NOT NULL DEFAULT '' CHECK (length(scheme) <= 120),
  highlight    TEXT NOT NULL DEFAULT '' CHECK (length(highlight) <= 60),
  template     TEXT NOT NULL DEFAULT 'clean'
               CHECK (template IN ('catalog', 'promo', 'clean', 'band', 'spotlight')),
  -- The circular's own content, shaped by parsePromo() in src/lib/promo.ts. '{}' = not written yet.
  promo        TEXT NOT NULL DEFAULT '{}'
               CHECK (json_valid(promo) AND json_type(promo) = 'object' AND length(promo) < 16384),
  image_path   TEXT,
  example      INTEGER NOT NULL DEFAULT 0 CHECK (example IN (0, 1)),
  -- When the product launched. Empty means an existing product (new launch for 60 days after).
  launched_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS products_owner_created_idx ON products (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS products_owner_launched_idx ON products (owner_id, launched_at DESC);

-- A log of AI calls, used to limit how often each user can call the paid AI (keeps the bill in check).
CREATE TABLE IF NOT EXISTS ai_usage (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('read', 'sort', 'copy', 'photo')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS ai_usage_owner_kind_time_idx ON ai_usage (owner_id, kind, created_at DESC);
