# Dawakraft integrations

> Status: living document. Last checked against the code on 2026-10-22.
> Related: [ARCHITECTURE](ARCHITECTURE.md) · [ADR 0001](adr/0001-nextjs-supabase.md) · [ADR 0003](adr/0003-provider-independent-ai.md)

Prices and free-tier limits change often. Where a number below isn't taken from the code, **check the provider's current terms** before relying on it.

## Summary

| Service | Purpose | Status today |
|---|---|---|
| **Supabase** | Database, email sign-in, photo storage | Code ready, **not connected** (no keys). The app runs in demo mode. |
| **Anthropic Claude** | Reads the carton; sorts imported products into categories | Code ready, **no key yet**. |
| **Mock AI provider** | Free, labelled sample answers | **Active by default** while there is no Claude key. |
| **Vercel** | Hosting | **Live** at https://dawakraft.vercel.app, auto-deploys from GitHub `main`. |
| Google Fonts (via `next/font`) | Bricolage Grotesque, Instrument Sans, JetBrains Mono | Downloaded at build time and served from the site itself. |
| WhatsApp | Sharing | No account or API: the phone's share sheet, or a `https://wa.me/?text=…` link. |

## Environment variables

Set them in `.env.local` on your computer and in **Vercel → Project → Settings → Environment Variables** online. `NEXT_PUBLIC_` values are copied into the browser code when the site is built, so **redeploy after changing them**.

| Variable | Where it's used | Secret? | Meaning |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/config.ts`, Supabase clients, `src/proxy.ts` | No | Your project URL, e.g. `https://abcd.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same | No (safe in the browser; row-level security protects data) | The publishable key (older projects: the "anon" key). |
| `ANTHROPIC_API_KEY` | `src/lib/ai/providers/anthropic.ts`, `src/lib/ai/index.ts` | **Yes. Never prefix with `NEXT_PUBLIC_`.** | Claude API key. |
| `AI_PROVIDER` | `src/lib/ai/index.ts` | No | `anthropic`, `mock` or `off`. See below. |
| `NEXT_PUBLIC_SITE_URL` | `src/lib/site.ts` | No | Public address for canonical links, sitemap and share cards. Default `https://dawakraft.vercel.app`. |

A value that is empty or still contains `your-`, `your_`, `example`, `placeholder` or `xxxx` counts as **not set** (`isRealValue` in `config.ts`). That is how the copied `.env.example` placeholders keep the app in demo mode.

### `AI_PROVIDER`

| Value | Result |
|---|---|
| unset | Claude if `ANTHROPIC_API_KEY` is real, otherwise the **mock**. |
| `anthropic` | Claude. If the key is missing, the AI routes answer `not_configured` (no quiet fallback to samples). |
| `mock` | The mock, even if a key exists. |
| `off` | AI switched off: both AI routes answer `not_configured`. |
| anything else (a typo such as `of`) | Treated as **`off`**, never as a paid provider. |

Upper/lower case and surrounding spaces are ignored.

---

## Supabase

**Purpose:** Postgres database (`companies`, `products`, `ai_usage`), email one-time-code sign-in (magic link and 6-digit code), and the private `media` bucket for product pictures and logos. Row-level security makes every row and file visible only to its owner. Schema: `supabase/migrations/0001_init.sql` and `0002_segments.sql`.

**Free tier (check current terms):** Supabase offers a free plan suitable for a pilot, with limits on database size, storage, monthly active users and bandwidth, and free projects pause after a period of inactivity. The **built-in email sender only sends a few emails per hour**; for real users, connect your own SMTP under Authentication → SMTP.

**Credentials needed:** a Supabase account and project (README suggests the Mumbai `ap-south-1` region); the Project URL and publishable key.

**Setup:** README "Step 1". Run both migration files in the SQL Editor, set Site URL and the `/auth/callback` redirect URL, optionally add `Your code: {{ .Token }}` to the Magic Link email so people can type the code.

**Status:** code ready, not connected. Sign-in, the database, storage and the shared AI usage limit are untested against a real project.

---

## Anthropic Claude

**Purpose:** "Read box with AI" (`/api/read-box`) and "Fill missing categories with AI" (`/api/categorize`).

**How it's called** (`providers/anthropic.ts`): model `claude-opus-5-5` via `beta.messages.parse` with structured output from the zod schema, so the reply must have all 11 fields with value, confidence, source panel and exact quote. Effort `medium` for reading and `low` for sorting; `max_tokens` 8000 / 16000; 2 retries; 90-second timeout; server-side fallback beta enabled. Each call logs latency, tokens and an estimated cost to the **server** log.

**Cost:** list prices used in the code are **$4 per million input tokens and $20 per million output tokens** (Opus 5.5). One box reading (up to 4 photos of at most 1280 px, plus the prompt and a short JSON answer, thinking included) comes to roughly **₹2–15**, depending on how many photos are sent and how much the model thinks. Category sorting of up to 150 products is one call.

**Cost controls already in the code:** paid AI needs a signed-in user (or demo mode on your own computer); 20 readings and 10 sorts per user per 10 minutes (in-memory per server plus a shared count in `ai_usage`, recorded first and then counted so simultaneous requests can't all slip through); token caps and a timeout; request bodies over 13 MB are refused before being read.

**Recommended:** set a **monthly spend limit** in the Anthropic console (Billing / Limits) before adding the key to Vercel, and check the usage page after the first week.

**Credentials needed:** an Anthropic console account, billing credit, an API key.

**Status:** code ready, no key yet. Real readings have not been tested.

---

## Mock provider

**Purpose:** let the whole wizard and import run with no key and no cost, without pretending to be real (`providers/mock.ts`).

- Returns the same made-up carton every time ("Demozith 500", Azithromycin IP 500 mg, Schedule H, "Sample Pharma Pvt. Ltd."), every field `low` confidence, after a 600 ms pause. The photos are **not** looked at.
- `meta.mock = true`, so the app shows "Sample reading: these are demo values, not read from your photos…" and evidence lines start with "Demo value, not from your photos:". Imports say "Sample categories (demo)".
- Categories come from simple keyword rules (e.g. "…mycin" → Antibiotic).
- `paid: false`: no sign-in and no rate limit.

**Status:** active by default (no `ANTHROPIC_API_KEY`, `AI_PROVIDER` unset), including on the live site.

---

## Vercel

**Purpose:** builds and hosts the site, runs the two API routes and `proxy.ts`.

**Free tier (check current terms):** the Hobby plan is free for personal, non-commercial projects; commercial use needs a paid plan. Function duration, bandwidth and build minutes are limited. The AI routes set `maxDuration = 120` seconds, which must be allowed by your plan.

**Status:** live at https://dawakraft.vercel.app, auto-deploys from GitHub `main` (configured in Vercel; there is no `vercel.json`). No Supabase or Claude variables are set yet, so the live site is in demo mode with the mock AI.

---

## Free alternatives for AI reading

These are **not wired in**. They are options if Claude's cost is a concern.

| Option | What it offers | Trade-offs (honest) |
|---|---|---|
| **Google Gemini API, free tier** | Vision models that can read images and return JSON; a free tier with per-minute and per-day request limits (check current terms). | Free-tier data may be used by Google to improve its products (check current terms) — think about whether carton photos are acceptable to share on those terms. Limits can change. Accuracy on small, curved or glossy carton print must be measured on real cartons before trusting it; the evidence/quote rules must hold. |
| **Hugging Face** (Inference Providers, or a self-run open vision model) | Open vision-language and OCR models; a small free monthly credit (check current terms), or run a model on your own machine. | Free credit is small and rate-limited; free hosted models can be slow or cold-start. Open models are generally weaker at following a strict JSON schema and at reading tiny print, so more fields would come back wrong or empty. Self-hosting needs a GPU. |

Whatever is chosen, the app's safety nets stay: every field must be confirmed by a person, composition is always flagged, and the front-strength cross-check still blocks a mismatch.

### Exact steps to add a provider

From the comment at the top of `src/lib/ai/index.ts`:

1. Write `src/lib/ai/providers/<name>.ts` exporting an `AiProvider` (see `src/lib/ai/types.ts`) with `id`, `paid`, `readBox()` and `categorize()`.
2. `readBox()` must return data shaped like `BoxReadingSchema`: every field with `value`, `confidence` (`high`/`low`), `source` (`front`/`side`/`top`/`other` or null) and an exact `quote` from the photo, plus a truthful `meta` (`provider`, `model`, `mock: false`, `latencyMs`, optional `usage`). Reuse `boxReadPrompt()` from `box-read.ts`. Throw `AiError` with the right code (`not_configured`, `rate_limited`, `image_rejected`, `invalid_json`, `refused`, `failed`).
3. Set **`paid` correctly.** `true` keeps sign-in and the rate limits in front of it; a free-tier API that can still run out or bill you should be `true`.
4. Add its id to `PROVIDER_IDS` and a `case` in `pick()` in `index.ts` (check its key with `isRealValue`, and return `not_configured` when missing). Decide whether the unset default should ever choose it.
5. Add its key to `.env.example` (server-only, no `NEXT_PUBLIC_`).
6. Add contract tests in `src/lib/__tests__/` that run against **recorded responses** from the real service, including a refusal and a malformed reply.
7. Test on real cartons (including the strength mismatch case) before switching `AI_PROVIDER` on the live site.
