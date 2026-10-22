import { describe, expect, it } from "vitest";
import { runChecks } from "../compliance";
import { TEMPLATES, USES_MAX } from "../constants";
import { parseImport } from "../csv";
import { EMPTY_DRAFT, asTemplate, draftToFields, normalizeStoredProduct, productToDraft, toProduct, toProductRow, type ProductRow } from "../data/mappers";
import { EMPTY_PROMO, type Promo } from "../promo";
import type { Product } from "../types";

const row: ProductRow = {
  id: "1", name: "Acipox- 400", composition: "Aciclovir 400mg", uses: "  Genital Herpes, Cold Sores, Shingles  ", form: "Tablet",
  pack_size: "Tablets 10x10", mrp: "146.89", schedule: "H", manufacturer: "M", marketed_by: "", storage: "", category: "Other",
  scheme: "", highlight: "", template: "catalog", image_path: null, example: false, launched_at: null,
  created_at: "2026-10-20T10:00:00.000Z", updated_at: "2026-10-20T10:00:00.000Z",
};

describe("catalogue card template", () => {
  it("is offered first in the layout list and survives a database round trip", () => {
    expect(TEMPLATES[0]).toEqual(["catalog", "Catalogue card"]);
    expect(asTemplate("catalog")).toBe("catalog");
    expect(toProduct(row).template).toBe("catalog");
  });
});

describe("demo-stored products", () => {
  it("fill in fields saved before promo and uses existed", () => {
    const old: Partial<Product> = { ...toProduct(row), template: "gone" as Product["template"] };
    delete old.promo;
    delete old.uses;
    const p = normalizeStoredProduct(old as Product);
    expect(p.promo).toEqual(EMPTY_PROMO);
    expect(p.uses).toBe("");
    expect(p.template).toBe("clean");
    expect(p.name).toBe("Acipox- 400");
  });

  it("keep a saved promo, tidied", () => {
    const p = normalizeStoredProduct({ ...toProduct(row), promo: { ...EMPTY_PROMO, headline: "  Hello  ", extra: 1 } as unknown as Promo });
    expect(p.promo.headline).toBe("Hello");
    expect("extra" in p.promo).toBe(false);
  });
});

describe("uses (indications) field", () => {
  it("round-trips through the database row, the wizard draft and back", () => {
    const p = toProduct(row);
    expect(p.uses).toBe(row.uses);
    expect(toProductRow(p).uses).toBe("Genital Herpes, Cold Sores, Shingles");
    expect(productToDraft(p).uses).toBe(row.uses);
    expect(draftToFields(productToDraft(p)).uses).toBe(row.uses);
    expect(EMPTY_DRAFT.uses).toBe("");
  });

  it("reads rows saved before the column existed as empty", () => {
    const old = { ...row, uses: undefined } as unknown as ProductRow;
    expect(toProduct(old).uses).toBe("");
  });

  it("is flagged by the claim-word check", () => {
    const fields = { ...EMPTY_DRAFT, name: "A", composition: "Amlodipine 5mg", uses: "Best for hypertension" };
    const bad = runChecks({ fields, confirmed: true, companyName: "Acme" }).find((c) => c.level === "bad");
    expect(bad?.text).toContain("best");
    const ok = runChecks({ fields: { ...fields, uses: "Hypertension, Angina" }, confirmed: true, companyName: "Acme" });
    expect(ok.some((c) => c.level === "bad")).toBe(false);
  });

  it("is imported from a uses or indications column, cut to the column limit", () => {
    const res = parseImport(`name,indications\nAmlovent-AT,"Hypertension, Angina"\nB,${"x".repeat(200)}`);
    expect(res.ok && res.rows[0]).toEqual({ name: "Amlovent-AT", uses: "Hypertension, Angina", mrp: null });
    expect(res.ok && res.rows[1].uses?.length).toBe(USES_MAX);
    const alias = parseImport("name,uses\nA,Vertigo");
    expect(alias.ok && alias.rows[0].uses).toBe("Vertigo");
  });
});
