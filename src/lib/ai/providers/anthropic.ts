// Server-only: the Claude provider. Reads box photos and sorts products into categories.
// The API key is read from the server environment and never reaches the browser.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claudeConfigured } from "../../config";
import { CATEGORIES } from "../../constants";
import { boxReadPrompt } from "../box-read";
import {
  AiError,
  BoxReadingSchema,
  CategoryListSchema,
  type AiMeta,
  type AiProvider,
  type BoxReadInput,
  type BoxReadOutput,
  type CategorizeOutput,
  type CategoryRequest,
} from "../types";

const PROVIDER = "anthropic";
const MODEL = "claude-opus-5-5";
// Opt in to server-side fallback: if a request is declined, the API retries it on another model.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MAX_RETRIES = 2;
const TIMEOUT_MS = 90_000; // under the routes' 120 s maxDuration, so a slow call fails cleanly
// Opus 5.5 list prices in US dollars per million tokens, for the server log's cost estimate.
const INPUT_USD_PER_M = 4;
const OUTPUT_USD_PER_M = 20;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!claudeConfigured()) throw new AiError("not_configured", "ANTHROPIC_API_KEY is not set (or is still the placeholder)");
  client ??= new Anthropic({ maxRetries: MAX_RETRIES, timeout: TIMEOUT_MS });
  return client;
}

/** Rough cost of one call in US dollars (list prices; ignores caching and fallbacks). */
export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_USD_PER_M + outputTokens * OUTPUT_USD_PER_M) / 1_000_000;
}

function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.RateLimitError) return new AiError("rate_limited", error.message);
  if (error instanceof Anthropic.BadRequestError) {
    const imageProblem = /image/i.test(error.message);
    return new AiError(imageProblem ? "image_rejected" : "failed", error.message);
  }
  if (error instanceof Anthropic.APIError) return new AiError("failed", `${error.status}: ${error.message}`);
  return new AiError("failed", error instanceof Error ? error.message : "Unknown error");
}

type Parsed<T> = {
  stop_reason: string | null;
  parsed_output: T | null;
  usage: { input_tokens: number; output_tokens: number };
};

function unwrap<T>(response: Parsed<T>): T {
  if (response.stop_reason === "refusal") throw new AiError("refused", "The model declined this request");
  if (!response.parsed_output) throw new AiError("invalid_json", "The reply did not match the expected shape");
  return response.parsed_output;
}

/** Build the meta for a finished call and log usage. Server logs only; nothing here reaches the browser log. */
function metaFor(task: string, started: number, usage: Parsed<unknown>["usage"]): AiMeta {
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const meta: AiMeta = {
    provider: PROVIDER,
    model: MODEL,
    mock: false,
    latencyMs: Date.now() - started,
    usage: { inputTokens, outputTokens, estCostUsd: estimateCostUsd(inputTokens, outputTokens) },
  };
  console.info(`[ai] ${PROVIDER} ${task}`, { latencyMs: meta.latencyMs, ...meta.usage });
  return meta;
}

async function readBox({ images }: BoxReadInput): Promise<BoxReadOutput> {
  const started = Date.now();
  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 8000, // a small JSON answer; the cap (thinking included) bounds the cost of one reading
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(BoxReadingSchema) },
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: img.mediaType, data: img.data },
            })),
            { type: "text" as const, text: boxReadPrompt(images.map((img) => img.role)) },
          ],
        },
      ],
    });
    return { data: unwrap(response), meta: metaFor("readBox", started, response.usage) };
  } catch (error) {
    throw toAiError(error);
  }
}

async function categorize(items: CategoryRequest[]): Promise<CategorizeOutput> {
  const started = Date.now();
  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(CategoryListSchema) },
      messages: [
        {
          role: "user",
          content: `Assign each pharmaceutical product to exactly one category from this list: ${CATEGORIES.join("; ")}. Judge from the composition when given. Return one entry per product, using the same i.\n\n${JSON.stringify(items)}`,
        },
      ],
    });
    return { data: unwrap(response).items, meta: metaFor("categorize", started, response.usage) };
  } catch (error) {
    throw toAiError(error);
  }
}

export const anthropicProvider: AiProvider = { id: PROVIDER, paid: true, readBox, categorize };
