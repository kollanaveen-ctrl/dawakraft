# Dawakraft testing

> Status: living document. Results recorded on 2026-10-22.
> Related: [ARCHITECTURE](ARCHITECTURE.md) · [WORKFLOWS](WORKFLOWS.md) · [ROADMAP](ROADMAP.md)

## 1. Strategy

Dawakraft does most of its work in the browser, and the riskiest parts are **rules** (what counts as a wrong strength, a banned claim, a new launch) and **contracts** (what the AI must send back). So testing is layered:

1. **Unit tests (Vitest, in Node)** for the pure logic: compliance, composition checks, AI request/response contracts, the provider registry, merging a reading into the form, CSV import, share text, segments, perspective maths, automatic edge detection, placing the strip, bottle or tube, and the catalogue card and uses field. These run in seconds and need no browser, keys or network.
2. **Type checking and lint** to catch mistakes across the browser/server boundary.
3. **Production build** to prove every route compiles.
4. **Dependency audit** of what ships to users.
5. **Manual browser checks** of the journeys that need a real screen: images, canvases, the automatic straightening, layout on a phone.
6. **Planned:** automated end-to-end tests with Playwright (not built yet, see gaps).

Tests live in `src/lib/__tests__/` and are picked up by `vitest.config.mts` (`src/**/*.test.ts`, Node environment, `@` alias to `src`).

## 2. Commands

Run from the `app` folder.

```bash
npm test                 # Vitest, all unit tests once
npx tsc --noEmit         # type check (also: npm run typecheck)
npx eslint src           # lint
npm run build            # production build
npm audit --omit=dev     # vulnerabilities in packages that ship
```

## 3. Current results

| Check | Result |
|---|---|
| `npm test` | **130 tests across 8 files, all passing.** |
| `npx tsc --noEmit` | Clean. |
| `npx eslint src` | Clean. |
| `npm run build` | Passes, **18 routes**. |
| `npm audit --omit=dev` | **0 vulnerabilities.** (A full `npm audit` reports 5 high in the dev-only tooling package `braces`, which is not shipped to users.) |

### What the 130 tests cover

| File | Tests | Areas |
|---|---|---|
| `ai.test.ts` | 29 | AI request and response contracts (zod), mock provider (labelled, low confidence, no cost), provider registry (`AI_PROVIDER` values, unknown means off, placeholder keys), the reading prompt, merging a reading with evidence, composition checks (misread letters, unit-less numbers, front-strength mismatch, combination totals), compliance with composition checks. |
| `catalog.test.ts` | 5 | Catalogue card template, the optional uses (indications) field: round trip, claim-word check, CSV import. |
| `companion.test.ts` | 6 | Strip, bottle and tube placed in front of the box: size, tilt, overlap, shadow room, tube lying flat, no-box case, auto-turning. |
| `gemini.test.ts` | 16 | Google Gemini via OpenRouter: request and response shape, strict JSON schema, error mapping and retries, provider registry. |
| `logic.test.ts` | 19 | Compliance rules and banned words, AI box reading, CSV import, share and catalog text, colour helpers, database mapping, rate limit. |
| `perspective.test.ts` | 15 | Ordering corners, face shape, homography, straightening a skewed face, box depth from left end and top, automatic corner suggestion. |
| `segments.test.ts` | 13 | New launch vs existing (60 days), company grouping and filters, photo roles for the product picture, 3D box shape. |
| `unlock.test.ts` | 27 | Demo passcode: signed unlock cookies (expiry, tampering, passcode change), passcode matching, client IP, who may use paid AI. |

## 4. Manual browser verification

Checked by hand in the browser:

- **Landing page** at `/`.
- **Catalog**.
- **Wizard step 2**: automatic straightening on a **tilted test photo on a dark sheet**, the **left end panel**, a **strip placed in front** of the box, the **syrup bottle layout**, and the **Catalogue card** circular.
- **Step 3**: the **labelled mock AI reading** ("Sample reading" warning) with evidence lines under each field.
- **Step 4**: the strength mismatch **"Front says 250, composition says 500 mg. Check the carton."** shown as a red item that **blocks** Next, and **clearing** as soon as the strength was corrected.
- **Save** to the catalog and the product page.
- **Catalog segments**: launch, category and company chips.
- **Phone layout at 375 px wide**: bottom navigation shown, its links **55 px** tall, **no horizontal scroll**.
- **Lighthouse (mobile) on the home page**: Accessibility 100, Best Practices 100, SEO 100 (after the logo-link fix below). See [SEO_PLAN](SEO_PLAN.md).

## 5. Bugs found in testing and fixed

| Bug | Effect | Fix |
|---|---|---|
| `img.decode()` could wait forever in some browsers (background tabs, power saving). | Step 2 froze on "Opening the photos…". | Removed; an image is drawable once it has loaded (`fileToImage` in `src/lib/image/encode.ts`). |
| Logo link's accessible name didn't match its visible text (Lighthouse *label-content-name-mismatch*). | Accessibility finding; voice-control users couldn't say what they see. | The link now takes its name from the visible wordmark. |

## 6. Security review

No **CRITICAL** or **HIGH** issues found. Fixed during the review:

- **Race-proof AI rate limit:** each call now records its use first and then counts (`claimAiUse` in `src/lib/rate-limit.ts`), so many requests sent at once can't all pass under the limit.
- **Oversized requests refused early:** bodies over **13 MB** get `413 too_large` before any parsing (`readJsonBody` in `src/lib/ai/access.ts`).
- **Unknown `AI_PROVIDER` means off:** a typo can never switch on a paid provider (`selectedProviderId` in `src/lib/ai/index.ts`).
- **Security headers** on every page (`next.config.ts`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`, `Strict-Transport-Security`. A full Content-Security-Policy is still to do.

## 7. Known gaps

- **No automated end-to-end suite yet.** Playwright is recommended for: wizard happy path with the mock, strength mismatch blocking and clearing, import with a sample CSV, catalog filters, and a 375 px layout check.
- **Real Claude reading** is untested (no key yet).
- **Supabase sign-in, database and storage** are untested (no project connected), including row-level security and the shared `ai_usage` limit.
- **Automatic straightening on real phone photos** (different angles, lighting and backgrounds, including the "already cropped" and "used as photographed" paths) has not been checked on a phone.
- **WhatsApp share sheet and image download** (including the iPhone "Show image to save" path) need a real phone.

## 8. Before each deploy

1. `npm test`, `npx tsc --noEmit`, `npx eslint src`, `npm run build` all pass.
2. `npm audit --omit=dev` shows 0.
3. Quick manual run of the wizard with the mock on the Vercel preview.
4. After changing any `NEXT_PUBLIC_` variable, redeploy and recheck the demo banner and sign-in behaviour.
