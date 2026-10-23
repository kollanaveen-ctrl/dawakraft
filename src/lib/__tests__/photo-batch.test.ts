import { describe, expect, it } from "vitest";
import { missingProductData, photoRequirements, usableViews, type PhotoView } from "../photo-batch";
import { EMPTY_DRAFT } from "../data/mappers";
import { BoxReadingSchema } from "../ai/types";
import { MOCK_READING } from "../ai/providers/mock";

const view = (index: number, face: PhotoView["view"], kind: PhotoView["kind"] = "box"): PhotoView => ({ index, view: face, kind, confidence: "high", usable: true, rotation: "0" });
describe("batch photo checks before 3D generation", () => {
  it("uses model indexes rather than upload order", () => {
    const views = usableViews([view(1, "front"), view(0, "side")], 2);
    expect(views.find(v => v.view === "front")?.index).toBe(1);
    expect(photoRequirements(views, false)).toEqual([]);
  });
  it("rejects duplicates and out-of-range indexes", () => {
    expect(usableViews([view(1, "front"), view(1, "side"), view(4, "side"), view(-1, "top")], 2)).toEqual([view(1, "front")]);
  });
  it("asks for a front and never uses a rear label as a 3D end", () => {
    expect(photoRequirements([], false).join()).toContain("front");
    expect(photoRequirements([view(0, "front"), view(1, "back")], false).join()).toContain("narrow box end");
  });
  it("asks again for blurry or uncertain views", () => {
    expect(photoRequirements([{ ...view(0, "front"), confidence: "low" }], false).join()).toContain("front");
    expect(photoRequirements([view(0, "front"), { ...view(1, "side"), usable: false }], false).join()).toContain("box end");
  });
  it("supports standalone bottles and the explicit original-photo option", () => {
    expect(photoRequirements([view(0, "front", "bottle")], false)).toEqual([]);
    expect(photoRequirements([view(0, "front")], false, false)).toEqual([]);
  });
  it("allows one verified carton photo without demanding invented sides", () => {
    expect(photoRequirements([view(0, "front")], false, false)).toEqual([]);
    expect(photoRequirements([view(0, "front"), view(1, "back")], false, false)).toEqual([]);
    expect(photoRequirements([{ ...view(0, "front"), usable: false }], false, false).join()).toContain("front");
  });
  it("blocks mixed products even when all views exist", () => {
    expect(photoRequirements([view(0, "front"), view(1, "side")], true).join()).toContain("different products");
  });
  it("asks for every missing required fact without generating substitutes", () => {
    expect(missingProductData(EMPTY_DRAFT)).toEqual(expect.arrayContaining(["brand name", "composition and strength", "pack size", "manufacturer", "dosage form", "MRP"]));
    expect(missingProductData({ ...EMPTY_DRAFT, mrp: "Infinity" })).toContain("MRP");
  });
  it("accepts old provider responses while validating new photo classifications", () => {
    expect(BoxReadingSchema.safeParse(MOCK_READING).success).toBe(true);
    expect(BoxReadingSchema.safeParse({ ...MOCK_READING, photoViews: [view(0, "front")], mixedProducts: false }).success).toBe(true);
    expect(BoxReadingSchema.safeParse({ ...MOCK_READING, photoViews: [{ ...view(0, "front"), rotation: "45" }] }).success).toBe(false);
  });
});
