import { describe, expect, it } from "vitest";
import { promoIndications } from "../circular/promo/render";
import { dominantHue, themeForHue } from "../circular/promo/theme";
import { EMPTY_PROMO, PROMO_LIMITS, claimsConfirmed, parsePromo, promoClaims, promoText, splitBrand } from "../promo";

describe("promo content from storage or the AI", () => {
  it("keeps known fields, drops unknown ones and empty points, and applies the limits", () => {
    const p = parsePromo({
      headline: "  Women of today are active  ",
      banner: "x".repeat(200),
      sections: [
        { title: "Calcium Carbonate", bullets: ["Supports bone strength", "", 42, "a", "b"] },
        { title: "", bullets: [] },
        { title: "Two" },
        { title: "Three" },
        { title: "Four" },
      ],
      indications: ["Osteoporosis", "", "Pregnancy & Lactation"],
      photoPath: "",
      evil: "<script>",
    });
    expect(p.headline).toBe("Women of today are active");
    expect(p.banner).toHaveLength(PROMO_LIMITS.banner);
    expect(p.sections.map((s) => s.title)).toEqual(["Calcium Carbonate", "Two", "Three"]);
    expect(p.sections[0].bullets).toEqual(["Supports bone strength", "a", "b"]);
    expect(p.indications).toEqual(["Osteoporosis", "Pregnancy & Lactation"]);
    expect(p.photoPath).toBeNull();
    expect("evil" in p).toBe(false);
  });

  it("reads anything else as empty content", () => {
    expect(parsePromo(null)).toEqual(EMPTY_PROMO);
    expect(parsePromo("text")).toEqual(EMPTY_PROMO);
    expect(parsePromo({})).toEqual(EMPTY_PROMO);
  });
});

describe("claim checks on the promo text", () => {
  const base = { ...EMPTY_PROMO, headline: "For everyday bone strength", indications: ["Osteoporosis"] };

  it("finds banned words, which block sharing", () => {
    expect(promoClaims({ ...base, tagline: "The best calcium" }).banned).toEqual(["best"]);
    expect(promoClaims({ ...base, sections: [{ title: "X", bullets: ["Cures pain"] }] }).banned).toEqual(["cure"]);
  });

  it("finds strong claims, which need the person's confirmation for exactly this text", () => {
    const strong = { ...base, tagline: "Prevents NTDs & early loss of pregnancy", banner: "FDA approved" };
    expect(promoClaims(strong).strong).toEqual(["prevents", "FDA"]);
    expect(claimsConfirmed(strong)).toBe(false);
    const ticked = { ...strong, claimsCheckedFor: promoText(strong) };
    expect(claimsConfirmed(ticked)).toBe(true);
    // Any edit asks again.
    expect(claimsConfirmed({ ...ticked, headline: "Changed" })).toBe(false);
  });

  it("needs no confirmation when there are no strong claims", () => {
    expect(promoClaims(base)).toEqual({ banned: [], strong: [] });
    expect(claimsConfirmed(base)).toBe(true);
  });
});

describe("brand wordmark and suffix badge", () => {
  it("splits the suffix the way the company circulars show it", () => {
    expect(splitBrand("Ventocal XT")).toEqual({ base: "Ventocal", suffix: "XT" });
    expect(splitBrand("Doloride-SP")).toEqual({ base: "Doloride", suffix: "SP" });
    expect(splitBrand("Ondilium-MD8")).toEqual({ base: "Ondilium", suffix: "MD8" });
    expect(splitBrand("Montiride-AB")).toEqual({ base: "Montiride", suffix: "AB" });
    expect(splitBrand("Acipox- 400")).toEqual({ base: "Acipox", suffix: "400" });
  });

  it("keeps plain names whole", () => {
    expect(splitBrand("Acipox")).toEqual({ base: "Acipox", suffix: "" });
    expect(splitBrand("Flutigra Nasal Spray")).toEqual({ base: "Flutigra Nasal Spray", suffix: "" });
    expect(splitBrand("")).toEqual({ base: "", suffix: "" });
  });
});

describe("colour theme from the pack", () => {
  const pixels = (rgb: [number, number, number], n: number, alpha = 255) => {
    const d = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) d.set([...rgb, alpha], i * 4);
    return d;
  };

  it("finds the strongest colour and ignores white, grey and see-through pixels", () => {
    const mix = new Uint8ClampedArray([...pixels([255, 255, 255], 400), ...pixels([128, 128, 128], 400), ...pixels([90, 40, 160], 200), ...pixels([0, 0, 0], 300, 0)]);
    const hue = dominantHue(mix, 1);
    expect(hue).not.toBeNull();
    expect(themeForHue(hue).key).toBe("purple");
    expect(dominantHue(pixels([250, 250, 250], 500), 1)).toBeNull();
  });

  it("pairs pack colours with the circular themes", () => {
    expect(themeForHue(null).key).toBe("navy");
    expect(themeForHue(220).key).toBe("navy");
    expect(themeForHue(25).key).toBe("orange");
    expect(themeForHue(150).key).toBe("green");
    expect(themeForHue(320).key).toBe("magenta");
    expect(themeForHue(190).key).toBe("blue");
  });
});

describe("indications on the circular", () => {
  it("uses the promo list, else the product's Uses split at commas", () => {
    expect(promoIndications({ ...EMPTY_PROMO, indications: ["A"] }, "B, C")).toEqual(["A"]);
    expect(promoIndications(EMPTY_PROMO, "Hypertension, Angina; Stroke prevention.")).toEqual(["Hypertension", "Angina", "Stroke prevention"]);
    expect(promoIndications(EMPTY_PROMO, "")).toEqual([]);
  });
});
