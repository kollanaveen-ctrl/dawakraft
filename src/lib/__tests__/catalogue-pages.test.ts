import { describe, expect, it } from "vitest";
import { financialYear, paginate, sectionOf } from "../catalog/pages";
import type { Product } from "../types";
import { EMPTY_PROMO } from "../promo";

function product(name: string, form: string, category = "Other"): Product {
  return {
    id: name,
    name,
    composition: "",
    uses: "",
    form,
    packSize: "",
    mrp: null,
    schedule: "",
    manufacturer: "",
    marketedBy: "",
    storage: "",
    category,
    scheme: "",
    highlight: "",
    template: "catalog",
    promo: EMPTY_PROMO,
    imagePath: null,
    example: false,
    launchedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("the catalogue's financial year", () => {
  it("runs April to March, like the printed 'Product Catalogue 2026-27'", () => {
    expect(financialYear(new Date(2026, 9, 22))).toBe("2026-27");
    expect(financialYear(new Date(2026, 3, 1))).toBe("2026-27");
    expect(financialYear(new Date(2027, 2, 31))).toBe("2026-27");
    expect(financialYear(new Date(2026, 2, 31))).toBe("2025-26");
    expect(financialYear(new Date(2099, 5, 1))).toBe("2099-00");
  });
});

describe("splitting products into catalogue pages", () => {
  it("names sections by dosage form, like the printed catalogue", () => {
    expect(sectionOf(product("A", "Tablet"), "form")).toBe("Tablets");
    expect(sectionOf(product("A", "Syrup"), "form")).toBe("Liquid");
    expect(sectionOf(product("A", "suspension"), "form")).toBe("Liquid");
    expect(sectionOf(product("A", "Cream"), "form")).toBe("Ointment");
    expect(sectionOf(product("A", ""), "form")).toBe("Others");
    expect(sectionOf(product("A", "Tablet", "Cardiac"), "category")).toBe("Cardiac");
  });

  it("puts four products on a page, A to Z, and starts each section on a new page", () => {
    const list = [
      product("Bilotra 20", "Tablet"),
      product("Acipox 800", "Tablet"),
      product("Sinovent DM", "Syrup"),
      product("Acipox 400", "Tablet"),
      product("Activert 8", "Tablet"),
      product("Actigrain 10", "Tablet"),
      product("Calcivent", "Capsule"),
    ];
    const pages = paginate(list, "form");
    expect(pages.map((p) => [p.number, p.section, p.products.map((x) => x.name)])).toEqual([
      [1, "Tablets", ["Acipox 400", "Acipox 800", "Actigrain 10", "Activert 8"]],
      [2, "Tablets", ["Bilotra 20"]],
      [3, "Capsules", ["Calcivent"]],
      [4, "Liquid", ["Sinovent DM"]],
    ]);
  });

  it("sorts numbers inside names naturally", () => {
    const pages = paginate([product("Bilotra 40", "Tablet"), product("Bilotra 5", "Tablet"), product("Bilotra 20", "Tablet")], "form");
    expect(pages[0].products.map((p) => p.name)).toEqual(["Bilotra 5", "Bilotra 20", "Bilotra 40"]);
  });

  it("follows the category list order when grouped by therapy category", () => {
    const pages = paginate([product("Z", "Tablet", "Other"), product("Y", "Tablet", "Cardiac"), product("X", "Tablet", "Antibiotic")], "category");
    expect(pages.map((p) => p.section)).toEqual(["Antibiotic", "Cardiac", "Other"]);
  });

  it("makes no pages when there are no products", () => {
    expect(paginate([], "form")).toEqual([]);
  });
});
