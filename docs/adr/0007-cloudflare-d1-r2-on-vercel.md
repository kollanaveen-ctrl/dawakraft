# ADR 0007: Cloudflare D1 and R2 for data and photos, with email-code sign-in, while Vercel stays the host

- **Status:** Accepted. Supersedes the Supabase part of [ADR 0001](0001-nextjs-supabase.md) (Next.js stays). [ADR 0002](0002-demo-mode-browser-storage.md) still holds, with a new switch.
- **Date:** recorded 2026-10-22

## Context

Supabase was never connected (the app only ever ran in demo mode). The owner wants the website connected to Cloudflare as its database, with **Vercel staying the host**. A Cloudflare D1 database already exists on the account; R2 (object storage) isn't enabled yet.

D1 is normally used from a Cloudflare Worker through a binding. A Next.js app on Vercel has no binding, so it has to reach D1 over Cloudflare's REST API, and R2 over its S3-compatible API. Supabase also gave us three things for free that D1 doesn't have: row-level security, sign-in, and storage policies. Those now have to live in our own code.

## Decision

- **Database: D1 over the REST API.** `src/lib/cloudflare/d1.ts` sends `POST …/accounts/{account}/d1/database/{db}/query` with `{ sql, params }` or `{ batch }` and a D1-only API token. Timeout 10 s, two retries on 429/5xx. Statements bind at most 100 values, so bulk inserts are split and sent together as one batch request. Schema: `cloudflare/migrations/0001_init.sql` (all the old Postgres columns and `CHECK` limits, ported to SQLite), applied with `cf d1 migrations apply <database id> --dir cloudflare/migrations`.
- **Security in code instead of RLS.** The browser never talks to D1. It calls our own routes (`/api/data/*`), and `withUser` (`src/lib/api/respond.ts`) gets the user from the session cookie only. Every SQL builder in `src/lib/db/*` binds that id as `owner_id`; zod schemas drop any owner field in a request; upserts update only a row with the same owner. Tests check these rules (`data-api.test.ts`).
- **Photos: private R2 bucket with presigned links.** The server signs short PUT (5 min, content type signed) and GET (10 min) links with `aws4fetch`; the browser uploads and downloads directly, so photos don't pass through Vercel's function limits. Keys live under `<user id>/`, and only that user's prefix is ever signed or deleted. Until R2 is enabled, uploads answer `storage_not_configured` and the rest works.
- **Sign-in: our own email code plus Resend.** 6-digit code, stored only as HMAC-SHA256 (keyed with `AUTH_SECRET`), 10 minutes, 5 tries, used once; limits per email and IP. The session is a random 32-byte token in an httpOnly, SameSite=Lax cookie; D1 stores only its SHA-256. `getSession()` is one query joining sessions and users.
- **Switch.** `NEXT_PUBLIC_DATA_BACKEND=cloudflare` turns real mode on (the browser needs to know). Without it the app is in demo mode exactly as before. With it but missing settings, the routes answer `not_configured`.
- `src/lib/data/repo.ts` keeps its function signatures, so no screen changed.

## Alternatives considered

- **Keep Supabase:** fine technically, but not what the owner asked for.
- **Move hosting to Cloudflare (Workers / OpenNext) and use a D1 binding:** no HTTP round trip per query and no API rate limit, but a hosting migration the owner explicitly didn't want.
- **A small Worker in front of D1 that Vercel calls:** fewer limits, but one more thing to deploy and secure. A good next step if traffic grows (see Consequences).
- **A hosted auth service (Clerk, Auth.js with an adapter, Cloudflare Access):** more features, but another account, another bill or more dependencies for what is a simple email-code flow.
- **Upload photos through a Vercel route to R2:** simpler for CORS, but request-size and duration limits and double bandwidth.

## Consequences

- **Latency:** every query is an HTTPS round trip from Vercel to Cloudflare (typically tens of ms, more if the regions are far apart). Pages do about two calls per action (session + data). Keep Vercel's function region close to the D1 primary.
- **API rate limit:** the Cloudflare API allows about **1200 requests per 5 minutes per token**. That is plenty for a pilot (hundreds of actions a minute) but a ceiling for a busy site. If we approach it: put a Worker with a D1 binding in front, cache the session lookup briefly, or spread load across tokens.
- **Security moved from the database into code.** The D1 token can read and write everything. A route that forgets `withUser` or an SQL builder that forgets `owner_id` would leak data, so every new query must go through `src/lib/db/*` with an owner id and get a test. Keep the token D1-only and server-only.
- **Email delivery:** Resend without a verified domain delivers only to the Resend account's own address, so other people can't sign in until a domain is verified (DNS records) and `AUTH_EMAIL_FROM` is set.
- **No database transactions across requests:** each batch is atomic, but multi-step flows (verify code, then create session) are separate requests. The code is marked used atomically first, so a code can't be used twice.
- **Housekeeping:** old login codes and expired sessions are pruned per user at sign-in; a scheduled clean-up is still to do. The R2 upload size is checked when the link is issued, not bound into the link.
- The Supabase dependencies, client files, `/auth/callback` and the `supabase/` folder are removed.
