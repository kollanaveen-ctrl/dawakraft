# Dawakraft design system

> Status: living document. Last checked against the code on 2026-10-22.
> Sources: `src/app/globals.css`, `src/styles/ai.css`, `src/styles/landing.css`, `src/components/Logo.tsx`, `src/app/layout.tsx`, `src/app/icon.svg`, `src/app/opengraph-image.tsx`.

The look in three words: **pine, marigold, kraft paper.** Pine green means action and trust, marigold means highlight, and a warm off-white "kraft paper" background keeps long sessions calm. Everything is plain CSS classes driven by colour tokens on `:root`; Tailwind v4 is loaded and its theme is bridged to the same tokens (`@theme inline`), but the screens use the hand-written classes below.

## 1. Logo

### Concept

The mark is an **isometric medicine carton** on a pine rounded square. The **top face is marigold**: the box becomes the circular. Two short pine strokes on the left face suggest printed label lines.

```
  pine rounded square (#0E5E4E, radius 15 of 64)
        ◆  top face      marigold #E9A23B
       ◢◣ left face      white
          right face     white at 72% opacity
          label strokes  pine, the second at 55% opacity
```

The **wordmark** is two-tone: **Dawa** in ink, **kraft** in pine (`.logo-kraft`, colour `var(--accent)`), set in Bricolage Grotesque 800 with tight letter-spacing (−0.03em). An optional tagline "BOX TO CIRCULAR" sits underneath in JetBrains Mono, uppercase, muted.

### Variations in the code

| Variation | Where | Notes |
|---|---|---|
| Mark + wordmark + tagline | `<Logo />` (`Logo.tsx`), app bar, landing header and footer | Default, mark 36 px. |
| Mark + wordmark, no tagline | `<Logo tagline={false} />` | Available; not used today. |
| Mark only | `<LogoMark size={…} />` | `aria-hidden`; the link text comes from the wordmark. |
| Favicon | `src/app/icon.svg` | Same drawing as `LogoMark`. |
| Home-screen icons 180 / 192 / 512 | `src/app/pwa-icon/[size]/route.tsx` | Full-bleed pine square, carton at 78% so it stays inside the maskable safe zone; one label stroke. |
| Social share card 1200 × 630 | `src/app/opengraph-image.tsx` | Kraft background, mark at 88 px, wordmark, headline, a marigold and a pine-soft pill. No label strokes. |

**Rules:** keep the marigold top face; don't recolour the mark to match a customer brand (customer colours belong on the circular, not on Dawakraft's logo); keep "kraft" in the accent colour so it follows dark mode.

## 2. Colour tokens

Defined on `:root` in `globals.css`. Dark values apply under `@media (prefers-color-scheme: dark)` unless the page sets `data-theme="light"`. There is no theme switch in the app yet, and no `[data-theme="dark"]` override.

| Token | Light | Dark | Intended use |
|---|---|---|---|
| `--bg` | `#f6f4ee` | `#0d1412` | Page background ("kraft paper"). |
| `--surface` | `#ffffff` | `#141d1a` | Cards, bars, inputs, buttons. |
| `--sunken` | `#eceae3` | `#1b2622` | Wells: tick-box rows, image placeholders, face tabs. |
| `--ink` | `#14201d` | `#e8efec` | Main text; toast and skip-link background. |
| `--muted` | `#5b6863` | `#9caba5` | Secondary text, hints, evidence lines. |
| `--line` | `#dcd8cd` | `#2a3632` | Borders and dividers. |
| `--accent` | `#0e5e4e` | `#4cc7a4` | Pine: primary buttons, selected chips, focus rings. |
| `--accent-hover` | `#0b4c3f` | `#6bd5b6` | Primary button hover. |
| `--accent-ink` | `#ffffff` | `#06231b` | Text on accent. |
| `--accent-soft` | `#dcebe4` | `#173a31` | Selected tab, current step, chosen layout. |
| `--capsule` | `#e9a23b` | (same) | Marigold: tags, step numbers on the landing page, border on box-face photos (`.thumb.face`). |
| `--capsule-ink` | `#3a2600` | (same) | Text on marigold. |
| `--warn` / `--warn-soft` | `#9a5506` / `#fbefd8` | `#f0b060` / `#3a2a12` | "Check this" fields, warnings, demo banner. |
| `--bad` / `--bad-soft` | `#b3261e` / `#fbe3e0` | `#f28b82` / `#3b1d1a` | Red compliance items, errors, delete. |
| `--good` / `--good-soft` | `#0e5e4e` / `#dcebe4` | `#4cc7a4` / `#173a31` | Passed checks. |

Fixed colours outside the tokens: the transparency checkerboard behind product pictures (`.check-bg`, `#fff` / `#e4e8e8`), browser theme colour `#F6F4EE` / `#0D1412` (`layout.tsx`), and the six customer brand-colour swatches in `src/lib/constants.ts` (`#0B7A63`, `#1F4E8C`, `#7A1F4E`, `#B4461E`, `#4B3A8F`, `#0F1F24`), which colour circulars, not the app. The Catalogue card circular uses its own navy `#043F88`, copied from the company's printed catalogue (`src/lib/circular/catalogCard.ts`).

**Measured contrast** (WCAG ratio, computed from the hex values above): ink on bg 15.2:1; muted on bg 5.3:1 and on surface 5.8:1; white on pine 7.7:1; pine on bg 7.0:1; capsule-ink on marigold 6.7:1; warn on warn-soft 5.0:1; bad on bad-soft 5.3:1. Dark: ink on bg 16.0:1; muted on surface 7.2:1; accent-ink on accent 7.9:1; warn on warn-soft 7.3:1; bad on bad-soft 6.4:1. All pass WCAG AA for normal text (4.5:1).

## 3. Typography

Loaded with `next/font/google` in `layout.tsx` and exposed as CSS variables. The circular renderer reads the same variables, so circulars match the app.

| Role | Family | Variable | Weights loaded | Used for |
|---|---|---|---|---|
| Display | **Bricolage Grotesque** | `--f-display` | 500, 700, 800 | Headings (800, −0.01em), wordmark, product names on cards. |
| Body | **Instrument Sans** | `--f-body` | 400, 500, 600 | Everything else; body 15 px, line height 1.55. |
| Labels | **JetBrains Mono** | `--f-mono` | 500 | `.mono` eyebrows ("NEW PRODUCT"), counts on chips, tags, table headers, step numbers. Uppercase, 0.04–0.1em tracking. |

**Circular only:** the Catalogue card layout uses Source Serif 4 (`--f-serif`, loaded in `layout.tsx`) to match the company's printed catalogue. The app screens don't use it.

Sizes: `h1` 1.6rem (landing hero up to 3.6rem with `clamp`), `h2` 1.25rem, `h3` 1.02rem. Form inputs are 16 px so iPhones don't zoom in when a field is tapped. Headings use `text-wrap: balance`.

## 4. Shape, depth and spacing

| Token / rule | Value |
|---|---|
| `--r` (buttons, notices) | 12 px |
| Cards | 16 px radius (14 px for empty states, FAQ items), 18 px padding |
| Product cards, skeletons | 12 px |
| Inputs | 8 px |
| Chips, step pills | fully rounded (999 px) |
| `--shadow` (cards, product cards, landing steps) | light: `0 1px 2px rgba(20,32,29,.06), 0 6px 20px -12px rgba(20,32,29,.25)`; dark: stronger black shadows |
| Page width | `.wrap` max 1080 px, side gutter at least 16 px (or the phone's safe area) |
| Vertical rhythm | `.stack` gap 14 px; `.row` gap 10 px; form grid gap 12 px |
| `--nav-h` | 64 px (space kept for the phone bottom bar) |

Layout: `.two` is a two-column split (≈55/45) that becomes one column at 760 px; `.form-grid` is two columns, one at 520 px; the catalog `.grid` fills columns of at least 170 px, and exactly two columns under 400 px.

## 5. Components

| Component | Class / file | Notes |
|---|---|---|
| **Buttons** | `.btn`, `.btn.primary`, `.btn.ghost`, `.btn.danger`, `.btn.lg` | Surface with line border; primary is pine. Min height 42 px (`.lg` 50 px). Pressed state moves down 1 px. Disabled at 50% opacity with a not-allowed cursor. The disabled Next button changes its label to say why ("Fix the red items"). |
| **Inline link button** | `.inline-link` (`.danger`) | Underlined text action inside notices ("Clear filters", "Remove examples"). |
| **Fields** | `.field`, `.hint`, `.form-grid`, `.full` | Label above input; grey hint after the label. |
| **"Check this" field** | `.field.low`, `.flag` | Warn-coloured border and background, "Check this" flag. |
| **Evidence line** | `.ai-evidence` (`ai.css`) | Small muted text with a left rule under a field; the rule turns warn-coloured when the field is flagged. |
| **Tick-box row** | `.confirm` | 20 px pine checkbox on a sunken panel with a two-line label. |
| **Chips** | `.chips`, `.chip` | Filter toggles with `aria-pressed`; selected = pine. Count in mono. |
| **Tags** | `.tag`, `.tag.new` | Marigold "Example"; pine "New launch". |
| **Cards** | `.card`, `.pcard` | `.pcard` is a product link: circular thumbnail at 1080:1350 plus name, composition, pack · MRP. Lifts 2 px on hover. |
| **Notices** | `.notice`, `.notice.warn`, `.notice.ai-mock`, `.dot` | Row with a coloured dot. `ai-mock` adds a warn border and bold text so the sample reading can't be missed. |
| **Checklist** | `.checks li.good / .warn / .bad` | Step 4. Red and yellow items get a soft background. |
| **Wizard steps** | `.steps` | Numbered pills; `aria-current="step"`; unreached steps disabled. |
| **Layout picker** | `.tpls` (`TemplatePicker.tsx`) | Radio group "Layout" styled as pills. |
| **Top bar** | `.bar`, `.tabs`, `.tab` | Sticky, safe-area aware. Current tab `aria-current="page"`. |
| **Bottom nav** | `.bottom-nav` (`AppBar.tsx`) | **Screens ≤ 720 px only**: fixed bar with Catalog, **New** (filled pine), Import, Company, each an icon plus label, min height 48 px; the top-bar links are hidden. Page and toast padding make room for it. |
| **Skeletons** | `.skeleton` | Four placeholders while the catalog loads (`aria-busy`). Shimmer only when motion is allowed. |
| **Empty states** | `.empty`, `.empty-art` | Dashed border, pine outline of the logo carton, title, one sentence, actions. |
| **Toasts** | `.toast` (`Toast.tsx`) | Ink pill at the bottom centre, `role="status"`, 2.8 s. Sits above the bottom nav on phones. |
| **Inline confirm** | `.inline-confirm` | Red-soft row for "Delete this product from the catalog?". |
| **Transparency background** | `.check-bg` | Checkerboard behind the cut-out product picture. |
| **Landing** | `landing.css` | Hero with a tilted live circular, five step cards with marigold numbers, editorial feature list with pine rules, FAQ with `<details>`, footer. |

## 6. State patterns

| State | Pattern |
|---|---|
| Loading | "Loading…" in muted text, catalog skeletons, button label changes ("Saving…", "Sending…", "Checking…"), button disabled while busy. |
| Working (long) | Status line under the action: "Reading the box… this can take up to a minute." |
| Success | Toast ("Saved to catalog", "Copied", "Image saved") or a status line ("Saved. New circulars use this branding."). |
| Error | `.status.err` in red under the action, plain words and a next step. Never a raw error code. |
| Needs review | "Check this" flag, warn notice, yellow checklist item. |
| Blocked | Red checklist item plus a disabled Next button whose label says why. |
| Sample / demo data | Warn notice with the exact words "Sample reading" or "Demo"; evidence lines say "Demo value, not from your photos". |
| Empty | `.empty` block with art, a sentence and the first action. |

Status lines use `aria-live="polite"` or `role="status"`; the sample-reading warning uses `role="alert"`.

## 7. Accessibility rules

1. **Contrast:** every text/background token pair in section 2 meets 4.5:1 in both themes. New colours must be checked the same way.
2. **Touch targets:** aim for **48 px**. Today the bottom nav links are at least 48 px high (55 px measured on a 375 px screen) and large buttons are 50 px. **Not yet at 48 px:** standard `.btn` (42 px), chips, step pills, photo role selects and the ✕ remove button. These are on the [ROADMAP](ROADMAP.md).
3. **Focus:** every focusable element shows a 2 px pine outline with a 2 px offset (`:focus-visible`). 4. **Skip link:** "Skip to content" is the first element on every page (`layout.tsx`) and jumps to `#main`.
5. **Keyboard:** all actions are real buttons, links, checkboxes or selects, so the wizard needs no drag gesture. Step 2's controls (rotate buttons, background slider, tick boxes) are all of these.
6. **Labels:** every input has a visible label; icon-only buttons have `aria-label` ("Remove photo 2", "Brand colour #0B7A63"); toggle buttons use `aria-pressed`; nav uses `aria-current`.
7. **Reduced motion:** skeleton shimmer, card lift and chip transitions run only under `prefers-reduced-motion: no-preference`; the landing hero stops cycling layouts when reduced motion is requested.
8. **Language:** `<html lang="en-IN">`.
9. **Zoom:** no `maximum-scale`; inputs at 16 px avoid forced zoom on iOS.
10. **Images:** decorative art is `aria-hidden`; canvases carry `aria-label` ("Circular preview", "Product picture for the circular"); catalog thumbnails are marked decorative because the card text says the same thing.
