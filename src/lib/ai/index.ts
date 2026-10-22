// Server-only: picks the AI provider from the environment.
//
//   AI_PROVIDER=anthropic  Claude (needs a real ANTHROPIC_API_KEY)
//   AI_PROVIDER=gemini     Google Gemini via OpenRouter (needs a real OPENROUTER_API_KEY)
//   AI_PROVIDER=mock       fixed sample answers, clearly labelled, free
//   AI_PROVIDER=off        AI switched off; the routes answer not_configured
//   (unset)                anthropic when ANTHROPIC_API_KEY is real, else gemini when
//                          OPENROUTER_API_KEY is real, otherwise mock
//
// Adding a provider: write providers/<name>.ts that exports an AiProvider (see types.ts)
// returning BoxReadingSchema-shaped data with real source/quote evidence and a truthful meta,
// set `paid` correctly (true keeps sign-in and rate limits), add its id to PROVIDER_IDS and a
// case in pick() below, and add contract tests that never call the real API.
import { isRealValue } from "../config";
import { anthropicProvider } from "./providers/anthropic";
import { geminiProvider } from "./providers/gemini";
import { mockProvider } from "./providers/mock";
import type { AiProvider } from "./types";

export const PROVIDER_IDS = ["anthropic", "gemini", "mock", "off"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

type Env = Record<string, string | undefined>;

export type ProviderChoice = { ok: true; provider: AiProvider } | { ok: false; error: "not_configured" };

/**
 * Which provider the environment asks for. Unset means the default (Claude when a real Anthropic key
 * exists, else Gemini when a real OpenRouter key exists, otherwise the labelled mock).
 * A set but unknown value (a typo like "of") means off, never a paid provider.
 */
export function selectedProviderId(env: Env = process.env): ProviderId {
  const asked = env.AI_PROVIDER?.trim().toLowerCase();
  if ((PROVIDER_IDS as readonly string[]).includes(asked ?? "")) return asked as ProviderId;
  if (asked) return "off";
  if (isRealValue(env.ANTHROPIC_API_KEY)) return "anthropic";
  return isRealValue(env.OPENROUTER_API_KEY) ? "gemini" : "mock";
}

function pick(id: ProviderId, env: Env): ProviderChoice {
  switch (id) {
    case "anthropic":
      // Asked for Claude explicitly but no key: say so rather than quietly serving samples.
      return isRealValue(env.ANTHROPIC_API_KEY) ? { ok: true, provider: anthropicProvider } : { ok: false, error: "not_configured" };
    case "gemini":
      return isRealValue(env.OPENROUTER_API_KEY) ? { ok: true, provider: geminiProvider } : { ok: false, error: "not_configured" };
    case "mock":
      return { ok: true, provider: mockProvider };
    case "off":
      return { ok: false, error: "not_configured" };
  }
}

/** The provider the routes should use, or a typed not_configured error. */
export function aiProvider(env: Env = process.env): ProviderChoice {
  return pick(selectedProviderId(env), env);
}
