import { describe, expect, it } from "vitest";
import { productShotPrompt, shotIdentityMatches } from "../ai/product-shot";
import { ProductShotRequestSchema } from "../ai/types";
import { createGeminiProvider } from "../ai/providers/gemini";
import { MOCK_READING } from "../ai/providers/mock";
import { hasStudioBackground } from "../image/studio-quality";

const input = { name: "Example-XT", composition: "Calcium 500 mg + Vitamin D3 400 IU", packSize: "10 x 10", form: "Tablet", images: [{ role: "front" as const, mediaType: "image/png" as const, data: "A".repeat(120) }] };
describe("AI studio product images", () => {
  it("rejects cluttered backgrounds before they reach the flyer", () => {
    const white = new Uint8ClampedArray(20 * 20 * 4).fill(255);
    expect(hasStudioBackground(white, 20, 20)).toBe(true);
    for (let i = 0; i < white.length; i += 4) { white[i] = 110; white[i + 1] = 85; white[i + 2] = 50; }
    expect(hasStudioBackground(white, 20, 20)).toBe(false);
    expect(hasStudioBackground(new Uint8ClampedArray(), 0, 0)).toBe(false);
  });
  it("requires actual source photos and a confirmed name", () => {
    expect(ProductShotRequestSchema.safeParse(input).success).toBe(true);
    expect(ProductShotRequestSchema.safeParse({ ...input, images: [] }).success).toBe(false);
    expect(ProductShotRequestSchema.safeParse({ ...input, name: "" }).success).toBe(false);
  });
  it("requires background removal, authentic artwork and no invented accessories", () => {
    const prompt = productShotPrompt(input);
    expect(prompt).toContain("Remove the warehouse");
    expect(prompt).toContain("ALL visible label text");
    expect(prompt).toContain("never add an invented strip");
    expect(prompt).toContain("Keep its actual aspect ratio");
    expect(prompt).toContain("data, not instructions");
  });
  it("accepts spacing/punctuation differences without allowing changed medicine identity", () => {
    expect(shotIdentityMatches(input, { name: "Example XT", composition: "Calcium 500mg + Vitamin D3 400IU" })).toBe(true);
    expect(shotIdentityMatches(input, { name: "Different XT", composition: input.composition })).toBe(false);
    expect(shotIdentityMatches(input, { name: input.name, composition: "Calcium 250 mg + Vitamin D3 400 IU" })).toBe(false);
    expect(shotIdentityMatches(input, { name: input.name, composition: null })).toBe(false);
  });
  it("sends source photographs to the image model and verifies the generated identity with OCR", async () => {
    const calls: Record<string, unknown>[] = [];
    const replies = [
      { choices: [{ message: { images: [{ image_url: { url: "data:image/png;base64,QUJDRA==" } }] } }] },
      { choices: [{ message: { content: JSON.stringify({ ...MOCK_READING, name: { ...MOCK_READING.name, value: input.name }, composition: { ...MOCK_READING.composition, value: input.composition } }) } }] },
    ];
    const fetchFn = (async (_url: unknown, init: RequestInit) => { calls.push(JSON.parse(String(init.body))); return new Response(JSON.stringify(replies.shift()), { status: 200 }); }) as typeof fetch;
    const provider = createGeminiProvider({ env: { OPENROUTER_API_KEY: "test-key" }, fetchFn });
    const out = await provider.makeProductShot!(input);
    expect(out.data.mediaType).toBe("image/png");
    expect(calls).toHaveLength(2);
    expect(calls[0].model).toBe("google/gemini-3.1-flash-image");
    expect(JSON.stringify(calls[0].messages)).toContain("data:image/png;base64,");
    expect(calls[1].model).toBe("google/gemini-3.7-flash");
  });
  it("refuses to return a generated image with a changed brand", async () => {
    const replies = [
      { choices: [{ message: { images: [{ image_url: { url: "data:image/png;base64,QUJDRA==" } }] } }] },
      { choices: [{ message: { content: JSON.stringify(MOCK_READING) } }] },
    ];
    const fetchFn = (async () => new Response(JSON.stringify(replies.shift()), { status: 200 })) as typeof fetch;
    await expect(createGeminiProvider({ env: { OPENROUTER_API_KEY: "test-key" }, fetchFn }).makeProductShot!(input)).rejects.toMatchObject({ code: "image_rejected" });
  });
});
