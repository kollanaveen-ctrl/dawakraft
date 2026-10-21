// Server-only: calls Claude to read box photos and to sort products into categories.
// The API key is read from the server environment and never reaches the browser.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { claudeConfigured } from "../config";
import { CATEGORIES, FORMS, SCHEDULES } from "../constants";
import { boxReadPrompt } from "./box-read";

const MODEL = "claude-opus-5-5";
// Opt in to server-side fallback: if a request is declined, the API retries it on another model.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type AiErrorCode = "not_configured" | "rate_limited" | "image_rejected" | "invalid_json" | "refused" | "failed";

export class AiError extends Error {
  constructor(public readonly code: AiErrorCode, message: string) {
    super(message);
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!claudeConfigured()) throw new AiError("not_configured", "ANTHROPIC_API_KEY is not set (or is still the placeholder)");
  client ??= new Anthropic();
  return client;
}

const field = <T extends z.ZodType>(value: T) =>
  z.object({ value: value.nullable(), confidence: z.enum(["high", "low"]) });

const BoxReading = z.object({
  name: field(z.string()),
  composition: field(z.string()),
  form: field(z.enum(FORMS)),
  packSize: field(z.string()),
  mrp: field(z.number()),
  manufacturer: field(z.string()),
  marketedBy: field(z.string()),
  schedule: field(z.enum(SCHEDULES)),
  storage: field(z.string()),
  category: field(z.enum(CATEGORIES)),
});
export type BoxReading = z.infer<typeof BoxReading>;

const CategoryList = z.object({
  items: z.array(z.object({ i: z.number().int(), category: z.enum(CATEGORIES) })),
});
export type CategoryList = z.infer<typeof CategoryList>;

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

type Parsed<T> = { stop_reason: string | null; parsed_output: T | null };

function unwrap<T>(response: Parsed<T>): T {
  if (response.stop_reason === "refusal") throw new AiError("refused", "The model declined this request");
  if (!response.parsed_output) throw new AiError("invalid_json", "The reply did not match the expected shape");
  return response.parsed_output;
}

export type BoxImage = { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };

export async function readBox(images: BoxImage[]): Promise<BoxReading> {
  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 8000, // a small JSON answer; the cap (thinking included) bounds the cost of one reading
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(BoxReading) },
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: img.mediaType, data: img.data },
            })),
            { type: "text" as const, text: boxReadPrompt(images.length) },
          ],
        },
      ],
    });
    return unwrap(response);
  } catch (error) {
    throw toAiError(error);
  }
}

export type CategoryRequest = { i: number; name: string; composition: string };

export async function categorize(items: CategoryRequest[]): Promise<CategoryList["items"]> {
  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(CategoryList) },
      messages: [
        {
          role: "user",
          content: `Assign each pharmaceutical product to exactly one category from this list: ${CATEGORIES.join("; ")}. Judge from the composition when given. Return one entry per product, using the same i.\n\n${JSON.stringify(items)}`,
        },
      ],
    });
    return unwrap(response).items;
  } catch (error) {
    throw toAiError(error);
  }
}
