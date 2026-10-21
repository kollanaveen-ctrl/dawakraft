# Dawakraft

Photograph a medicine box → remove the background → AI reads the specs → you confirm → compliance check → branded product circular (3 layouts) → searchable catalog → share on WhatsApp.

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

Your Claude key stays on the server. The phone never sees it, and only signed-in users can use the AI, with a limit of 20 box readings per 10 minutes per person.

---

## Try it right now (demo mode, no accounts needed)

Until real Supabase keys are in `.env.local`, the app runs in **demo mode**: no sign-in, and products, company details and photos are saved only in the browser you're using. A yellow "Demo mode" banner shows on every screen. Everything works except AI reading, which also needs a real Claude key. Run `npm install` once, then `npm run dev`, and open http://localhost:3000.

## Run it on your computer (about 20 minutes, one time)

You need **Node.js 20 or newer** (download the "LTS" version from nodejs.org).

### Step 1: Create the Supabase project (the database)

1. Go to **supabase.com**, sign up, and click **New project**. Pick the **Mumbai (ap-south-1)** region so it's fast in India.
2. When it's ready, open **SQL Editor → New query**. Open the file `supabase/migrations/0001_init.sql` from this folder, copy everything, paste it in, and press **Run**. This creates the tables and the private photo storage, and makes sure each user only sees their own data. Then do the same with `supabase/migrations/0002_segments.sql`, which adds the "new launch" date.
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

## How the app is organised

```
app/
  supabase/migrations/0001_init.sql   database tables, security rules, photo storage
  src/app/                            the pages (catalog, new product, product, company, import, login)
  src/app/api/read-box/               server function: sends box photos to Claude
  src/app/api/categorize/             server function: sorts imported products into categories
  src/components/                     the screens and the 5-step wizard
  src/lib/compliance.ts               trade-only rules and banned claim words
  src/lib/circular/                   draws the 3 circular layouts (1080 × 1350 PNG)
  src/lib/image/cutout.ts             background removal (runs on the phone, free)
  src/lib/image/packshot.ts           the 3D pack shot built from the front, side and top photos
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

In step 1, label each photo **Front**, **Side** (the side to the right of the front) or **Top**. If a Side or Top photo is labelled, step 2 wraps the photos onto a 3D box seen at an angle, with a soft shadow, and that picture goes on the circular. It runs on the phone in under a second and costs nothing. With only a front photo, the circular uses the flat photo as before. Bottles, tubes and blister strips aren't boxes, so for those, label just the front.

## How the catalog sorts itself

The catalog has three rows of filters, and they can be combined:

- **Launch:** New launches or Existing. Tick "This is a new launch" in step 3 (it's on by default for new products; imported products count as existing). After **60 days** a product moves to Existing on its own, and the "New launch" badge disappears from its circular and WhatsApp message. To change the 60 days, edit `NEW_LAUNCH_DAYS` in `src/lib/segments.ts`.
- **Category:** the therapy category, as before.
- **Company:** the "Marketed by" company, or "Manufactured by" if there's no marketer. Different spellings such as "Cipla Ltd." and "CIPLA LIMITED" are grouped together.

"Copy catalog list" copies only the products currently shown, so you can send one company's list or just the new launches.

## Good to know

- The compliance check covers common problems, not the full law. The licence holder stays responsible for the final circular.
- The AI never replaces checking the carton: the user must tick "I checked these details" before continuing, and fields the AI was unsure about are marked **Check this**.
- Schedule H, H1 and X products get a warning to share them only with doctors, chemists and the licensed trade.
