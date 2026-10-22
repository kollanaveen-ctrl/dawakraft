# Dawakraft — Product, Design & Operations Guide

Product and implementation snapshot · 22 October 2026 · Working launch guide

## 1. Product purpose

Dawakraft helps small Indian pharmaceutical distributors, PCD companies and medical representatives turn medicine-carton photos into branded trade circulars and an organised product catalogue. The main value is clearer presentation and easier retrieval of product information. Speed is useful, but the research does not establish that the old photo-sharing process was slow.

The core journey is photograph → prepare product picture → read or enter details → verify against the carton → check common content risks → save a circular and catalogue entry → download or share. AI assists with reading and drafting; the operator remains responsible for the final information.

## 2. Research and evidence limits

Primary research, dated 19 October 2026, records one written interview with the SPARKIND founder in Hyderabad. He reported 8–10 new products a week and difficulty finding products among 20–30 weekly WhatsApp posts. Raw photos took only 1–2 minutes per product. These are one insider’s reported experiences (n = 1), not independent market validation.

The founder’s estimated willingness to pay ₹5,000–6,000 per month is an untested hypothesis. Reported designer fees of ₹4,000–10,000 do not consistently distinguish monthly fees from per-job fees. Do not present these as established customer savings or market pricing.

Secondary research, dated 17 October 2026, discusses fragmented distribution, ordering software, generic image tools and WhatsApp Catalogs. Its market counts, competitor prices and WhatsApp API rates include old, conflicting or third-party estimates. They are research leads, not verified current facts. Absence of a competitor in that search is not evidence that no competitor exists.

Design implication: prioritise a readable catalogue, consistent company branding, visible search and product verification. A public shared catalogue, team collaboration and automatic broadcasts remain roadmap concepts; this guide does not describe them as shipped.

## 3. Current product capabilities

The repository implements a five-stage product wizard, photo preparation and a product pack shot made from supplied photos. Structured AI reading returns values with confidence and evidence. Users can enter information manually, and sample AI values are marked as samples.

Circular layouts include Catalogue card, Promo circular, Clean, Side band and Spotlight. Product pages support image download, message copying and device sharing. The catalogue supports search, filters, CSV or pasted spreadsheet import, and catalogue PDF export. Company settings provide a logo, colour, contact information and licence details.

Promotional copy and lifestyle-image generation are optional AI features. Generated lifestyle imagery is distinct from the product pack shot and must remain labelled. AI-generated copy and indications must be checked against authorised product information before use.

## 4. Operator journeys

### Create a verified product

Photograph one carton at a time on a plain contrasting background. Label front and side images correctly. In Clean up, inspect the prepared pack shot; retake or crop images when edge detection fails. In Details, run AI reading or type the carton text, then verify every value, especially composition, strength, manufacturer and MRP. Confirm the review, resolve red checks, choose a circular and save to the catalogue.

### Find, update and share

Use catalogue search and launch, category or company filters to find a saved product. Review its current details before sharing. The new-launch state expires after 60 days; edits can require renewed confirmation. Download the circular or use the share control. On supported phones, a native share sheet can attach an image; desktop WhatsApp links may supply text only, requiring a downloaded image to be attached manually.

### Import and export

Import a CSV or paste spreadsheet rows with a header row and a name/brand column. Inspect the preview and any AI-suggested categories; imported information still needs verification. Use Catalogue PDF to select document title and division, then download or share. Import and PDF export are not substitutes for maintaining an accurate source catalogue.

## 5. Design direction

The redesign uses ivory paper (#FBF8F0), deep pine (#0E5E4E) and restrained marigold (#E9A23B), with editorial typography and clear product imagery. The folded-page D monogram and “The pharma catalogue studio” tagline connect the identity to organised product presentation. The shared logo appears in the header, favicon, PWA and Open Graph artwork; reusable assets are public/brand/dawakraft-logo.svg and public/brand/dawakraft-mark.svg.

Keep the primary actions obvious: add a product, find a product and open the catalogue. Distinguish sample data from real information, show save and loading states, retain visible labels and focus states, and respect reduced-motion preferences. Decorative design must not reduce the visibility of review requirements or trade-only notices.

## 6. Architecture and data flow

The package snapshot uses Next.js 16.4.2, React 19.3.0, TypeScript, Tailwind CSS 4, Zod, jsPDF and Vitest. Next.js provides the pages and server API routes. Browser Canvas prepares images, renders circulars and supports catalogue PDF generation. Vercel hosts the Next.js app; Cloudflare provides optional D1 and R2 services reached through server-side APIs.

Demo mode stores products, company details and media in IndexedDB in the current browser. Other devices do not share that data, and clearing browser storage can remove it. Real mode is selected by NEXT_PUBLIC_DATA_BACKEND=cloudflare. D1 stores accounts, sessions, company profiles and products; database queries are scoped to the authenticated user. R2 stores private media using signed access.

Email-code authentication uses Resend. The session cookie is HTTP-only and SameSite=Lax, with secure transport in production; the server stores a hash of the session token. Authenticated API responses use no-store caching. The API error helper rethrows Next.js prerender control signals before logging ordinary application errors, preventing the misleading auth/me prerender error seen in build logs.

AI providers are Gemini through OpenRouter, Anthropic, mock or off. Provider keys stay on the server. With no usable keys, the default is the labelled mock. Explicit provider selection should be used in production. Paid calls require a signed-in session, permitted local demo access or the online demo unlock. Signed-in usage is checked against D1; anonymous unlocked-demo limits are process-local and should not be treated as a global spending cap.

## 7. Setup and configuration

From the app directory, install the locked dependencies with npm ci, then run npm run dev and open http://localhost:3000. Copy .env.example to .env.local for local configuration. Never commit or paste live secret values into documentation, client code or screenshots.

Mode: NEXT_PUBLIC_DATA_BACKEND is the public build-time switch; cloudflare enables account-backed storage. Database: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID and CLOUDFLARE_D1_API_TOKEN. Authentication: AUTH_SECRET (at least 32 characters), RESEND_API_KEY and AUTH_EMAIL_FROM. Apply the SQL migration in cloudflare/migrations/ before enabling real accounts.

Media: R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY, together with CLOUDFLARE_ACCOUNT_ID. R2 is optional for operating without photo uploads, but uploads are refused when it is absent. Configure bucket CORS for the actual localhost, preview and production origins needed by the application; keep credentials server-side.

AI: OPENROUTER_API_KEY and/or ANTHROPIC_API_KEY; AI_PROVIDER accepts gemini, anthropic, mock or off. Optional Google model overrides are OPENROUTER_MODEL, OPENROUTER_CATEGORY_MODEL, OPENROUTER_COPY_MODEL and OPENROUTER_IMAGE_MODEL. The code accepts only google/ model IDs for these overrides. DEMO_PASSCODE optionally enables the paid online demo for 12 hours; remove it when it is no longer required.

## 8. Vercel deployment and operations

Use the repository’s Git integration with Vercel and confirm the project root is app. Configure environment variable names in the appropriate Preview and Production scopes. Keep sensitive values server-only. A change to NEXT_PUBLIC_DATA_BACKEND requires a new build because it is included in browser code.

Before release, run npm test, npm run typecheck, npm run lint and npm run build. Inspect the Vercel build log for successful completion and unexpected errors. After deployment, test the landing page, signed-out /api/auth/me behaviour, catalogue loading, a product save and an image/PDF export. When real mode is enabled, test email delivery and media access with the intended account and domain.

Prior repository audit identified request/response size risks for base64 AI images and a mismatch between per-attempt AI retry timeouts and function duration. Confirm current Vercel platform limits before release and enforce a suitable aggregate image budget and total request deadline. Those operational risks are not resolved merely by the UI refresh.

## 9. Content safeguards and privacy

Built-in checks flag selected claim words, missing information, unconfirmed carton details and some strength mismatches. Schedule warnings and a trade-only footer support the review workflow. These checks are limited heuristics; they do not certify legal compliance, clinical correctness, approved indications or the suitability of an audience.

The research cites Indian pharmaceutical advertising and promotion rules as design context. Obtain qualified review of approved content, product schedules and distribution restrictions before a commercial rollout; the research summary is not a legal determination. Do not publish a medicine advertisement simply because the application’s checks pass.

AI reading sends selected carton images and prompts to the configured provider. Categorisation sends product text; promo generation sends its supplied inputs. Users should avoid patient information and other unnecessary personal data. Server secrets, private media keys and account information must never appear in public circulars. Demo browser storage is local persistence, not a backup service.

## 10. Verification status and launch boundaries

Current redesign checks on 22 October 2026: npm test passed all 226 tests across 15 files; npm run typecheck and npm run lint passed. Independent React review found no critical or high-severity issues; the safe-area right inset was corrected. Code review found no material issues. UI commit 9839a7e deployed successfully to Vercel through GitHub, and the live site shows the refreshed title. Live landing-page checks at widths 375, 768 and 1440 pixels found no horizontal overflow, missing images, broken section anchors or console errors. Three unused-font preload warnings were non-blocking. HTTP checks returned 200 for /, /icon.svg, /pwa-icon/192, /opengraph-image, /brand/dawakraft-logo.svg and /api/auth/me. A follow-up CSS adjustment hides the long header tagline at widths up to 560 pixels; deployment and visual verification of that final adjustment are still in progress. Authenticated catalogue search was not exercised because no test login was available; its underlying logic was unchanged and reviewed. Windows application control still blocks the local native compiler, including after an optional WebAssembly fallback attempt; successful hosted deployment does not establish a successful local production build.

Repository support does not establish that a live environment has every credential configured. Real email sign-in, D1/R2 configuration, device sharing and mobile camera workflows require environment-specific checks. This guide records implementation and research as of 22 October 2026 and does not claim live service connectivity or fresh market-price verification.

## 11. Validation roadmap

Interview at least five independent distributors, PCD owners or agents. Observe an actual product arrival and ask a buyer to retrieve a previously shared item. Measure findability, information errors, repeated use and quality preference; also measure time without assuming time savings.

Test willingness to pay with a specific offer or paid pilot. Clarify designer fee periods and the task those fees cover. Validate catalogue sharing permissions before building public links or team roles. Evaluate WhatsApp policy, consent and current API pricing before any automatic broadcast feature; manual sharing is the current path.

## 12. Sources and maintenance

Primary research: Founder Interview, SPARKIND (Hyderabad), 19 October 2026.
https://docs.google.com/document/d/1xuF4SkpWo-KZYo5wb5ODeS-G3NpxUR7YLzHY-9OZLXg

Secondary research: Pharma Circular & Catalog App, 17 October 2026.
https://docs.google.com/document/d/1rwm5XB6_qmtbntAz0vrM1xYfn75-y4RS_jGaPXKx45Q

Implementation anchors: app/package.json, .env.example, README.md, src/lib/config.ts, src/lib/ai/access.ts, src/lib/api/respond.ts, src/lib/auth/, src/lib/db/, src/components/ and cloudflare/migrations/. Some older architecture/workflow documentation still describes Supabase; the current implementation and this guide use Cloudflare. Re-check the code before reusing older setup instructions.

Update this guide whenever onboarding, storage mode, provider access, data sharing or deployment settings change. Record the verification date and actual test output after each release. Keep research claims attributed to their original dated source.

