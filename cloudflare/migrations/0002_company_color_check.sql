-- Fix: saving a company profile failed with "LIKE or GLOB pattern too complex".
-- D1 limits a LIKE/GLOB pattern to 50 bytes; the brand_color check in 0001 used an 85-byte pattern, so every
-- write to companies was refused. SQLite can't edit a CHECK in place, so rebuild the table with a short check.

CREATE TABLE companies_new (
  owner_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '' CHECK (length(name) <= 120),
  tagline     TEXT NOT NULL DEFAULT '' CHECK (length(tagline) <= 160),
  phone       TEXT NOT NULL DEFAULT '' CHECK (length(phone) <= 40),
  email       TEXT NOT NULL DEFAULT '' CHECK (length(email) <= 160),
  address     TEXT NOT NULL DEFAULT '' CHECK (length(address) <= 300),
  licence     TEXT NOT NULL DEFAULT '' CHECK (length(licence) <= 200),
  brand_color TEXT NOT NULL DEFAULT '#0B7A63'
              CHECK (length(brand_color) = 7 AND substr(brand_color, 1, 1) = '#' AND substr(brand_color, 2) NOT GLOB '*[^0-9A-Fa-f]*'),
  logo_path   TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO companies_new (owner_id, name, tagline, phone, email, address, licence, brand_color, logo_path, updated_at)
SELECT owner_id, name, tagline, phone, email, address, licence, brand_color, logo_path, updated_at FROM companies;

DROP TABLE companies;
ALTER TABLE companies_new RENAME TO companies;
