# Dawakraft roadmap

> Status: living document. Last checked against the code on 2026-10-22.
> Related: [PRODUCT_PLAN](PRODUCT_PLAN.md) · [TESTING](TESTING.md) · [INTEGRATIONS](INTEGRATIONS.md)

## 1. Completed

The full box-to-circular product works today in demo mode, live at https://dawakraft.vercel.app.

- **Five-step wizard:** Photos (Front / Side / Top roles) → Clean up → Details → Check → Circular. See [WORKFLOWS](WORKFLOWS.md).
- **Corner dots and straightening** per face, auto-suggested and adjustable by drag or arrow keys, with a live straightened preview and a depth-mismatch warning.
- **3D pack shot** from the user's own photos, on the phone, at no cost. Background removal for bottles, tubes and strips.
- **AI reading with evidence:** every field names the panel and quotes the printed text; composition always flagged; provider-independent layer with Claude and a clearly labelled mock.
- **Strength safety:** "Strength printed on the front" cross-check against the composition (with combination totals), unit-less numbers, letters read as digits.
- **Compliance check:** required fields, confirmation, banned claim words, Schedule H / H1 / X warning, trade-only footer.
- **Three circular layouts** (Clean, Side band, Spotlight) at 1080 × 1350 with company branding.
- **Product page:** share on WhatsApp (image + message where supported), download (iPhone "Show image to save"), copy message, change layout, edit, delete.
- **Catalog** with search and combinable segments (launch, category, company with spelling grouping); **new launches move to Existing after 60 days** automatically; "Copy catalog list" of what is shown.
- **CSV / Excel paste import** (up to 500 rows) with AI category filling (up to 150 at a time).
- **Company profile:** logo, colour, contacts, licence numbers, live preview.
- **Email sign-in and per-user data** with row-level security (code ready, waiting for Supabase).
- **Demo mode** in the browser with no account.
- **Public landing page** with SEO basics (Lighthouse mobile: Accessibility, Best Practices and SEO all 100).
- **Installable** (PWA manifest, icons, service worker in production).
- **Security:** server-only Claude key, sign-in and per-user limits for paid AI, race-proof usage count, 13 MB request cap, unknown `AI_PROVIDER` means off, basic security headers.
- **Checks:** 74 unit tests, typecheck, lint, build and production audit all clean.

## 2. Remaining work (known gaps)

- Supabase is not connected, so sign-in, cloud storage and the shared AI limit are untested.
- No Claude key, so real readings are untested on real cartons.
- No automated end-to-end tests.
- Finger dragging, the WhatsApp share sheet and downloads not verified on a real phone.
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
| 4 | **Magnifier while dragging a corner** | A finger hides the corner it is placing. | Show an enlarged view of the area under the finger, offset above it. |
| 5 | **Non-box product polish** | Bottles, tubes and strips use only background removal and a flat photo. | Better edge cleanup, a simple shadow, guidance text for each pack type. |
| 6 | **Background presets for the pack shot** | More professional circulars without editing. | A few plain or gradient backgrounds behind the product picture. |
| 7 | **Full Content-Security-Policy** | Defence against injected scripts. | Allow only the site itself, Supabase and the font/image sources in use; test in report-only mode first. |
| 8 | **IP-based limits** | Limit abuse of sign-in emails and the AI routes beyond per-user counts. | For example Vercel's firewall rules or a small shared store. |
| 9 | **Per-user storage quota** | Keep Supabase storage costs predictable. | Count each user's files and refuse uploads over a set total, with a clear message. |

## 4. Future ideas

Not planned yet; worth discussing with users first.

- Hindi, Telugu and other regional-language versions of the app and the landing page.
- A custom domain and Google Search Console (see [SEO_PLAN](SEO_PLAN.md)).
- Sharing a whole catalog or a segment as a PDF or a set of images.
- More circular layouts, and layouts for a multi-product "new launches this month" sheet.
- Team accounts: several agents under one company profile.
- Re-reading only one field with AI (for example just the composition) after a retake.
- A free or cheaper AI provider behind the same contract, measured against Claude on real cartons (see [INTEGRATIONS](INTEGRATIONS.md)).
- Usage dashboard for AI calls and cost per account.
- A light/dark theme switch in the app (dark mode follows the phone today).
