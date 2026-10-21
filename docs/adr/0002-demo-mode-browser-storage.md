# ADR 0002: Demo mode in browser storage

- **Status:** Accepted
- **Date:** recorded 2026-10-22

## Context

Setting up Supabase takes about 20 minutes and an account. Founders, testers and prospects need to try the whole flow immediately, including on the public Vercel link, before any backend exists.

## Decision

`src/lib/config.ts` treats Supabase as configured only when both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` hold real values (placeholders containing `your-`, `example`, `placeholder` or `xxxx` do not count). Otherwise `demoMode` is true and:

- `src/lib/data/repo.ts` sends every read and write to `src/lib/data/demo-store.ts`, an IndexedDB database (`dawakraft-demo`) with `products`, `company` and `media` stores, under the user id `demo`.
- `src/proxy.ts` lets every page open and redirects `/login` to `/catalog`.
- A "Demo mode" banner (`src/components/DemoBanner.tsx`) shows on every app screen.
- Paid AI (Claude) is allowed without sign-in only when not running a production build (`demoAiAllowed()`). The free mock provider works everywhere.

## Alternatives considered

- **A shared public demo account in Supabase:** everyone would see each other's products and could upload anything.
- **localStorage:** too small for photos; IndexedDB stores image blobs.

## Consequences

- Demo data lives only in that browser on that device. Clearing site data deletes it, and nothing syncs between devices.
- Every data function has two branches. They are kept together in `repo.ts` so they don't drift.
- Switching from demo to Supabase does not move demo data across.
