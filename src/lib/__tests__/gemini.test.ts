// The Gemini provider (via OpenRouter). Global fetch is stubbed: no test here calls the real API.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiProvider, selectedProviderId } from "../ai";
import { MOCK_READING } from "../ai/providers/mock";
import {
  BOX_READING_JSON_SCHEMA,
  DEFAULT_CATEGORY_MODEL,
  DEFAULT_READ_MODEL,
  OPENROUTER_URL,
  createGeminiProvider,
  geminiModels,
  googleModel,
  retryDelayMs,
} from "../ai/providers/gemini";
import { AiError, type BoxReadInput } from "../ai/types";

const TEST_KEY = "sk-or-v1-testOnlyKey123";
const ENV = { OPENROUTER_API_KEY: TEST_KEY };
const IMAGE_DATA = "A".repeat(120);
const INPUT: BoxReadInput = {
  images: [
    { mediaType: "image/jpeg", data: IMAGE_DATA, role: "front" },
    { mediaType: "image/png", data: IMAGE_DATA, role: "side" },
  ],
};

type Call = { url: string; init: RequestInit; body: Record<string, unknown> };

function chatReply(content: string | null, extra: Record<string, unknown> = {}) {
  return {
    id: "gen-1",
    model: "google/gemini-3.7-flash",
    choices: [{ finish_reason: "stop", message: { role: "assistant", content } }],
    usage: { prompt_tokens: 1200, completion_tokens: 340, cost: 0.0021 },
    ...extra,
  };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

/** Stub global fetch with a queue of responses and record every call. */
function stubFetch(...responses: Response[]): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init, body: JSON.parse(String(init.body)) });
      const next = responses.shift();
      if (!next) throw new Error("unexpected extra fetch");
      return next;
    }),
  );
  return calls;
}

const noSleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
const provider = (env: Record<string, string | undefined> = ENV) => createGeminiProvider({ env, sleep: noSleep });

beforeEach(() => {
  noSleep.mockClear();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("gemini request", () => {
  it("posts to OpenRouter with a Google model, the locked provider block, strict JSON schema and data-URL images", async () => {
    const calls = stubFetch(json(200, chatReply(JSON.stringify(MOCK_READING))));
    await provider().readBox(INPUT);

    expect(calls).toHaveLength(1);
    const [{ url, init, body }] = calls;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(url).toBe(OPENROUTER_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TEST_KEY}`);
    expect(body.model).toBe(DEFAULT_READ_MODEL);
    expect(String(body.model).startsWith("google/")).toBe(true);
    expect(body.provider).toEqual({ only: ["google-vertex", "google-ai-studio"], allow_fallbacks: false, require_parameters: true });
    expect(body.max_tokens).toBe(8000);
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "box_reading", strict: true, schema: BOX_READING_JSON_SCHEMA },
    });

    const [message] = body.messages as { role: string; content: { type: string; image_url?: { url: string }; text?: string }[] }[];
    expect(message.role).toBe("user");
    expect(message.content.map((p) => p.type)).toEqual(["image_url", "image_url", "text"]);
    expect(message.content[0].image_url?.url).toBe(`data:image/jpeg;base64,${IMAGE_DATA}`);
    expect(message.content[1].image_url?.url).toBe(`data:image/png;base64,${IMAGE_DATA}`);
    expect(message.content[2].text).toContain("Image 1 is the FRONT face of the carton.");
  });

  it("generates a strict JSON schema: closed objects, every key required, nullable values", () => {
    const schema = BOX_READING_JSON_SCHEMA as {
      $schema?: string;
      additionalProperties: boolean;
      required: string[];
      properties: Record<string, { additionalProperties: boolean; required: string[]; properties: Record<string, unknown> }>;
    };
    expect(schema.$schema).toBeUndefined();
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toContain("strengthOnFront");
    expect(schema.properties.name.additionalProperties).toBe(false);
    expect(schema.properties.name.required).toEqual(["value", "confidence", "source", "quote"]);
    expect(schema.properties.name.properties.value).toEqual({ type: ["string", "null"] });
  });

  it("uses the categorize model for sorting, with the same provider block", async () => {
    const calls = stubFetch(json(200, chatReply(JSON.stringify({ items: [{ i: 2, category: "Antibiotic" }] }))));
    const out = await provider().categorize([{ i: 2, name: "Zee", composition: "Azithromycin 500 mg" }]);
    expect(out.data).toEqual([{ i: 2, category: "Antibiotic" }]);
    expect(calls[0].body.model).toBe(DEFAULT_CATEGORY_MODEL);
    expect(calls[0].body.provider).toEqual({ only: ["google-vertex", "google-ai-studio"], allow_fallbacks: false, require_parameters: true });
    expect((calls[0].body.response_format as { json_schema: { strict: boolean } }).json_schema.strict).toBe(true);
  });
});

describe("gemini response", () => {
  it("parses the reading and reports OpenRouter's usage and cost", async () => {
    stubFetch(json(200, chatReply(JSON.stringify(MOCK_READING))));
    const out = await provider().readBox(INPUT);
    expect(out.data).toEqual(MOCK_READING);
    expect(out.meta).toMatchObject({
      provider: "gemini",
      model: "google/gemini-3.7-flash",
      mock: false,
      usage: { inputTokens: 1200, outputTokens: 340, estCostUsd: 0.0021 },
    });
    expect(out.meta.latencyMs).toBeGreaterThanOrEqual(0);
    const logged = JSON.stringify((console.info as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(logged).toContain("gemini");
    expect(logged).not.toContain(TEST_KEY);
  });

  it("throws invalid_json for null content, a length cut-off, non-JSON or the wrong shape", async () => {
    const cases = [
      chatReply(null),
      { ...chatReply(null), choices: [{ finish_reason: "length", message: { content: '{"name":' } }] },
      chatReply("not json"),
      chatReply(JSON.stringify({ name: "X" })),
    ];
    for (const reply of cases) {
      stubFetch(json(200, reply));
      await expect(provider().readBox(INPUT)).rejects.toMatchObject({ code: "invalid_json" });
    }
  });
});

describe("gemini errors and retries", () => {
  it("maps 402 to out_of_credits without retrying", async () => {
    const calls = stubFetch(json(402, { error: { code: 402, message: "Insufficient credits" } }));
    const err = await provider().readBox(INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).code).toBe("out_of_credits");
    expect(calls).toHaveLength(1);
    expect(noSleep).not.toHaveBeenCalled();
  });

  it("maps 403 (key budget limit) to out_of_credits", async () => {
    stubFetch(json(403, { error: { code: 403, message: "Key limit exceeded" } }));
    await expect(provider().readBox(INPUT)).rejects.toMatchObject({ code: "out_of_credits" });
  });

  it("retries a 429, honouring Retry-After, then succeeds", async () => {
    const calls = stubFetch(json(429, { error: { message: "slow down" } }, { "Retry-After": "2" }), json(200, chatReply(JSON.stringify(MOCK_READING))));
    const out = await provider().readBox(INPUT);
    expect(out.data).toEqual(MOCK_READING);
    expect(calls).toHaveLength(2);
    expect(noSleep).toHaveBeenCalledWith(2000);
  });

  it("gives up after 3 retries: rate_limited for 429, failed for 5xx", async () => {
    const tooMany = () => json(429, { error: { message: "slow down" } });
    const calls = stubFetch(tooMany(), tooMany(), tooMany(), tooMany());
    await expect(provider().readBox(INPUT)).rejects.toMatchObject({ code: "rate_limited" });
    expect(calls).toHaveLength(4);
    expect(noSleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000]);

    const down = () => json(503, { error: { message: "unavailable" } });
    stubFetch(down(), down(), down(), down());
    await expect(provider().readBox(INPUT)).rejects.toMatchObject({ code: "failed" });
  });

  it("maps 400 to failed without retrying", async () => {
    const calls = stubFetch(json(400, { error: { message: "bad schema" } }));
    await expect(provider().readBox(INPUT)).rejects.toMatchObject({ code: "failed" });
    expect(calls).toHaveLength(1);
  });

  it("refuses to call OpenRouter without a real key", async () => {
    const calls = stubFetch();
    await expect(provider({ OPENROUTER_API_KEY: "your-openrouter-key" }).readBox(INPUT)).rejects.toMatchObject({ code: "not_configured" });
    expect(calls).toHaveLength(0);
  });

  it("computes backoff delays", () => {
    expect([0, 1, 2].map((n) => retryDelayMs(n, null))).toEqual([1000, 2000, 4000]);
    expect(retryDelayMs(0, "3")).toBe(3000);
    expect(retryDelayMs(0, "999")).toBe(30_000);
    expect(retryDelayMs(1, "soon")).toBe(2000);
  });
});

describe("gemini models and registry", () => {
  it("allows only google/ model overrides", () => {
    expect(geminiModels({})).toEqual({ read: DEFAULT_READ_MODEL, categorize: DEFAULT_CATEGORY_MODEL });
    expect(DEFAULT_READ_MODEL).toBe("google/gemini-3.7-flash");
    expect(DEFAULT_CATEGORY_MODEL).toBe("google/gemini-3.5-flash-lite");
    expect(geminiModels({ OPENROUTER_MODEL: " google/gemini-3.5-pro ", OPENROUTER_CATEGORY_MODEL: "google/gemini-3.7-flash" })).toEqual({
      read: "google/gemini-3.5-pro",
      categorize: "google/gemini-3.7-flash",
    });
    expect(geminiModels({ OPENROUTER_MODEL: "openai/gpt-5", OPENROUTER_CATEGORY_MODEL: "anthropic/claude-opus-5-5" })).toEqual({
      read: DEFAULT_READ_MODEL,
      categorize: DEFAULT_CATEGORY_MODEL,
    });
    expect(googleModel("Google/gemini-x", DEFAULT_READ_MODEL)).toBe(DEFAULT_READ_MODEL);
    expect(googleModel("", DEFAULT_READ_MODEL)).toBe(DEFAULT_READ_MODEL);
  });

  it("sends the default model when the override is not a Google model", async () => {
    const calls = stubFetch(json(200, chatReply(JSON.stringify(MOCK_READING))));
    await provider({ ...ENV, OPENROUTER_MODEL: "openai/gpt-5" }).readBox(INPUT);
    expect(calls[0].body.model).toBe(DEFAULT_READ_MODEL);
  });

  it("defaults to anthropic, then gemini, then mock", () => {
    expect(selectedProviderId({ ANTHROPIC_API_KEY: "sk-ant-api03-real", OPENROUTER_API_KEY: TEST_KEY })).toBe("anthropic");
    expect(selectedProviderId({ OPENROUTER_API_KEY: TEST_KEY })).toBe("gemini");
    expect(selectedProviderId({ OPENROUTER_API_KEY: "your-openrouter-key" })).toBe("mock");
    expect(selectedProviderId({ AI_PROVIDER: " Gemini ", ANTHROPIC_API_KEY: "sk-ant-api03-real" })).toBe("gemini");
  });

  it("returns the paid gemini provider only with a real key", () => {
    const chosen = aiProvider({ AI_PROVIDER: "gemini", OPENROUTER_API_KEY: TEST_KEY });
    expect(chosen.ok && chosen.provider.id).toBe("gemini");
    expect(chosen.ok && chosen.provider.paid).toBe(true);
    const byDefault = aiProvider({ OPENROUTER_API_KEY: TEST_KEY });
    expect(byDefault.ok && byDefault.provider.id).toBe("gemini");
    expect(aiProvider({ AI_PROVIDER: "gemini" })).toEqual({ ok: false, error: "not_configured" });
    expect(aiProvider({ AI_PROVIDER: "gemini", OPENROUTER_API_KEY: "placeholder" })).toEqual({ ok: false, error: "not_configured" });
  });
});
