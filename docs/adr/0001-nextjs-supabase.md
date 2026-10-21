# ADR 0001: Next.js App Router + Supabase

- **Status:** Accepted
- **Date:** recorded 2026-10-22 (the decision predates this record)

## Context

Dawakraft started as a single-file HTML prototype (`dawakraft.html`, referenced in comments in `src/lib/constants.ts`). To give each distributor their own catalog, sign-in and photo storage, and to keep an AI key secret, it needed a real backend, built and run by a very small team on a small budget.

## Decision

- **Next.js 16 App Router** (React 19, TypeScript) for the landing page, the app screens and two server route handlers (`/api/read-box`, `/api/categorize`).
- **Supabase** for Postgres, email sign-in and private photo storage, with row-level security on every table and per-user storage folders (`supabase/migrations/`).
- Most logic (image processing, circular drawing, compliance, catalog sorting) runs **in the browser**. The browser talks to Supabase directly through `src/lib/data/repo.ts`, protected by row-level security.

## Alternatives considered

- **A custom Node/Express API and own database:** more code to write and secure; no built-in auth or storage.
- **Firebase:** similar convenience, but Supabase gives plain SQL, simple RLS policies in one migration file and a Mumbai region.
- **Keep it a static page:** cannot hold the Claude key or per-user data.

## Consequences

- Free tiers of Vercel and Supabase cover a demo and early users (check current terms; see [INTEGRATIONS](../INTEGRATIONS.md)).
- Security depends on the RLS policies being right. They live in SQL files that must be run in the Supabase SQL editor by hand; no migration runner is wired up.
- The browser holds the publishable Supabase key. That is expected, and safe only because of RLS.
