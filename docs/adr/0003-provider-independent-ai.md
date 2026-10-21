# ADR 0003: Provider-independent AI layer with a labelled mock

- **Status:** Accepted
- **Date:** recorded 2026-10-22

## Context

AI reading is central to the demo, but the Claude key is not added yet, calls cost money, and we may want a cheaper or free provider later. A fake reading must never be mistaken for a real one on a medicine circular.

## Decision

- `src/lib/ai/types.ts` defines one contract with zod: the request, the `BoxReading` shape with evidence (the `source` panel and the exact printed `quote`) for every field, the response envelopes, and an `AiProvider` interface with a `paid` flag.
- `src/lib/ai/index.ts` picks a provider from `AI_PROVIDER` (`anthropic`, `mock`, `off`). When unset or unknown it uses Claude if `ANTHROPIC_API_KEY` is real, otherwise the mock. Asking for `anthropic` without a key returns `not_configured` rather than quietly serving samples.
- The **mock** (`src/lib/ai/providers/mock.ts`) returns a made-up carton ("Demozith 500"), marks every field low confidence and sets `meta.mock = true`. The Details step then shows "Sample reading: these are demo values, not read from your photos..." and each evidence line starts "Demo value, not from your photos". Import shows "Sample categories (demo): check them."
- Paid providers require sign-in and rate limits (`src/lib/ai/access.ts`); free ones don't.

## Alternatives considered

- **Call Claude directly from the route:** simpler, but no way to demo without a key and harder to switch vendors.
- **Wire in a free vendor now (for example Gemini):** deferred until there are contract tests against recorded responses, as the comment in `ai/index.ts` requires.

## Consequences

- The full flow can be demoed for free, honestly labelled.
- Adding a provider is a small, well-defined change (see [INTEGRATIONS](../INTEGRATIONS.md#adding-an-ai-provider)).
- Real reading quality is unproven until Claude is keyed and tested on real cartons.
