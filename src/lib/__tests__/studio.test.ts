import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT } from "../data/mappers";
import { initialFlyer, studioIssues, flyerIssues } from "../studio";
import { parsePromo, promoText } from "../promo";

const product = { ...EMPTY_DRAFT, name: "Example 500", composition: "Paracetamol IP 500 mg", packSize: "10 x 10", mrp: "120", manufacturer: "Example Pharma" };
describe("flyer studio safety", () => {
  it("does not invent benefits or split clinical indications", () => {
    const promo = initialFlyer({ ...product, uses: "Nausea, vomiting" });
    expect(promo.sections).toEqual([{ title: "FORMULATION", bullets: ["Paracetamol"] }]);
    expect(promo.indications).toEqual([]);
    expect(promo.headline).toBe("Composition & pack details");
  });
  it("requires complete facts, company name and confirmation", () => {
    expect(studioIssues(product, true, "Example Trade")).toEqual([]);
    expect(studioIssues({ ...product, composition: "" }, true, "Example Trade").join()).toContain("composition");
    expect(studioIssues(product, false, "Example Trade")).not.toEqual([]);
    expect(studioIssues(product, true, "")).not.toEqual([]);
  });
  it("blocks invalid prices and a mismatched front strength", () => {
    for (const mrp of ["", "0", "-1", "Infinity", "100000000", "not a price"]) expect(studioIssues({ ...product, mrp }, true, "Trade").join()).toContain("MRP");
    expect(studioIssues(product, true, "Trade", "250 mg")).not.toEqual([]);
  });
  it("keeps existing layouts compatible and round trips new layouts", () => {
    expect(parsePromo({}).layout).toBeUndefined();
    expect(parsePromo({ layout: "other" }).layout).toBeUndefined();
    expect(parsePromo({ layout: "portrait" }).layout).toBe("portrait");
    expect(parsePromo(initialFlyer(product)).layout).toBe("editorial");
  });
  it("blocks claims until reviewed and invalidates approval after editing", () => {
    const promo = { ...initialFlyer(product), headline: "Rapid relief" };
    expect(flyerIssues(promo)).not.toEqual([]);
    const approved = { ...promo, claimsCheckedFor: promoText(promo) };
    expect(flyerIssues(approved)).toEqual([]);
    expect(flyerIssues({ ...approved, headline: "Rapid response" })).not.toEqual([]);
    expect(flyerIssues({ ...approved, headline: "Guaranteed cure" })).not.toEqual([]);
  });
});
