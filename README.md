# Dawakraft

**From a photo of a medicine box to a compliant, branded product circular, a printed-style catalogue and a WhatsApp message, in a few minutes, on a phone.**

Built for small pharma distributors, PCD companies and medical representatives in India, who today send blurry carton photos or pay a designer for every circular.

**Live demo:** https://dawakraft.vercel.app (the app itself is at `/catalog`)

```
Photo of the box → straightened 3D product picture → AI reads the carton → you confirm
→ compliance check → circular (5 designs) → catalogue + catalogue PDF → WhatsApp
```

---

## What it does

| Feature | In plain words |
|---|---|
| **Product picture** | Photograph the front, the left end and the strip, bottle or tube. The app straightens the box by itself and shows it at an angle with the real strip in front, the way printed pharma catalogues do. Built only from your photos, never drawn by AI. |
| **AI reads the carton** | Gemini (or Claude) reads brand, composition, pack, MRP, schedule, manufacturer and more. Every field shows which photo it came from and the exact printed words. The composition is always marked "check this". |
| **You confirm** | Nothing goes out until you tick "I checked these details against the carton". |
| **Compliance check** | Required fields, banned claim words (cure, guarantee, best, 100%…), a strength cross-check against the front of the pack, Schedule H / H1 / X warnings, and the trade-only line on every image. |
| **Five circular designs** | **Catalogue card** (a copy of the printed catalogue card, the default), **Promo circular** (a landscape visual aid, below), **Clean**, **Side band** and **Spotlight**. |
| **Promo circular** | Brand wordmark with its suffix badge (Doloride **SP**), ingredient tags, the "In" indications box, price ticket, headline and banner over a lifestyle photo. Colours match the pack. **AI writes the copy** from the composition and uses, and **AI can make the photo** (labelled "AI-generated image"). |
| **Catalogue** | Search, plus filters by launch (new launches move to Existing after 60 days), category and company. Import a list from Excel or CSV. |
| **Catalogue PDF** | Every product as a card, four to a page, with your logo, the section pill, "Product Catalogue 2026-27", the division bar and page numbers, like a bound catalogue. Download or share one PDF. |
| **Share** | WhatsApp image + message on phones, download, copy message. Works as an app from the home screen (PWA). |

---

## Try it now

- **Online:** open https://dawakraft.vercel.app and press **Try the free demo**. Everything is saved only in your browser. AI reading online needs the **demo passcode** (ask the team), until sign-in is switched on.
- **On your computer:** see [Run it on your computer](#run-it-on-your-computer) below. Without any keys the app runs in **demo mode**, and the AI gives clearly labelled sample answers, so the whole flow can be tried at no cost.

---

## How it's built

| Piece | What it does |
|---|---|
| **Next.js 16 + React 19** | The website and small server functions (`src/app/api`): the AI routes (read the box, sort categories, write promo copy, make a promo photo, unlock the demo), email-code sign-in, and the data and photo routes. |
| **Tailwind CSS 4** | Styling. Brand colours: pine `#0E5E4E`, marigold `#E9A23B`, kraft paper `#F6F4EE`. |
| **Canvas, on the phone** | Straightening, background removal, the 3D product picture, every circular and the catalogue PDF (jsPDF) are drawn on the device, free. |
| **Cloudflare D1 + R2** | D1 (SQLite) holds accounts, catalogs and company profiles; R2 holds the photos (private). The app reaches both over Cloudflare's API from Vercel, and every query is limited to the signed-in distributor's own rows. |
| **Resend** | Sends the 6-digit sign-in code by email. |
| **AI layer (`src/lib/ai`)** | Provider-independent: Google **Gemini via OpenRouter** (active), **Claude**, or a free **mock**. Keys stay on the server; paid AI needs sign-in (or the demo passcode) and has rate limits. |
| **Vercel** | Hosting (it stays the host; Cloudflare is only the database and photo store). Every push to `main` deploys automatically. |

---

## Run it on your computer

You need **Node.js 20 or newer** (the "LTS" version from nodejs.org).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. With no keys set, the app runs in demo mode.

### Settings (`.env.local`)

Copy `.env.example` to `.env.local` in the `app` folder and fill in what you have. **Never share or upload this file**; it's excluded from git.

| Setting | What it's for |
|---|---|
| `NEXT_PUBLIC_DATA_BACKEND` | `cloudflare` turns on real accounts and online storage. Unset: demo mode (saved in this browser only, no sign-in). Not a secret. |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_D1_API_TOKEN` | The D1 database and an API token allowed to edit it (server-only). |
| `AUTH_SECRET` | A long random secret (32+ characters) for sign-in codes. Server-only. |
| `RESEND_API_KEY`, `AUTH_EMAIL_FROM` | Sending the sign-in code. Without a key, `npm run dev` prints the code in the terminal (never on the live site). |
| `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Photo storage in R2. Without them, saving works but photo uploads are refused. |
| `OPENROUTER_API_KEY` | Google Gemini via OpenRouter: box reading, category sorting, promo copy and promo photos. |
| `ANTHROPIC_API_KEY` | Claude instead of Gemini (optional). |
| `AI_PROVIDER` | Optional: `gemini`, `anthropic`, `mock` or `off`. Unset picks Claude if its key is real, else Gemini, else the mock. A typo means off, never a paid service. |
| `OPENROUTER_MODEL`, `OPENROUTER_CATEGORY_MODEL`, `OPENROUTER_COPY_MODEL`, `OPENROUTER_IMAGE_MODEL` | Optional model overrides; only `google/` models are accepted. |
| `DEMO_PASSCODE` | Online demo only: lets people with the passcode use paid AI for 12 hours. Delete it once sign-in is on. |

Full details, limits and costs: [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

### Turning on real accounts (Cloudflare)

The website stays on Vercel; Cloudflare holds the data. Steps 1–2 are already done for the current database.

1. **Database (D1).** In the Cloudflare dashboard, **Storage & databases → D1 → Create** (done: the database ID is in `.env.local`). Put the account ID and database ID in `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_D1_DATABASE_ID`.
2. **Tables.** Apply `cloudflare/migrations/` with the Cloudflare CLI (done once; run again after adding a migration, it skips what's applied):
   ```bash
   cf d1 migrations apply <database id> --dir cloudflare/migrations
   ```
3. **D1 token.** **My Profile → API Tokens → Create Token → Custom token**, permission **Account → D1 → Edit**, this account only. Put it in `CLOUDFLARE_D1_API_TOKEN`.
4. **Sign-in secret.** Generate one and put it in `AUTH_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
5. **Email (Resend).** At **resend.com → API Keys**, create a key with sending access and put it in `RESEND_API_KEY`. Until you verify your own domain in Resend, codes reach **only your own Resend account email** (sender `Dawakraft <onboarding@resend.dev>`). To sign in other people, verify a domain and set `AUTH_EMAIL_FROM`, e.g. `Dawakraft <login@yourdomain.in>`.
6. **Photos (R2).** In the dashboard, enable **R2** (needs a payment method on file; the free tier covers small use), create a bucket (e.g. `dawakraft-media`, put its name in `R2_BUCKET`), then **R2 → Manage API tokens → Create** with **Object Read & Write** on that bucket only; copy the Access Key ID and Secret into `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. In the bucket's **Settings → CORS policy**, allow your sites to upload and view photos:
   ```json
   [{ "AllowedOrigins": ["http://localhost:3000", "https://your-site.vercel.app"], "AllowedMethods": ["GET", "PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
7. **Switch it on.** Set `NEXT_PUBLIC_DATA_BACKEND=cloudflare` in `.env.local` (and in Vercel), and restart. If the switch is on but a setting is missing, the app says "isn't connected yet" instead of saving.

---

## Put it online (Vercel)

1. Import this GitHub repository at **vercel.com → Add New → Project** and keep the defaults.
2. Under **Settings → Environment Variables**, add the same settings as `.env.local` (mark keys as Sensitive), then redeploy.
3. If real accounts are on, add the Vercel link to the R2 bucket's CORS policy (step 6 above) and redeploy after changing `NEXT_PUBLIC_DATA_BACKEND` (it is built into the page).
4. On a phone, open the link and choose **Add to Home screen**.

---

## Using it

**New product (5 steps):** Photos → Clean up → Details → Check → Circular.

- **Photos:** one pack per photo on a **dark plain sheet** (white only for dark or amber bottles), in daylight, without flash. Stand about 1 m back and zoom 2×. Label them **Front**, **Left end**, **Top**, **Strip / bottle / tube** (then pick its type) or **Other side**.
- **Clean up:** the box is straightened automatically. If an edge can't be found, retake the photo on a dark sheet, or crop it in your gallery and tick **Photos are cropped to the box**.
- **Details:** press **Read box with AI**, then check every field against the carton. Add **Uses (indications)** for the Catalogue card and Promo circular.
- **Check:** fix anything red. **Circular:** pick a design and save.

**Promo circular:** on a product page choose **Promo circular → Edit promo content**. Press **Write copy with AI** and edit every line; add a photo by uploading one you have the rights to, or **Make a photo with AI** (about ₹7 each). Banned words block sharing; strong claims (prevents, rapid, FDA, effective…) need your tick "I checked these claims", and any later edit asks again.

**Catalogue PDF:** on the Catalog screen press **Catalogue PDF**, set the title and division, then Download or Share.

---

## Project structure

```
app/
  src/app/                  pages: landing (/), catalog, new, product/[id] (+ edit, promo), import, export, company, login
  src/app/api/              AI: read-box, categorize, write-copy, promo-photo, demo-unlock; auth/ (email code); data/ (products, company); media/ (R2 photos)
  src/components/           screens, the 5-step wizard, promo editor, catalogue PDF screen
  src/lib/ai/               AI contract, providers (gemini, anthropic, mock), prompts, access + limits
  src/lib/image/            edge finding, straightening, background removal, 3D box, strip/bottle placement
  src/lib/circular/         the five circular designs (promo/ = the landscape Promo circular)
  src/lib/catalog/          catalogue pages and the PDF
  src/lib/compliance.ts     the compliance checklist; promo.ts holds promo content and claim checks
  src/lib/data/             the API routes and demo (browser) storage behind one interface (repo.ts)
  src/lib/cloudflare/       D1 client (REST API), R2 signed links, photo key rules
  src/lib/auth/, src/lib/db/  sign-in codes and sessions; owner-scoped SQL and request schemas
  cloudflare/migrations/    D1 database setup (SQLite)
  docs/                     product plan, architecture, workflows, design system, SEO, integrations, testing, roadmap, ADRs
```

---

## Checks

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```

`npm test` runs 176 automated checks (compliance rules, AI request and answer handling, image geometry, catalogue pages, promo claims and more). No real AI calls are made in tests.

---

## Documentation

| Document | What's in it |
|---|---|
| [Product plan](docs/PRODUCT_PLAN.md) | Who it's for, problems it solves, features and priorities. |
| [Architecture](docs/ARCHITECTURE.md) | Stack, module map, data model, API contracts, security, deployment. |
| [Workflows](docs/WORKFLOWS.md) | Every user journey step by step, with failures and recovery. |
| [Design system](docs/DESIGN_SYSTEM.md) | Logo, colours, fonts, components, accessibility. |
| [Integrations](docs/INTEGRATIONS.md) | Cloudflare D1 and R2, Resend, Gemini via OpenRouter, Claude, the mock, the demo passcode, Vercel. |
| [SEO plan](docs/SEO_PLAN.md) | Search-engine setup and checks. |
| [Testing](docs/TESTING.md) | Commands, results, manual checks, known gaps. |
| [Roadmap](docs/ROADMAP.md) | Done, in progress, next. |
| [Decision records](docs/adr/README.md) | Why the big choices were made (ADRs 0001–0006). |

---

## Good to know

- **The licence holder stays responsible** for every circular. The compliance check catches common problems, not the full law.
- **AI never replaces checking the carton.** Fields the AI was unsure about are marked **Check this**, and the composition is always flagged.
- **AI never draws the product.** Pack pictures come only from your photos; AI photos show a made-up scene and are labelled.
- **Schedule H, H1 and X** products carry a warning to share them only with doctors, chemists and the licensed trade.
- **Not yet done:** real sign-in on the live site (the Cloudflare tokens, Resend key and R2 still need adding), end-to-end browser tests, and testing on real phones with real cartons. See the [Roadmap](docs/ROADMAP.md).
