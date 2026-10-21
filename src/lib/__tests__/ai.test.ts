// The provider-independent AI layer: contracts, the mock, the registry, evidence merging and
// composition safety checks. No test here calls a real AI API.
import { describe, expect, it } from "vitest";
import { aiProvider, selectedProviderId } from "../ai";
import { MOCK_READING_MESSAGE, aiSummary, boxReadPrompt, evidenceLine, imageLabels, mergeAiResult } from "../ai/box-read";
import { estimateCostUsd } from "../ai/providers/anthropic";
import { MOCK_READING, createMockProvider, mockCategory } from "../ai/providers/mock";
import {
  AiMetaSchema,
  BoxReadRequestSchema,
  BoxReadResponseSchema,
  BoxReadingSchema,
  CategorizeRequestSchema,
  CategorizeResponseSchema,
} from "../ai/types";
import { hasBlockingIssue, runChecks } from "../compliance";
import { compositionChecks, misreadTokens, unitlessNumbers } from "../composition";
import { EMPTY_DRAFT } from "../data/mappers";
import { aiRoleOf } from "../faces";

const IMAGE_DATA = "A".repeat(120);
const image = (role: string) => ({ mediaType: "image/jpeg", data: IMAGE_DATA, role });
const REAL_KEY = "sk-ant-api03-realLookingKey";
const mock = createMockProvider({ delayMs: 0 });

describe("AI request contracts", () => {
  it("accepts labelled photos", () => {
    const res = BoxReadRequestSchema.safeParse({ images: [image("front"), image("side"), image("other")] });
    expect(res.success).toBe(true);
  });

  it("rejects missing or unknown roles, too many photos, and non-base64 data", () => {
    expect(BoxReadRequestSchema.safeParse({ images: [{ mediaType: "image/jpeg", data: IMAGE_DATA }] }).success).toBe(false);
    expect(BoxReadRequestSchema.safeParse({ images: [image("back")] }).success).toBe(false);
    expect(BoxReadRequestSchema.safeParse({ images: Array.from({ length: 5 }, () => image("other")) }).success).toBe(false);
    expect(BoxReadRequestSchema.safeParse({ images: [] }).success).toBe(false);
    expect(BoxReadRequestSchema.safeParse({ images: [{ ...image("front"), data: "<script>".repeat(20) }] }).success).toBe(false);
  });

  it("validates categorize requests", () => {
    expect(CategorizeRequestSchema.safeParse({ items: [{ i: 0, name: "Exampol", composition: "" }] }).success).toBe(true);
    expect(CategorizeRequestSchema.safeParse({ items: [{ i: -1, name: "Exampol", composition: "" }] }).success).toBe(false);
    expect(CategorizeRequestSchema.safeParse({ items: [{ i: 0, name: "", composition: "" }] }).success).toBe(false);
    expect(CategorizeRequestSchema.safeParse({ items: [] }).success).toBe(false);
  });
});

describe("AI response contracts", () => {
  const meta = { provider: "mock", model: null, mock: true, latencyMs: 0 };

  it("accepts a full reading with evidence and the error envelope", () => {
    expect(BoxReadResponseSchema.safeParse({ ok: true, data: MOCK_READING, meta }).success).toBe(true);
    expect(BoxReadResponseSchema.safeParse({ ok: false, error: "rate_limited" }).success).toBe(true);
  });

  it("rejects readings without evidence fields, bad sources or missing meta", () => {
    const noQuote = { ...MOCK_READING, name: { value: "X", confidence: "high", source: "front" } };
    expect(BoxReadingSchema.safeParse(noQuote).success).toBe(false);
    const badSource = { ...MOCK_READING, name: { value: "X", confidence: "high", source: "back", quote: "X" } };
    expect(BoxReadingSchema.safeParse(badSource).success).toBe(false);
    const noStrength = Object.fromEntries(Object.entries(MOCK_READING).filter(([k]) => k !== "strengthOnFront"));
    expect(BoxReadingSchema.safeParse(noStrength).success).toBe(false);
    expect(BoxReadResponseSchema.safeParse({ ok: true, data: MOCK_READING }).success).toBe(false);
  });

  it("checks meta and categorize envelopes", () => {
    expect(AiMetaSchema.safeParse({ ...meta, usage: { inputTokens: 10, outputTokens: 5, estCostUsd: 0.1 } }).success).toBe(true);
    expect(AiMetaSchema.safeParse({ ...meta, latencyMs: -1 }).success).toBe(false);
    expect(CategorizeResponseSchema.safeParse({ ok: true, data: [{ i: 0, category: "Antibiotic" }], meta }).success).toBe(true);
    expect(CategorizeResponseSchema.safeParse({ ok: true, data: [{ i: 0, category: "Painkillers" }], meta }).success).toBe(false);
  });
});

describe("mock provider", () => {
  it("returns a schema-valid sample reading, all low confidence, labelled as mock", async () => {
    const out = await mock.readBox({ images: [image("front")] as never });
    expect(BoxReadingSchema.safeParse(out.data).success).toBe(true);
    expect(Object.values(out.data).every((f) => f.confidence === "low")).toBe(true);
    expect(out.meta).toMatchObject({ provider: "mock", model: null, mock: true });
    expect(out.meta.usage).toBeUndefined();
    expect(mock.paid).toBe(false);
  });

  it("is deterministic and does not share its sample object", async () => {
    const a = await mock.readBox({ images: [] });
    const b = await mock.readBox({ images: [] });
    expect(a.data).toEqual(b.data);
    expect(a.data).not.toBe(MOCK_READING);
  });

  it("sorts sample categories by keyword, labelled as mock", async () => {
    const out = await mock.categorize([
      { i: 0, name: "Fevo", composition: "Paracetamol IP 650 mg" },
      { i: 3, name: "Zee", composition: "Azithromycin 500 mg" },
      { i: 4, name: "Mystery", composition: "" },
    ]);
    expect(out.data).toEqual([
      { i: 0, category: "Analgesic & antipyretic" },
      { i: 3, category: "Antibiotic" },
      { i: 4, category: "Other" },
    ]);
    expect(out.meta.mock).toBe(true);
    expect(mockCategory({ i: 0, name: "Multivit", composition: "" })).toBe("Vitamins & supplements");
  });
});

describe("provider registry", () => {
  it("defaults to anthropic only with a real key, otherwise mock", () => {
    expect(selectedProviderId({ ANTHROPIC_API_KEY: REAL_KEY })).toBe("anthropic");
    expect(selectedProviderId({})).toBe("mock");
    expect(selectedProviderId({ ANTHROPIC_API_KEY: "your-anthropic-key" })).toBe("mock");
  });

  it("honours AI_PROVIDER and treats unknown values as off (a typo never turns on a paid provider)", () => {
    expect(selectedProviderId({ AI_PROVIDER: "mock", ANTHROPIC_API_KEY: REAL_KEY })).toBe("mock");
    expect(selectedProviderId({ AI_PROVIDER: " OFF " })).toBe("off");
    expect(selectedProviderId({ AI_PROVIDER: "gemini" })).toBe("off");
    expect(selectedProviderId({ AI_PROVIDER: "of", ANTHROPIC_API_KEY: REAL_KEY })).toBe("off");
  });

  it("returns providers or a typed not_configured error", () => {
    const real = aiProvider({ ANTHROPIC_API_KEY: REAL_KEY });
    expect(real.ok && real.provider.id).toBe("anthropic");
    expect(real.ok && real.provider.paid).toBe(true);
    const sample = aiProvider({});
    expect(sample.ok && sample.provider.id).toBe("mock");
    expect(aiProvider({ AI_PROVIDER: "off", ANTHROPIC_API_KEY: REAL_KEY })).toEqual({ ok: false, error: "not_configured" });
    expect(aiProvider({ AI_PROVIDER: "anthropic" })).toEqual({ ok: false, error: "not_configured" });
  });

  it("estimates Opus 5.5 cost at $4/M input and $20/M output", () => {
    expect(estimateCostUsd(1_000_000, 0)).toBe(4);
    expect(estimateCostUsd(0, 1_000_000)).toBe(20);
    expect(estimateCostUsd(2000, 500)).toBeCloseTo(0.018, 10);
  });
});

describe("box reading prompt", () => {
  it("labels every photo by its role, in order", () => {
    expect(imageLabels(["front", "side", "other"])).toBe(
      "Image 1 is the FRONT face of the carton.\nImage 2 is a SIDE panel of the carton.\nImage 3 is another face of the carton (not labelled).",
    );
  });

  it("forbids guessing and asks for exact composition and quotes", () => {
    const p = boxReadPrompt(["front"]);
    expect(p).toContain("Never guess");
    expect(p).toContain("composition: copy it exactly as printed");
    expect(p).toContain("Never paraphrase");
    expect(p).toContain("strengthOnFront");
  });

  it("maps wizard faces to AI roles", () => {
    const faces = { front: 1, side: 0, top: null };
    expect([0, 1, 2].map((i) => aiRoleOf(faces, i))).toEqual(["side", "front", "other"]);
  });
});

describe("merging a reading with evidence", () => {
  it("returns evidence for filled fields and the front strength", () => {
    const out = mergeAiResult(EMPTY_DRAFT, {
      name: { value: "Exampol 650", confidence: "high", source: "front", quote: "EXAMPOL 650" },
      composition: { value: "Paracetamol IP 650 mg", confidence: "high", source: "side", quote: "  Paracetamol IP 650 mg " },
      storage: { value: null, confidence: "low", source: "side", quote: "Store cool" },
      mrp: { value: 32.5, confidence: "low", source: null, quote: null },
      strengthOnFront: { value: " 650 ", confidence: "high", source: "front", quote: "650" },
    });
    expect(out.filled).toBe(3);
    expect(out.evidence).toEqual({
      name: { source: "front", quote: "EXAMPOL 650" },
      composition: { source: "side", quote: "Paracetamol IP 650 mg" },
    });
    expect(out.strengthOnFront).toBe("650");
    expect(out.low).toEqual({ mrp: true });
    expect(aiSummary(out)).toBe("Filled 3 fields. Check every field against the carton, especially the ones marked Check this.");
  });

  it("has no evidence or strength when the reading is empty", () => {
    const out = mergeAiResult(EMPTY_DRAFT, null);
    expect(out.evidence).toEqual({});
    expect(out.strengthOnFront).toBeNull();
  });

  it("merges the mock reading and keeps a separate sample warning", () => {
    const out = mergeAiResult(EMPTY_DRAFT, MOCK_READING);
    expect(out.filled).toBe(9); // marketedBy is null in the sample
    expect(Object.keys(out.low)).toHaveLength(9);
    expect(out.strengthOnFront).toBe("500");
    expect(MOCK_READING_MESSAGE).toBe(
      "Sample reading: these are demo values, not read from your photos. Replace every field with the carton's real details.",
    );
  });

  it("writes evidence lines, never claiming a mock value was read", () => {
    expect(evidenceLine({ source: "side", quote: "Azithromycin IP 500 mg" })).toBe('Read from side panel: "Azithromycin IP 500 mg"');
    expect(evidenceLine({ source: null, quote: "X" })).toBe('Read from the photos: "X"');
    expect(evidenceLine({ source: "front", quote: null })).toBeNull();
    expect(evidenceLine(undefined)).toBeNull();
    expect(evidenceLine({ source: "side", quote: "X" }, true)).toBe('Demo value, not from your photos: "X"');
  });
});

describe("composition checks", () => {
  it("(a) warns about a number with no unit", () => {
    expect(compositionChecks({ composition: "Paracetamol IP 650" })).toEqual([
      { level: "warn", text: "Composition has a number with no unit: 650. Add the unit as printed, e.g. mg." },
    ]);
  });

  it("(a) accepts every listed unit and ignores numbers inside names", () => {
    const ok = [
      "Paracetamol IP 650mg",
      "Cyanocobalamin 500 mcg",
      "Vitamin B12 1500 µg",
      "Calcium 1 g",
      "Vitamin D3 60000 IU",
      "Each 5 ml contains Paracetamol 250 mg",
      "Clotrimazole 1% w/w",
      "Povidone iodine 5 % w/v",
      "Omega-3 fatty acids 300 mg",
      "Amoxicillin 250-500 mg",
    ];
    for (const composition of ok) expect(unitlessNumbers(composition), composition).toEqual([]);
  });

  it("(b) blocks letters read as digits", () => {
    expect(misreadTokens("Azithromycin 5O0 mg")).toEqual(["5O0"]);
    expect(misreadTokens("Cetirizine 1l0mg")).toEqual(["1l0"]);
    expect(misreadTokens("Paracetamol 500 mg, Vitamin D3 1000 IU")).toEqual([]);
    expect(compositionChecks({ composition: "Azithromycin IP 5O0 mg" })).toEqual([
      { level: "bad", text: "Strength may be misread: check '5O0'" },
    ]);
  });

  it("(c) blocks a front strength missing from the composition", () => {
    expect(compositionChecks({ composition: "Azithromycin IP 500 mg", strengthOnFront: "250" })).toEqual([
      { level: "bad", text: "Front says 250, composition says 500 mg. Check the carton." },
    ]);
    expect(compositionChecks({ composition: "Amoxicillin 500 mg + Clavulanic acid 125 mg", strengthOnFront: "250/125" })[0]?.level).toBe("bad");
  });

  it("(c) accepts matching strengths, combination totals and repaired misreads", () => {
    expect(compositionChecks({ composition: "Azithromycin IP 500 mg", strengthOnFront: "500" })).toEqual([]);
    expect(compositionChecks({ composition: "Amoxicillin 500 mg + Clavulanic acid 125 mg", strengthOnFront: "625" })).toEqual([]);
    // Only the misread is reported, not a second mismatch for the same strength.
    expect(compositionChecks({ composition: "Azithromycin 5O0 mg", strengthOnFront: "500" })).toHaveLength(1);
  });

  it("(d) has nothing to flag for a clean composition or empty input", () => {
    expect(compositionChecks({ composition: "Paracetamol IP 650 mg", strengthOnFront: "650" })).toEqual([]);
    expect(compositionChecks({ composition: "", strengthOnFront: "500" })).toEqual([]);
    expect(compositionChecks({ composition: "Paracetamol IP 650 mg", strengthOnFront: "  " })).toEqual([]);
  });
});

describe("compliance with composition checks", () => {
  const fields = {
    ...EMPTY_DRAFT,
    name: "Demozith 500",
    composition: "Azithromycin IP 500 mg",
    packSize: "3 tablets",
    mrp: "119.5",
    manufacturer: "Sample Pharma",
  };

  it("blocks when the front strength disagrees", () => {
    const checks = runChecks({ fields, confirmed: true, companyName: "Acme", strengthOnFront: "250" });
    expect(hasBlockingIssue(checks)).toBe(true);
    expect(checks.some((c) => c.text === "Front says 250, composition says 500 mg. Check the carton.")).toBe(true);
  });

  it("keeps passing when strengthOnFront is not given or matches", () => {
    expect(hasBlockingIssue(runChecks({ fields, confirmed: true, companyName: "Acme" }))).toBe(false);
    expect(hasBlockingIssue(runChecks({ fields, confirmed: true, companyName: "Acme", strengthOnFront: "500" }))).toBe(false);
  });

  it("warns without blocking for a unit-less composition", () => {
    const checks = runChecks({ fields: { ...fields, composition: "Azithromycin IP 500" }, confirmed: true, companyName: "Acme" });
    expect(hasBlockingIssue(checks)).toBe(false);
    expect(checks.some((c) => c.level === "warn" && c.text.startsWith("Composition has a number with no unit"))).toBe(true);
  });
});
