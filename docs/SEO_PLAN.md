# Dawakraft SEO plan

> Status: living document. Last checked against the code on 2026-10-22.
> Related: [ADR 0005](adr/0005-public-landing-and-catalog-route.md) (public landing at `/`, app at `/catalog`) · [DESIGN_SYSTEM](DESIGN_SYSTEM.md)

## 1. The idea

Only **one page is meant for search engines: the public home page at `/`.** It explains the product to pharma distributors, PCD companies and medical agents and links to the free demo. Every app screen (`/catalog`, `/new`, `/product/…`, `/company`, `/import`) and the sign-in page are private tools and are kept out of search results.

Site details live in one place, `src/lib/site.ts`: name, URL (`NEXT_PUBLIC_SITE_URL`, default `https://dawakraft.vercel.app`), title, description and the list of private paths.

## 2. Implemented

| Item | Where | What it does |
|---|---|---|
| Unique title | `site.ts` → `SITE_TITLE`; `page.tsx` uses it as an absolute title | "Dawakraft: medicine box photo to compliant product circular". Other pages use the template "`<page>` · Dawakraft" (e.g. "Sign in · Dawakraft", "Your catalog · Dawakraft"). |
| Meta description | `SITE_DESCRIPTION` | "Photograph a medicine carton and get a branded, compliance-checked product circular for WhatsApp in minutes. Built for pharma distributors, PCD companies and medical agents in India." |
| Canonical URL | `page.tsx`: `alternates.canonical: "/"`, with `metadataBase` = `SITE_URL` in `layout.tsx` | Points search engines at one address for the home page. |
| Open Graph tags | `layout.tsx` `openGraph` | type website, site name, locale `en_IN`, URL, title, description. |
| Twitter / X card | `layout.tsx` `twitter` | `summary_large_image` with the same title and description. |
| Share image | `src/app/opengraph-image.tsx` → `/opengraph-image` | 1200 × 630 PNG: logo, "Medicine box to WhatsApp-ready circular in two minutes.", and two pills. Alt text "Dawakraft: medicine box photo to compliant product circular". Shown when the link is pasted into WhatsApp, LinkedIn or X. |
| Structured data (JSON-LD) | `page.tsx` `jsonLd()` | Two blocks: **SoftwareApplication** (BusinessApplication, "Web, Android, iOS", free offer in INR) and **FAQPage** built from the same five questions shown on the page, so the answers always match the visible text. `<` is escaped so the data can't break out of the script tag. |
| robots.txt | `src/app/robots.ts` | `Allow: /`, `Disallow:` `/catalog`, `/new`, `/product`, `/company`, `/import`, `/login`, `/auth`, `/api`; links to the sitemap; sets the host. |
| sitemap.xml | `src/app/sitemap.ts` | One URL: the home page (monthly, priority 1). |
| noindex on app screens | `src/app/(app)/layout.tsx` | `robots: { index: false, follow: false }` for every app screen. |
| noindex on sign-in | `src/app/login/layout.tsx` | Same, for `/login`. |
| Public without sign-in | `src/proxy.ts` | `/`, `/robots.txt`, `/sitemap.xml`, `/opengraph-image`, `/icon.svg` stay public even when sign-in is switched on, so crawlers and share previews always work. |
| Headings | `page.tsx` | One `h1` ("From medicine box to WhatsApp-ready circular in two minutes."), then `h2` per section: "Five steps, one thumb", "Built for the pharma trade, not generic design", "Who uses it", "Frequently asked", "Make your first circular now". Step and feature titles are `h3`. Each section is labelled by its heading (`aria-labelledby`). |
| Language | `layout.tsx` | `<html lang="en-IN">` and Open Graph locale `en_IN`. |
| Alt text | Throughout | The hero circular is a canvas with `role="img"` and the label "Example product circular made by Dawakraft"; decorative icons are hidden from screen readers. |
| Icons and manifest | `icon.svg`, `pwa-icon/[size]`, `manifest.ts` | Favicon, Apple touch icon (180) and install icons (192, 512, maskable). |

## 3. Verification

What was checked, exactly:

- **Lighthouse (mobile) on the home page:** Accessibility **100**, Best Practices **100**, SEO **100**. This was after fixing one finding, *label-content-name-mismatch* on the logo link (its accessible name didn't contain its visible text "Dawakraft"); the link now takes its name from the visible wordmark.
- **robots.txt, sitemap.xml, the Open Graph image and the JSON-LD** were checked by fetching them in the browser.

What is **not** claimed: no search rankings, no indexing, no traffic. The site has not been submitted to any search engine yet, and Lighthouse's SEO score only means the page follows the basic technical rules.

## 4. Next steps

1. **Google Search Console.** Add the property for the live address, verify it, submit `/sitemap.xml`, and use URL Inspection on `/` to confirm Google can fetch and render it. Watch the Coverage and Enhancements (FAQ) reports.
2. **Custom domain.** Buy a short domain, add it in Vercel, set `NEXT_PUBLIC_SITE_URL` to it and redeploy, so canonical, sitemap, robots and share-card URLs all switch together. Keep `dawakraft.vercel.app` redirecting to it. Also add the new address to Supabase's Site URL and Redirect URLs when sign-in is connected.
3. **Regional-language content.** Add Hindi and Telugu (and other regional) versions of the home page with `hreflang` links between them, written by people who speak the language and know the trade, not machine-translated.
4. Later: a short guide page per audience (distributors, PCD companies, agents) once there is real customer language to use, and Bing Webmaster Tools.
