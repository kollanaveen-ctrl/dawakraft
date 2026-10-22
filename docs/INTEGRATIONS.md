# Dawakraft integrations

> Status: living document. Last checked against the code on 2026-10-22.
> Related: [ARCHITECTURE](ARCHITECTURE.md) · [ADR 0001](adr/0001-nextjs-supabase.md) · [ADR 0003](adr/0003-provider-independent-ai.md)

Prices and free-tier limits change often. Where a number below isn't taken from the code, **check the provider's current terms** before relying on it.

## Summary

| Service | Purpose | Status today |
|---|---|---|
| **Supabase** | Database, email sign-in, photo storage | Code ready, **not connected** (no keys). The app runs in demo mode. |
| **Anthropic Claude** | Reads the carton; sorts imported products into categories | Code ready, **no key yet**. |
| **Google Gemini via OpenRouter** | Reads the carton; sorts categories (Google models only) | **Active** when `OPENROUTER_API_KEY` is set (and no Claude key), or with `AI_PROVIDER=gemini`. |
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
| `OPENROUTER_API_KEY` | `src/lib/ai/providers/gemini.ts`, `src/lib/ai/index.ts` | **Yes. Never prefix with `NEXT_PUBLIC_`; never log or commit it.** | OpenRouter key for Google Gemini. |
| `OPENROUTER_MODEL` | `src/lib/ai/providers/gemini.ts` | No | Optional box-reading model. Must start with `google/`, otherwise the default `google/gemini-3.7-flash` is used. |
| `OPENROUTER_CATEGORY_MODEL` | same | No | Optional category model. Must start with `google/`, otherwise the default `google/gemini-3.5-flash-lite` is used. |
| `OPENROUTER_COPY_MODEL` | same | No | Optional copywriter model (`/api/write-copy`). Must start with `google/`, otherwise the default `google/gemini-3.7-flash` is used. |
| `OPENROUTER_IMAGE_MODEL` | same | No | Optional lifestyle-photo model (`/api/promo-photo`). Must start with `google/`, otherwise the default `google/gemini-3.1-flash-image` is used. |
| `AI_PROVIDER` | `src/lib/ai/index.ts` | No | `anthropic`, `gemini`, `mock` or `off`. See below. |
| `NEXT_PUBLIC_SITE_URL` | `src/lib/site.ts` | No | Public address for canonical links, sitemap and share cards. Default `https://dawakraft.vercel.app`. |
| `DEMO_PASSCODE` | `src/lib/ai/unlock.ts`, `src/app/api/demo-unlock/route.ts`, `src/lib/ai/access.ts` | **Yes. Never prefix with `NEXT_PUBLIC_`; never log or commit it.** | Optional online demo passcode that unlocks paid AI without sign-in. See "Online demo passcode". |

A value that is empty or still contains `your-`, `your_`, `example`, `placeholder` or `xxxx` counts as **not set** (`isRealValue` in `config.ts`). That is how the copied `.env.example` placeholders keep the app in demo mode.

### `AI_PROVIDER`

| Value | Result |
|---|---|
| unset | Claude if `ANTHROPIC_API_KEY` is real, else Gemini if `OPENROUTER_API_KEY` is real, otherwise the **mock**. |
| `gemini` | Google Gemini via OpenRouter. If the key is missing, the AI routes answer `not_configured`. |
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

## Google Gemini via OpenRouter (active)

**Purpose:** the same two routes as Claude, served by Google Gemini (`providers/gemini.ts`).

**Rules (enforced in the code and the tests):**

- **Google models only.** Defaults: `google/gemini-3.7-flash` for box reading, `google/gemini-3.5-flash-lite` for categories. `OPENROUTER_MODEL` / `OPENROUTER_CATEGORY_MODEL` may override them, but any value not starting with `google/` is ignored.
- **Only through OpenRouter:** `POST https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer $OPENROUTER_API_KEY`. Google AI Studio or Vertex are never called directly.
- Every request carries `"provider": { "only": ["google-vertex", "google-ai-studio"], "allow_fallbacks": false, "require_parameters": true }`, so OpenRouter can't route to another vendor.
- The key lives only in the server environment and is never logged or sent to the browser.

**How it's called:** one user message with the photos as `image_url` data URLs followed by `boxReadPrompt()`; structured output via `response_format: json_schema` (`strict: true`) generated from the zod schemas with `z.toJSONSchema`; the reply is parsed and validated again with zod. `max_tokens` 8000 for reading (Gemini thinks first; a smaller cap can return no content) and 16000 for sorting; 90-second timeout per attempt. Each call logs provider, model, latency, tokens and OpenRouter's reported cost to the **server** log.

**Errors:** 402 (out of credits) and 403 (key budget limit) → `out_of_credits` (HTTP 402; the app says "The AI credits have run out…"), no retry. 429 and 5xx → up to 3 retries with exponential backoff (1 s, 2 s, 4 s, or the `Retry-After` header), then `rate_limited` (429) or `failed`. 400 → `failed` (OpenRouter's message goes to the server log only). Empty content or `finish_reason: "length"` → `invalid_json`.

**Cost:** OpenRouter returns the real cost of each call in `usage.cost` (USD), which becomes `meta.usage.estCostUsd`. In testing, a short text call cost **$0.00** as reported by OpenRouter for this key. Box readings use `gemini-3.7-flash` at **$0.75 per million input tokens and $3.75 per million output tokens** (check current OpenRouter prices).

**Cost controls:** `paid: true`, so the same sign-in (or demo mode on your own computer only) and per-user rate limits apply as for Claude. Set a credit limit on the OpenRouter key.

**Status:** code ready and covered by tests with a stubbed `fetch` (no test calls the real API). Accuracy on real cartons still needs checking.

---

## Gemini copywriter and lifestyle photo (promotional circular)

**Purpose:** two extra routes for the promotional circular, served by the same provider layer (`src/lib/ai`).

| Route | Provider method | Default model (override, `google/` only) | Signed-in limit | Passcode limit (per IP) |
| --- | --- | --- | --- | --- |
| `POST /api/write-copy` | `writeCopy` (anthropic, gemini, mock) | `google/gemini-3.7-flash` (`OPENROUTER_COPY_MODEL`) | 20 / 10 min | 10 / 10 min |
| `POST /api/promo-photo` | `makePhoto` (gemini only) | `google/gemini-3.1-flash-image` (`OPENROUTER_IMAGE_MODEL`) | 6 / 10 min | 3 / 10 min |

Both use `checkAiAccess` like `/api/read-box` (sign-in, local demo mode, or the demo passcode cookie for paid providers), `readJsonBody`, and the same OpenRouter call: pinned `provider` block, retries on 429/5xx, 402/403 → `out_of_credits` (HTTP 402). Usage is counted in `ai_usage` with kinds `copy` and `photo` (run `supabase/migrations/0004_promo.sql` first).

**Copywriter** (`promo-copy.ts`): structured output (`json_schema`, strict) with `max_tokens` 6000. The prompt: trade-only copy for doctors and chemists in India in the style of Indian pharma visual aids; use only the composition, form and uses; one section per active ingredient (max 3) with short factual bullets; indications only from `uses`; never invent indications, studies, statistics, percentages, comparisons or approvals; never the banned words (cure, guarantee, 100%, miracle, permanent, no side effects, instant relief, best, safest, No. 1, #1, risk-free); avoid strong claims (prevents, complete, rapid, fast, quick, FDA, proven, safe, superior, maximum, potent, effective, significant, new generation); no emoji or exclamation marks. **Enforced on the server whatever the model returns:** limits (headline 60, banner 30, tagline 45, section title 40, 1-3 sections × 1-3 bullets of 90, up to 7 indications of 50), exclamation marks and emoji removed, and any indication not in `uses` dropped. The route then runs `promoClaims` and returns `{ copy, claims: { banned, strong } }`, so the UI can block banned words and ask the person to confirm strong claims. The mock returns clearly labelled sample copy (`meta.mock: true`, banner "SAMPLE COPY").

In testing (one real call, Calcium Carbonate + Vitamin D3): HTTP 200 in 8.1 s, 723 input and 1,141 output tokens (Gemini thinks first), no banned words or strong claims; OpenRouter reported `usage.cost` 0 for this key (about $0.005 at list price).

**Photo** (`promo-photo.ts`): chat completions with `modalities: ["image", "text"]` and `image_config: { aspect_ratio: "4:3" }`; the image comes back as a base64 data URL in `choices[0].message.images[0].image_url.url` and is returned as `{ mediaType, data }` (png, jpeg or webp). No image → `failed`; a safety stop → `refused`. **Safety rules in the prompt:** a fictional adult Indian person (or family) in a calm everyday scene picked from a fixed list by the uses or category (never distressing), natural soft light, subject on the right half of a landscape 4:3 frame with the left half plain for text; no text, letters, logos, watermarks, medicine packs, pills, syringes, blood, wounds, rashes, lesions or disease close-ups; no celebrities or real identifiable people. The user's text only selects the scene and is never copied into the prompt. Prompts are never logged. Claude and the mock have no `makePhoto`, so the route answers `photo_unavailable` (HTTP 501) before any cost, and the UI uses a colour background. **Cost:** image output is about $60 per million tokens (one 1K image is roughly 1,300 tokens, so around $0.08; check OpenRouter). **Status:** covered by tests with a stubbed fetch; no real image call has been made yet (the first one needs the owner's approval).

---

## Mock provider

**Purpose:** let the whole wizard and import run with no key and no cost, without pretending to be real (`providers/mock.ts`).

- Returns the same made-up carton every time ("Demozith 500", Azithromycin IP 500 mg, Schedule H, "Sample Pharma Pvt. Ltd."), every field `low` confidence, after a 600 ms pause. The photos are **not** looked at.
- `meta.mock = true`, so the app shows "Sample reading: these are demo values, not read from your photos…" and evidence lines start with "Demo value, not from your photos:". Imports say "Sample categories (demo)".
- Categories come from simple keyword rules (e.g. "…mycin" → Antibiotic).
- `paid: false`: no sign-in and no rate limit.

**Status:** active by default (no `ANTHROPIC_API_KEY`, `AI_PROVIDER` unset), including on the live site.

---

## Online demo passcode

While the online site has no login, paid AI (box reading and category sorting) is off for visitors. A shared passcode turns it on for people you trust:

1. In **Vercel → Project → Settings → Environment Variables**, add `DEMO_PASSCODE` for **Production** with a long, unguessable value (it must not contain `your-`, `example`, `placeholder` or `xxxx`, or it counts as unset), then redeploy.
2. Share it only with your team and the judges. Visitors type it into the **Demo passcode** box that appears under "Read box with AI" (or "Fill missing categories with AI") and press **Unlock AI**.
3. That browser is unlocked for 12 hours (an httpOnly cookie signed with the passcode). Changing `DEMO_PASSCODE` cancels every unlock at once.
4. **Delete `DEMO_PASSCODE` once login exists.**

Limits for unlocked visitors, per IP address and per server instance: 8 passcode tries, 15 box reads and 6 category sorts per 10 minutes. Without `DEMO_PASSCODE` (or with a placeholder value) nothing changes.

---

## Vercel

**Purpose:** builds and hosts the site, runs the three API routes (`read-box`, `categorize`, `demo-unlock`) and `proxy.ts`.

**Free tier (check current terms):** the Hobby plan is free for personal, non-commercial projects; commercial use needs a paid plan. Function duration, bandwidth and build minutes are limited. The AI routes set `maxDuration = 120` seconds, which must be allowed by your plan.

**Status:** live at https://dawakraft.vercel.app, auto-deploys from GitHub `main` (configured in Vercel; there is no `vercel.json`). No Supabase or Claude variables are set yet, so the live site is in demo mode with the mock AI.

---

## Free alternatives for AI reading

Except where noted, these are **not wired in**. They are options if Claude's cost is a concern.

| Option | What it offers | Trade-offs (honest) |
|---|---|---|
| **Google Gemini API, free tier** (now wired in via OpenRouter, see above) | Vision models that can read images and return JSON; a free tier with per-minute and per-day request limits (check current terms). | Free-tier data may be used by Google to improve its products (check current terms) — think about whether carton photos are acceptable to share on those terms. Limits can change. Accuracy on small, curved or glossy carton print must be measured on real cartons before trusting it; the evidence/quote rules must hold. |
| **Hugging Face** (Inference Providers, or a self-run open vision model) | Open vision-language and OCR models; a small free monthly credit (check current terms), or run a model on your own machine. | Free credit is small and rate-limited; free hosted models can be slow or cold-start. Open models are generally weaker at following a strict JSON schema and at reading tiny print, so more fields would come back wrong or empty. Self-hosting needs a GPU. |

Whatever is chosen, the app's safety nets stay: every field must be confirmed by a person, composition is always flagged, and the front-strength cross-check still blocks a mismatch.

### Exact steps to add a provider

From the comment at the top of `src/lib/ai/index.ts`:

1. Write `src/lib/ai/providers/<name>.ts` exporting an `AiProvider` (see `src/lib/ai/types.ts`) with `id`, `paid`, `readBox()` and `categorize()`.
2. `readBox()` must return data shaped like `BoxReadingSchema`: every field with `value`, `confidence` (`high`/`low`), `source` (`front`/`side`/`top`/`other` or null) and an exact `quote` from the photo, plus a truthful `meta` (`provider`, `model`, `mock: false`, `latencyMs`, optional `usage`). Reuse `boxReadPrompt()` from `box-read.ts`. Throw `AiError` with the right code (`not_configured`, `rate_limited`, `image_rejected`, `invalid_json`, `refused`, `failed`, `out_of_credits`).
3. Set **`paid` correctly.** `true` keeps sign-in and the rate limits in front of it; a free-tier API that can still run out or bill you should be `true`.
4. Add its id to `PROVIDER_IDS` and a `case` in `pick()` in `index.ts` (check its key with `isRealValue`, and return `not_configured` when missing). Decide whether the unset default should ever choose it.
5. Add its key to `.env.example` (server-only, no `NEXT_PUBLIC_`).
6. Add contract tests in `src/lib/__tests__/` that run against **recorded responses** from the real service, including a refusal and a malformed reply.
7. Test on real cartons (including the strength mismatch case) before switching `AI_PROVIDER` on the live site.
