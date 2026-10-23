import { describe, expect, it } from "vitest";
import { sourceHasEnoughPixels, UNSUPPORTED_PHOTO_MESSAGE } from "../image/photo-policy";
import { circularSize } from "../circular/render";
import { parsePromo } from "../promo";
import { flyerIssues } from "../studio";
import { normalizeCopy, copyPrompt } from "../ai/promo-copy";
import { photoPrompt } from "../ai/promo-photo";
import { POST } from "../../app/api/product-shot/route";

describe("original packaging and Story policy", () => {
  it("rejects unreadable resolution including invalid dimensions", () => {
    for (const size of [[399, 2000], [0, 900], [NaN, 900], [Infinity, 900]]) expect(sourceHasEnoughPixels(...size as [number, number])).toBe(false);
    expect(sourceHasEnoughPixels(400, 800)).toBe(true);
    expect(UNSUPPORTED_PHOTO_MESSAGE).toBe("The image you have uploaded doesn't support flyer generation.");
  });
  it("retires the package generation endpoint without requiring a provider", async () => {
    const response = await POST();
    expect(response.status).toBe(410);
    expect((await response.json()).message).toBe(UNSUPPORTED_PHOTO_MESSAGE);
  });
  it("keeps Story dimensions through save parsing and preserves old landscape designs", () => {
    expect(circularSize("promo", parsePromo({ format: "story" }))).toEqual({ width: 1080, height: 1920 });
    expect(circularSize("promo", parsePromo({}))).toEqual({ width: 1600, height: 1228 });
  });
  it("keeps inferred uses separate from approved indications and requires their review", () => {
    const draft = { headline: "Everyday support", banner: "FOR YOU", tagline: "", sections: [{ title: "Calcium", bullets: ["Supports bone maintenance"] }], indications: ["Osteoporosis"], suggestedUses: ["Nutritional calcium support"], visualBrief: "An adult enjoying gentle outdoor exercise" };
    const copy = normalizeCopy(draft, { uses: "", inferUses: true })!;
    expect(copy.indications).toEqual([]);
    expect(copy.suggestedUses).toEqual(draft.suggestedUses);
    expect(normalizeCopy(draft, { uses: "" })!.suggestedUses).toBeUndefined();
    const promo = parsePromo(copy);
    expect(flyerIssues(promo).join()).toContain("leaflet");
    expect(flyerIssues({ ...promo, usesCheckedFor: draft.suggestedUses.join(" | ") })).toEqual([]);
    expect(flyerIssues({ ...promo, suggestedUses: ["Different use"], usesCheckedFor: draft.suggestedUses.join(" | ") }).join()).toContain("leaflet");
  });
  it("links the visual to the full combination rather than a fixed generic person", () => {
    const input = { name: "Example", composition: "Calcium 500 mg + Vitamin D3 400 IU", uses: "", form: "Tablet", category: "", schedule: "", inferUses: true };
    expect(copyPrompt(input)).toContain("COMBINATION ANALYSIS");
    const prompt = photoPrompt({ ...input, format: "story", visualBrief: "Adult walking outdoors", variant: 2 });
    expect(prompt).toContain(input.composition);
    expect(prompt).toContain("vertical 9:16");
    expect(prompt).toContain("Adult walking outdoors");
    expect(prompt).toContain("Never default to a woman sitting on a sofa");
  });
});
