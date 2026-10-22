# Dawakraft roadmap

> Status: living document. Last checked against the code on 2026-10-22.
> Related: [PRODUCT_PLAN](PRODUCT_PLAN.md) · [TESTING](TESTING.md) · [INTEGRATIONS](INTEGRATIONS.md)

## 1. Completed

The full box-to-circular product works today in demo mode, live at https://dawakraft.vercel.app.

- **Five-step wizard:** Photos (Front / Left end / Top / Strip, bottle or tube / Other side) → Clean up → Details → Check → Circular. See [WORKFLOWS](WORKFLOWS.md).
- **Automatic straightening** per box face: edges are found by the app, with a size check and an "already cropped" option. No dots to move. See [ADR 0006](adr/0006-automatic-straightening-and-catalogue-product-picture.md).
- **3D pack shot** from the user's own photos, on the phone, at no cost, drawn like the company catalogue. The real strip, bottle or tube photo is cut out and placed in front of the box.
- **AI reading with evidence:** every field names the panel and quotes the printed text; composition always flagged; provider-independent layer with Claude and a clearly labelled mock.
- **Strength safety:** "Strength printed on the front" cross-check against the composition (with combination totals), unit-less numbers, letters read as digits.
- **Compliance check:** required fields, confirmation, banned claim words, Schedule H / H1 / X warning, trade-only footer.
- **Four circular layouts** (Catalogue card, Clean, Side band, Spotlight) at 1080 × 1350 with company branding. The Catalogue card copies the printed catalogue card, has an optional Uses line, and is the default for new and imported products.
- **Product page:** share on WhatsApp (image + message where supported), download (iPhone "Show image to save"), copy message, change layout, edit, delete.
- **Catalog** with search and combinable segments (launch, category, company with spelling grouping); **new launches move to Existing after 60 days** automatically; "Copy catalog list" of what is shown.
- **Catalogue PDF** (`/export`, "Catalogue PDF" on the Catalog screen): every product as a Catalogue card, four to a page, laid out like the company PDF: logo, section pill and "Product Catalogue 2026-27" (financial year, editable) at the top; division bar, page dots and page number at the bottom, mirrored on odd and even pages; trade-only line on every page. Pages grouped by dosage form (Tablets, Capsules, Liquid…) or therapy category, A to Z; all, new launches or existing. Downloads or shares one PDF made on the phone (jsPDF).
- **CSV / Excel paste import** (up to 500 rows) with AI category filling (up to 150 at a time).
- **Company profile:** logo, colour, contacts, licence numbers, live preview.
- **Email sign-in and per-user data** with row-level security (code ready, waiting for Supabase).
- **Demo mode** in the browser with no account.
- **Public landing page** with SEO basics (Lighthouse mobile: Accessibility, Best Practices and SEO all 100).
- **Installable** (PWA manifest, icons, service worker in production).
- **Security:** server-only Claude key, sign-in and per-user limits for paid AI, race-proof usage count, 13 MB request cap, unknown `AI_PROVIDER` means off, basic security headers.
- **Checks:** 130 unit tests across 8 files, typecheck, lint, build and production audit all clean.

## 2. Remaining work (known gaps)

- Supabase is not connected, so sign-in, cloud storage and the shared AI limit are untested.
- No Claude key, so real readings are untested on real cartons.
- No automated end-to-end tests.
- Automatic straightening on real phone photos, the WhatsApp share sheet and downloads not verified on a real phone.
- Some touch targets are under 48 px: standard buttons (42 px), chips, step pills, photo role selects and the remove-photo button. See [DESIGN_SYSTEM](DESIGN_SYSTEM.md) section 7.
- No Content-Security-Policy yet.
- Rate limits are per user only; nothing limits by IP address.
- No storage quota per user beyond the 5 MB per-file bucket limit.
- Supabase's built-in email sender is limited to a few emails per hour; custom SMTP is needed for real users.

## 3. Next phase

In rough order. Items 1–3 are needed before real customers.

| # | Item | Why | Notes |
|---|---|---|---|
| 1 | **Connect Supabase and turn on login** | Data that lasts across devices; each distributor sees only their own catalog. | Create the project, run both migrations, set URL config, add the two `NEXT_PUBLIC_SUPABASE_*` variables in Vercel, redeploy, test sign-in by link and by code. Add custom SMTP. |
| 2 | **Add the Claude key with a monthly spend limit** | Real readings. | Set the limit in the Anthropic console first, then add `ANTHROPIC_API_KEY` in Vercel. Test on 10–20 real cartons, including a strength mismatch. Paid AI online needs sign-in, so do this after item 1. |
| 3 | **Playwright end-to-end tests** | Catch regressions in the flows unit tests can't see. | Wizard with the mock, mismatch blocking and clearing, import, catalog filters, 375 px layout, run in CI on every push. |
| 4 | **Circular page designs and a catalogue cover** | Full-page promotional circulars like the Ayu-Laxivent page, and a cover and contents page for the catalogue PDF. | Waiting for the company's circular reference designs. The contents page can list each section's page range, like the printed catalogue. |
| 5 | **Strip, bottle and tube polish** | The real pack photo is now placed in front of the box, so its cut-out edges show on every circular. | Check edge cleanup on shiny and busy packs, and tune the placement against more catalogue examples. See [ADR 0006](adr/0006-automatic-straightening-and-catalogue-product-picture.md). |
| 6 | **Background presets for the pack shot** | More professional circulars without editing. | A few plain or gradient backgrounds behind the product picture. |
| 7 | **Full Content-Security-Policy** | Defence against injected scripts. | Allow only the site itself, Supabase and the font/image sources in use; test in report-only mode first. |
| 8 | **IP-based limits** | Limit abuse of sign-in emails and the AI routes beyond per-user counts. | For example Vercel's firewall rules or a small shared store. |
| 9 | **Per-user storage quota** | Keep Supabase storage costs predictable. | Count each user's files and refuse uploads over a set total, with a clear message. |

## 4. Future ideas

Not planned yet; worth discussing with users first.

- Hindi, Telugu and other regional-language versions of the app and the landing page.
- A custom domain and Google Search Console (see [SEO_PLAN](SEO_PLAN.md)).
- Sharing a whole catalog or a segment as a PDF or a set of images (the catalogue page export in the next phase is the first step).
- More circular layouts, and layouts for a multi-product "new launches this month" sheet.
- Team accounts: several agents under one company profile.
- Re-reading only one field with AI (for example just the composition) after a retake.
- A free or cheaper AI provider behind the same contract, measured against Claude on real cartons (see [INTEGRATIONS](INTEGRATIONS.md)).
- Usage dashboard for AI calls and cost per account.
- A light/dark theme switch in the app (dark mode follows the phone today).
