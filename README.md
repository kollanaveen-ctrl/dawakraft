# Dawakraft

Photograph a medicine box → remove the background → AI reads the specs → you confirm → compliance check → branded product circular (4 layouts, including a "Catalogue card" copy of the printed catalogue) → searchable catalog → share on WhatsApp.

Built for small pharma distributors, PCD companies and agents in India. Each distributor signs in with their email and sees only their own catalog and branding.

---

## What's inside, in plain words

| Piece | What it does |
|---|---|
| **Next.js** | The website itself, plus two small server functions that talk to the AI. |
| **Tailwind** | The styling system. The colours, fonts and look are the same as the original prototype. |
| **Supabase** | The online database and photo storage. It keeps products, the company profile and box photos, and handles email sign-in. |
| **Claude (Anthropic)** | Reads the printed text on the box photos and fills in the form. |
| **Vercel** | Free hosting that gives you a public link. |
| **PWA** | Lets people tap "Add to Home screen" so it opens like an app. |

Your Claude key stays on the server. The phone never sees it, and only signed-in users can use the paid Claude reading, with a limit of 20 box readings per 10 minutes per person. Without a key, a free sample reader fills in clearly labelled demo values instead.

---

## Try it right now (demo mode, no accounts needed)

Until real Supabase keys are in `.env.local`, the app runs in **demo mode**: no sign-in, and products, company details and photos are saved only in the browser you're using. A yellow "Demo mode" banner shows on every screen. Everything works; until a real Claude key is added, "Read box with AI" gives a clearly labelled sample reading instead of reading your photos (see `AI_PROVIDER` below). Run `npm install` once, then `npm run dev`, and open http://localhost:3000.

**Where things are:** http://localhost:3000/ is the public home page (the one search engines see). The app itself starts at **/catalog** ("Open the app" or "Try the free demo" on the home page).

### Choosing the AI: `AI_PROVIDER`

Without a Claude key the app uses a free **mock** reader: it fills the form with the same made-up sample carton every time and clearly says "Sample reading: these are demo values, not read from your photos". That lets you try the whole flow at no cost. You can choose the reader with one optional line in `.env.local` (or in Vercel's Environment Variables):

| Setting | What happens |
|---|---|
| *(not set)* | Claude when `ANTHROPIC_API_KEY` is a real key, otherwise the mock. |
| `AI_PROVIDER=anthropic` | Always Claude. Without a key, AI buttons say AI isn't set up (no samples). |
| `AI_PROVIDER=mock` | Always the labelled mock, even if a key is present. |
| `AI_PROVIDER=off` | AI switched off; type details by hand. |
| anything else | Treated as `off`, so a typo can never switch on a paid service. |

Details in [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## Run it on your computer (about 20 minutes, one time)

You need **Node.js 20 or newer** (download the "LTS" version from nodejs.org).

### Step 1: Create the Supabase project (the database)

1. Go to **supabase.com**, sign up, and click **New project**. Pick the **Mumbai (ap-south-1)** region so it's fast in India.
2. When it's ready, open **SQL Editor → New query**. Open the file `supabase/migrations/0001_init.sql` from this folder, copy everything, paste it in, and press **Run**. This creates the tables and the private photo storage, and makes sure each user only sees their own data. Then do the same with `supabase/migrations/0002_segments.sql`, which adds the "new launch" date, and then `supabase/migrations/0003_uses.sql`, which adds the optional "Uses (indications)" field shown on the Catalogue card.
3. Open **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000` (change it to your Vercel link after step 6)
   - **Redirect URLs:** add `http://localhost:3000/auth/callback`
4. (Recommended) Open **Authentication → Emails → Magic Link** and add this line to the email body so people can type a code if the link opens in the wrong browser:
   `Your code: {{ .Token }}`
5. Open **Project Settings → API keys** (or the **Connect** button) and keep two values handy: the **Project URL** and the **publishable** key (older projects call it the **anon** key).

> Supabase's built-in email sender only sends a few emails per hour, which is fine for testing and a demo. For real users, connect your own email service under Authentication → SMTP.

### Step 2: Get a Claude API key (the AI)

Go to **console.anthropic.com → API keys → Create key**. Add a little credit under Billing; each box reading costs a few rupees at most.

### Step 3: Put the keys in a settings file

In the `app` folder, open the file `.env.local` (copy `.env.example` and rename it if `.env.local` isn't there). Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...your Project URL...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...your publishable key...
ANTHROPIC_API_KEY=...your Claude key...
```

Never share this file or upload it anywhere. It's already excluded from git.

### Step 4: Start the app

Open a terminal in the `app` folder and run these two commands (the first one only the first time):

```bash
npm install
```

```bash
npm run dev
```

Open **http://localhost:3000**, type your email, and click the link in the email (or type the code).

**Try it on your phone on the same Wi-Fi:** the terminal prints a "Network" address such as `http://192.168.1.5:3000`. The camera button works there, but email links point to `localhost`, so use the code from the email to sign in.

---

## Put it online (Vercel)

1. Put this `app` folder on GitHub (GitHub Desktop is the easiest way).
2. Go to **vercel.com → Add New → Project**, pick the repository, and keep the defaults.
3. Under **Environment Variables**, add the same three values from `.env.local`.
4. Click **Deploy**. You'll get a link like `https://dawakraft.vercel.app`.
5. Back in Supabase **Authentication → URL Configuration**, set **Site URL** to that link and add `https://your-link/auth/callback` to **Redirect URLs**.
6. On a phone, open the link and choose **Add to Home screen** (Chrome: ⋮ menu; iPhone Safari: Share button).

---

## Online demo passcode

While the online site has no login, paid AI (box reading and category sorting) is off for visitors. A shared passcode turns it on for people you trust:

1. In **Vercel → Project → Settings → Environment Variables**, add `DEMO_PASSCODE` for **Production** with a long, unguessable value (it must not contain `your-`, `example`, `placeholder` or `xxxx`, or it counts as unset), then redeploy.
2. Share it only with your team and the judges. Visitors type it into the **Demo passcode** box that appears under "Read box with AI" (or "Fill missing categories with AI") and press **Unlock AI**.
3. That browser is unlocked for 12 hours (an httpOnly cookie signed with the passcode). Changing `DEMO_PASSCODE` cancels every unlock at once.
4. **Delete `DEMO_PASSCODE` once login exists.**

Limits for unlocked visitors, per IP address and per server instance: 8 passcode tries, 15 box reads and 6 category sorts per 10 minutes. Without `DEMO_PASSCODE` (or with a placeholder value) nothing changes.

## How the app is organised

```
app/
  supabase/migrations/0001_init.sql   database tables, security rules, photo storage
  src/app/                            the pages (catalog, new product, product, company, import, login)
  src/app/api/read-box/               server function: sends box photos to Claude
  src/app/api/categorize/             server function: sorts imported products into categories
  src/components/                     the screens and the 5-step wizard
  src/lib/compliance.ts               trade-only rules and banned claim words
  src/lib/circular/                   draws the 4 circular layouts (1080 × 1350 PNG)
  src/lib/image/corners.ts            finds the edges of each box photo by itself
  src/lib/image/straighten.ts         straightens each box face to a flat rectangle
  src/lib/image/cutout.ts             background removal (runs on the phone, free)
  src/lib/image/packshot.ts           the 3D box built from the front, left end and top photos
  src/lib/image/companion.ts          places your strip, bottle or tube photo in front of the box
  src/lib/segments.ts                 catalog segments: company, new launch vs existing
  src/lib/ai/                         the AI prompt and how its answer fills the form
```

## Checks

```bash
npm test
```

```bash
npm run build
```

`npm test` runs automated checks of the compliance rules, AI answer handling, CSV import and message text. `npm run build` makes sure the whole app compiles.

## 3D pack shots

The product picture is built only from your own photos. It is never drawn by AI, so the strength and the design on the pack stay exactly as printed.

In step 1, label each photo:

- **Front**: the main face with the brand name. Every product needs one.
- **Left end**: the narrow side on the left of the front, the same way the printed catalogue shows it.
- **Top**: the top of the box.
- **Strip / bottle / tube**: one photo of the real strip, bottle or tube. Then pick its type from the list: Strip (blister or alu-alu), Bottle or vial, or Tube.
- **Other side**: any other face. The AI reads it for details, but it isn't used in the picture.

In step 2 the app straightens each box photo by itself, so there are no dots to move. It turns the front, left end and top into a box seen slightly from the left, places your strip, bottle or tube in front of the box, and adds soft shadows. It runs on your phone and costs nothing.

If the app can't find the edges of a photo, it uses that photo as you took it and tells you. To fix it, either:

- retake the photo on a dark plain sheet, or
- crop the photo to the box in your phone's gallery and tick **Photos are cropped to the box** in step 2. The photos are then used as they are.

**Tips for good photos:**

- Use a dark plain sheet (black chart paper) for boxes and silver strips. Use white paper only for dark or amber bottles.
- Shoot in daylight, without flash.
- Stand about 1 metre back and zoom in 2×, so the edges look straight.

With only a front photo, the box still looks 3D. The app fills in the end and top from the colours along the edges of the front.

## How the catalog sorts itself

The catalog has three rows of filters, and they can be combined:

- **Launch:** New launches or Existing. Tick "This is a new launch" in step 3 (it's on by default for new products; imported products count as existing). After **60 days** a product moves to Existing on its own, and the "New launch" badge disappears from its circular and WhatsApp message. To change the 60 days, edit `NEW_LAUNCH_DAYS` in `src/lib/segments.ts`.
- **Category:** the therapy category, as before.
- **Company:** the "Marketed by" company, or "Manufactured by" if there's no marketer. Different spellings such as "Cipla Ltd." and "CIPLA LIMITED" are grouped together.

"Copy catalog list" copies only the products currently shown, so you can send one company's list or just the new launches.

## Project docs

| Document | What's in it |
|---|---|
| [Product plan](docs/PRODUCT_PLAN.md) | Who it's for, problems it solves, features and priorities, key decisions. |
| [Architecture](docs/ARCHITECTURE.md) | The stack, module map, data model, API contracts, security, deployment. |
| [Workflows](docs/WORKFLOWS.md) | Every user journey step by step, with failures and recovery. |
| [Design system](docs/DESIGN_SYSTEM.md) | Logo, colours, fonts, components, states, accessibility rules. |
| [SEO plan](docs/SEO_PLAN.md) | What's done for search engines, how it was checked, next steps. |
| [Integrations](docs/INTEGRATIONS.md) | Supabase, Claude, the mock AI, Vercel: settings, limits, costs, status. |
| [Testing](docs/TESTING.md) | Commands, current results, manual checks, known gaps. |
| [Roadmap](docs/ROADMAP.md) | What's done, what's left, what comes next. |
| [Decision records (ADRs)](docs/adr/README.md) | Why the big choices were made: [0001 Next.js + Supabase](docs/adr/0001-nextjs-supabase.md), [0002 demo mode](docs/adr/0002-demo-mode-browser-storage.md), [0003 provider-independent AI](docs/adr/0003-provider-independent-ai.md), [0004 on-device pack shots](docs/adr/0004-on-device-pack-shots.md), [0005 landing at `/`, app at `/catalog`](docs/adr/0005-public-landing-and-catalog-route.md), [0006 automatic straightening and the catalogue-style picture](docs/adr/0006-automatic-straightening-and-catalogue-product-picture.md). |

## Good to know

- The compliance check covers common problems, not the full law. The licence holder stays responsible for the final circular.
- The AI never replaces checking the carton: the user must tick "I checked these details" before continuing, and fields the AI was unsure about are marked **Check this**.
- Schedule H, H1 and X products get a warning to share them only with doctors, chemists and the licensed trade.
