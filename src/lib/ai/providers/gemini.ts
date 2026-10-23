// Server-only: the Google Gemini provider, called only through OpenRouter (never Google AI Studio
// or Vertex directly). Reads box photos, sorts products into categories, writes promotional copy
// and makes the circular's lifestyle photo (the only provider that can).
// The key lives only in the server environment (OPENROUTER_API_KEY) and is never logged.
import { z } from "zod";
import { isRealValue } from "../../config";
import { CATEGORIES } from "../../constants";
import { boxReadPrompt } from "../box-read";
import { copyPrompt, normalizeCopy } from "../promo-copy";
import { PHOTO_ASPECT_RATIO, photoPrompt } from "../promo-photo";
import { ProductShotRejected, productShotPrompt, shotIdentityMatches } from "../product-shot";
import {
  AiError,
  BoxReadingSchema,
  CategoryListSchema,
  PHOTO_MEDIA_TYPES,
  PromoCopyDraftSchema,
  type AiMeta,
  type AiProvider,
  type BoxReadInput,
  type BoxReadOutput,
  type CategorizeOutput,
  type CategoryRequest,
  type PromoPhoto,
  type PromoPhotoInput,
  type PromoPhotoOutput,
  type WriteCopyInput,
  type WriteCopyOutput,
  type ProductShotInput,
} from "../types";

const PROVIDER = "gemini";
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_READ_MODEL = "google/gemini-3.7-flash";
export const DEFAULT_CATEGORY_MODEL = "google/gemini-3.5-flash-lite";
/** The copywriter uses the same default text model as box reading. */
export const DEFAULT_COPY_MODEL = DEFAULT_READ_MODEL;
export const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image";
const GOOGLE_PREFIX = "google/";

/** Sent with every request: Google's own endpoints only, no silent fallback to another vendor. */
export const PROVIDER_ROUTING = {
  only: ["google-vertex", "google-ai-studio"],
  allow_fallbacks: false,
  require_parameters: true,
} as const;

// Gemini spends tokens on thinking before it answers; too small a cap returns content null.
const READ_MAX_TOKENS = 8000;
const CATEGORY_MAX_TOKENS = 16000; // up to 150 products in one answer
const COPY_MAX_TOKENS = 6000; // a short JSON answer after thinking
const PHOTO_MAX_TOKENS = 8000; // one image is roughly 1,300 output tokens, plus thinking
const TIMEOUT_MS = 90_000; // per attempt
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;
const MAX_RETRY_AFTER_MS = 30_000;

type Env = Record<string, string | undefined>;

/** The model to use: the env override when it is a Google model, otherwise the default. */
export function googleModel(override: string | undefined, fallback: string): string {
  const asked = override?.trim();
  return asked && asked.startsWith(GOOGLE_PREFIX) ? asked : fallback;
}

export function geminiModels(env: Env = process.env): { read: string; categorize: string; copy: string; image: string } {
  return {
    read: googleModel(env.OPENROUTER_MODEL, DEFAULT_READ_MODEL),
    categorize: googleModel(env.OPENROUTER_CATEGORY_MODEL, DEFAULT_CATEGORY_MODEL),
    copy: googleModel(env.OPENROUTER_COPY_MODEL, DEFAULT_COPY_MODEL),
    image: googleModel(env.OPENROUTER_IMAGE_MODEL, DEFAULT_IMAGE_MODEL),
  };
}

// ---------- JSON Schema for structured output ----------

const SAFE_INT_BOUNDS = new Set([Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]);

/** Clean zod's JSON Schema for strict mode: no $schema, no meaningless safe-integer bounds, closed objects. */
function strictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictSchema);
  if (!node || typeof node !== "object") return node;
  const entries = Object.entries(node as Record<string, unknown>)
    .filter(([key, value]) => key !== "$schema" && !((key === "minimum" || key === "maximum") && SAFE_INT_BOUNDS.has(value as number)))
    .map(([key, value]) => [key, strictSchema(value)] as const);
  const out = Object.fromEntries(entries) as Record<string, unknown>;
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    return { ...out, required: Object.keys(out.properties), additionalProperties: false };
  }
  return out;
}

export const BOX_READING_JSON_SCHEMA = strictSchema(z.toJSONSchema(BoxReadingSchema));
export const CATEGORY_LIST_JSON_SCHEMA = strictSchema(z.toJSONSchema(CategoryListSchema));
export const PROMO_COPY_JSON_SCHEMA = strictSchema(z.toJSONSchema(PromoCopyDraftSchema));

const responseFormat = (name: string, schema: unknown) => ({
  type: "json_schema" as const,
  json_schema: { name, strict: true, schema },
});

// ---------- HTTP ----------

const ChatResponseSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable().optional(),
        native_finish_reason: z.string().nullable().optional(),
        message: z
          .object({
            content: z.string().nullable().optional(),
            refusal: z.string().nullable().optional(),
            images: z.array(z.object({ image_url: z.object({ url: z.string() }) })).nullable().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      cost: z.number().optional(),
    })
    .optional(),
  error: z.object({ message: z.string().optional() }).optional(),
});
type ChatResponse = z.infer<typeof ChatResponseSchema>;

type Deps = {
  env?: Env;
  /** Defaults to the global fetch, looked up at call time. */
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** How long to wait before retry number `attempt` (0-based): Retry-After seconds when given, else 1 s, 2 s, 4 s. */
export function retryDelayMs(attempt: number, retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  if (retryAfter && Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  return BASE_BACKOFF_MS * 2 ** attempt;
}

async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const parsed = ChatResponseSchema.safeParse(JSON.parse(text));
    return (parsed.success && parsed.data.error?.message) || text.slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}

/** One attempt, with its own timeout. */
async function attempt(fetchFn: typeof fetch, key: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetchFn(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new AiError("failed", `OpenRouter did not answer within ${TIMEOUT_MS / 1000} s`);
    throw new AiError("failed", `OpenRouter request failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/** POST to OpenRouter with retries for 429 and 5xx. Returns the parsed JSON body of a 2xx reply. */
async function postChat(task: string, body: unknown, deps: Required<Deps>): Promise<ChatResponse> {
  const key = deps.env.OPENROUTER_API_KEY;
  if (!isRealValue(key)) throw new AiError("not_configured", "OPENROUTER_API_KEY is not set (or is still the placeholder)");
  for (let tries = 0; ; tries++) {
    const res = await attempt(deps.fetchFn, key.trim(), body);
    if (res.ok) {
      const parsed = ChatResponseSchema.safeParse(await res.json().catch(() => null));
      if (!parsed.success) throw new AiError("invalid_json", "OpenRouter's reply was not the expected JSON");
      return parsed.data;
    }
    const message = await errorMessage(res);
    console.error(`[ai] ${PROVIDER} ${task} HTTP ${res.status}`, message);
    if (res.status === 402 || res.status === 403) throw new AiError("out_of_credits", "The OpenRouter credits or budget limit ran out");
    if (isRetryable(res.status) && tries < MAX_RETRIES) {
      await deps.sleep(retryDelayMs(tries, res.headers.get("retry-after")));
      continue;
    }
    if (res.status === 429) throw new AiError("rate_limited", "OpenRouter is rate limiting this key");
    throw new AiError("failed", `OpenRouter answered HTTP ${res.status}`);
  }
}

/** The JSON answer from the first choice, validated against `schema`. */
function parseContent<T>(response: ChatResponse, schema: z.ZodType<T>): T {
  if (response.error) throw new AiError("failed", `OpenRouter error: ${response.error.message ?? "unknown"}`);
  const choice = response.choices?.[0];
  if (choice?.finish_reason === "content_filter") throw new AiError("refused", "The model declined this request");
  if (choice?.finish_reason === "length") {
    throw new AiError("invalid_json", "The reply was cut off at the token limit (the model spent its budget thinking)");
  }
  const content = choice?.message?.content;
  if (content == null || content.trim() === "") throw new AiError("invalid_json", "The reply had no content");
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new AiError("invalid_json", "The reply was not valid JSON");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new AiError("invalid_json", "The reply did not match the expected shape");
  return parsed.data;
}

const DATA_URL = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/;

/** The first generated image (message.images[0].image_url.url, a base64 data URL) as a PromoPhoto. */
export function parseImage(response: ChatResponse): PromoPhoto {
  if (response.error) throw new AiError("failed", `OpenRouter error: ${response.error.message ?? "unknown"}`);
  const choice = response.choices?.[0];
  const blocked = /safety|prohibited|blocklist|content_filter|recitation/i;
  if (choice?.finish_reason === "content_filter" || blocked.test(choice?.native_finish_reason ?? "") || choice?.message?.refusal) {
    throw new AiError("refused", "The model declined to make this picture");
  }
  const url = choice?.message?.images?.[0]?.image_url.url;
  if (!url) throw new AiError("failed", "The reply had no image");
  const match = DATA_URL.exec(url.trim());
  if (!match) throw new AiError("failed", "The image was not a base64 data URL");
  const mediaType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  if (!(PHOTO_MEDIA_TYPES as readonly string[]).includes(mediaType)) throw new AiError("failed", `Unexpected image type ${mediaType}`);
  return { mediaType: mediaType as PromoPhoto["mediaType"], data: match[2] };
}

/** Build the meta for a finished call and log usage. Server logs only; never the key. */
function metaFor(task: string, requestedModel: string, started: number, response: ChatResponse): AiMeta {
  const inputTokens = Math.max(0, Math.round(response.usage?.prompt_tokens ?? 0));
  const outputTokens = Math.max(0, Math.round(response.usage?.completion_tokens ?? 0));
  const cost = response.usage?.cost;
  const meta: AiMeta = {
    provider: PROVIDER,
    model: response.model ?? requestedModel,
    mock: false,
    latencyMs: Date.now() - started,
    usage: { inputTokens, outputTokens, ...(typeof cost === "number" && cost >= 0 ? { estCostUsd: cost } : {}) },
  };
  console.info(`[ai] ${PROVIDER} ${task}`, { model: meta.model, latencyMs: meta.latencyMs, ...meta.usage });
  return meta;
}

// ---------- Provider ----------

/** Build the Gemini provider; tests inject env, fetch and sleep. */
export function createGeminiProvider(deps: Deps = {}): AiProvider {
  const resolve = (): Required<Deps> => ({
    env: deps.env ?? process.env,
    fetchFn: deps.fetchFn ?? ((...args) => globalThis.fetch(...args)),
    sleep: deps.sleep ?? defaultSleep,
  });

  async function readBox({ images }: BoxReadInput): Promise<BoxReadOutput> {
    const started = Date.now();
    const d = resolve();
    const model = geminiModels(d.env).read;
    const response = await postChat(
      "readBox",
      {
        model,
        provider: PROVIDER_ROUTING,
        max_tokens: READ_MAX_TOKENS,
        response_format: responseFormat("box_reading", BOX_READING_JSON_SCHEMA),
        messages: [
          {
            role: "user",
            content: [
              ...images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.data}` } })),
              { type: "text", text: boxReadPrompt(images.map((img) => img.role)) },
            ],
          },
        ],
      },
      d,
    );
    return { data: parseContent(response, BoxReadingSchema), meta: metaFor("readBox", model, started, response) };
  }

  async function categorize(items: CategoryRequest[]): Promise<CategorizeOutput> {
    const started = Date.now();
    const d = resolve();
    const model = geminiModels(d.env).categorize;
    const response = await postChat(
      "categorize",
      {
        model,
        provider: PROVIDER_ROUTING,
        max_tokens: CATEGORY_MAX_TOKENS,
        response_format: responseFormat("category_list", CATEGORY_LIST_JSON_SCHEMA),
        messages: [
          {
            role: "user",
            content: `Assign each pharmaceutical product to exactly one category from this list: ${CATEGORIES.join("; ")}. Judge from the composition when given. Return one entry per product, using the same i.\n\n${JSON.stringify(items)}`,
          },
        ],
      },
      d,
    );
    return { data: parseContent(response, CategoryListSchema).items, meta: metaFor("categorize", model, started, response) };
  }

  async function writeCopy(input: WriteCopyInput): Promise<WriteCopyOutput> {
    const started = Date.now();
    const d = resolve();
    const model = geminiModels(d.env).copy;
    const response = await postChat(
      "writeCopy",
      {
        model,
        provider: PROVIDER_ROUTING,
        max_tokens: COPY_MAX_TOKENS,
        response_format: responseFormat("promo_copy", PROMO_COPY_JSON_SCHEMA),
        messages: [{ role: "user", content: copyPrompt(input) }],
      },
      d,
    );
    const copy = normalizeCopy(parseContent(response, PromoCopyDraftSchema), input);
    if (!copy) throw new AiError("invalid_json", "The reply had no usable section");
    return { data: copy, meta: metaFor("writeCopy", model, started, response) };
  }

  async function makePhoto(input: PromoPhotoInput): Promise<PromoPhotoOutput> {
    const started = Date.now();
    const d = resolve();
    const model = geminiModels(d.env).image;
    const response = await postChat(
      "makePhoto",
      {
        model,
        provider: PROVIDER_ROUTING,
        max_tokens: PHOTO_MAX_TOKENS,
        modalities: ["image", "text"],
        image_config: { aspect_ratio: input.format === "story" ? "9:16" : PHOTO_ASPECT_RATIO },
        messages: [{ role: "user", content: photoPrompt(input) }],
      },
      d,
    );
    return { data: parseImage(response), meta: metaFor("makePhoto", model, started, response) };
  }

  async function makeProductShot(input: ProductShotInput): Promise<PromoPhotoOutput> {
    const started = Date.now();
    const d = resolve();
    const model = geminiModels(d.env).image;
    const response = await postChat("makeProductShot", {
      model, provider: PROVIDER_ROUTING, max_tokens: PHOTO_MAX_TOKENS,
      modalities: ["image", "text"], image_config: { aspect_ratio: "4:3" },
      messages: [{ role: "user", content: [
        ...input.images.map(img => ({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.data}` } })),
        { type: "text", text: productShotPrompt(input) },
      ] }],
    }, d);
    const data = parseImage(response);
    // Never approve a changed brand/strength merely because the photograph looks attractive.
    const check = await readBox({ images: [{ ...data, role: "front" }] });
    if (!shotIdentityMatches(input, { name: check.data.name.value, composition: check.data.composition.value })) {
      throw new ProductShotRejected(data, check.data.name.value);
    }
    return { data, meta: metaFor("makeProductShot", model, started, response) };
  }

  return { id: PROVIDER, paid: true, readBox, categorize, writeCopy, makePhoto, makeProductShot };
}

export const geminiProvider = createGeminiProvider();
