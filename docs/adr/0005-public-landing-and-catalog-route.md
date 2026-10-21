# ADR 0005: Public landing page at `/`, the app at `/catalog`

- **Status:** Accepted
- **Date:** recorded 2026-10-22

## Context

The app used to open straight into the catalog. Search engines, and people arriving from a shared link, need a page that explains the product. The app screens are private tools that should never appear in search results.

## Decision

- `/` (`src/app/page.tsx`) is a public, indexable landing page with a canonical URL, Open Graph and Twitter tags, a 1200 × 630 share image and JSON-LD (`SoftwareApplication` and `FAQPage`).
- The app home is `/catalog`. A successful sign-in (`src/app/auth/callback/route.ts`, `src/app/login/page.tsx`) and the proxy send users there.
- App screens and login are `noindex, nofollow` (`src/app/(app)/layout.tsx`, `src/app/login/layout.tsx`), and `robots.txt` disallows `/catalog`, `/new`, `/product`, `/company`, `/import`, `/login`, `/auth` and `/api`.
- `src/proxy.ts` treats `/`, `/robots.txt`, `/sitemap.xml`, `/opengraph-image` and `/icon.svg` as public even when sign-in is switched on.

## Alternatives considered

- **A separate marketing site:** more to deploy and keep in step.
- **Index the app screens:** they hold private catalogs and have no public content.

## Consequences

- Old links to `/` now show the landing page; users tap "Open the app" or "Try the free demo".
- The PWA manifest's `start_url` is still `/`, so a home-screen install opens the landing page first. Changing it to `/catalog` is a small follow-up.
- See [SEO_PLAN](../SEO_PLAN.md).
