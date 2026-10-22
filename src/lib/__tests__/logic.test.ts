import { describe, expect, it } from "vitest";
import { aiSummary, mergeAiResult } from "../ai/box-read";
import { mix, textOn } from "../color";
import { bannedWords, hasBlockingIssue, runChecks } from "../compliance";
import { parseCSV, parseImport } from "../csv";
import { EMPTY_DRAFT, productToDraft, toProduct, toProductRow, type ProductRow } from "../data/mappers";
import { catalogText, mrpText, parseMrp, shareText, slug } from "../format";
import { allow } from "../rate-limit";

const goodFields = {
  ...EMPTY_DRAFT,
  name: "Exampol 650",
  composition: "Paracetamol IP 650 mg",
  packSize: "10 x 15 tablets",
  mrp: "32.5",
  manufacturer: "Example Pharma",
};

describe("compliance", () => {
  it("finds every banned claim word", () => {
    const text = "Cures fever, guaranteed 100 % relief, miracle, permanently, no side-effects, instant relief, best, safest, No.1, #1, risk free";
    expect(bannedWords(text)).toEqual([
      "cure", "guarantee", "100%", "miracle", "permanent", "no side effects", "instant relief", "best", "safest", "No. 1", "#1", "risk-free",
    ]);
  });

  it("does not flag words that only contain a banned word", () => {
    expect(bannedWords("Bestozyme, curcumin, secured pack")).toEqual([]);
  });

  it("blocks when the carton was not confirmed", () => {
    const checks = runChecks({ fields: goodFields, confirmed: false, companyName: "Acme" });
    expect(hasBlockingIssue(checks)).toBe(true);
  });

  it("blocks claim words in the highlight line", () => {
    const checks = runChecks({ fields: { ...goodFields, highlight: "Guaranteed results" }, confirmed: true, companyName: "Acme" });
    expect(checks.find((c) => c.level === "bad")?.text).toContain("guarantee");
  });

  it("passes a factual, confirmed product", () => {
    const checks = runChecks({ fields: goodFields, confirmed: true, companyName: "Acme" });
    expect(hasBlockingIssue(checks)).toBe(false);
    expect(checks.some((c) => c.text.startsWith("Trade-only line"))).toBe(true);
  });

  it("warns (without blocking) for missing fields, schedule H and no company", () => {
    const checks = runChecks({ fields: { ...goodFields, mrp: "", schedule: "H" }, confirmed: true, companyName: "" });
    expect(hasBlockingIssue(checks)).toBe(false);
    const warns = checks.filter((c) => c.level === "warn").map((c) => c.text);
    expect(warns[0]).toBe("Missing: MRP. Buyers expect these on a launch circular.");
    expect(warns.some((t) => t.startsWith("Schedule H product"))).toBe(true);
    expect(warns.some((t) => t.includes("company name is missing"))).toBe(true);
  });
});

describe("AI box reading", () => {
  it("fills fields and flags low-confidence ones", () => {
    const out = mergeAiResult(EMPTY_DRAFT, {
      name: { value: "Exampol 650", confidence: "high" },
      mrp: { value: "₹32.50", confidence: "low" },
      form: { value: "Caplet", confidence: "high" },
      category: { value: "Painkillers", confidence: "high" },
      schedule: { value: "Q", confidence: "high" },
      storage: { value: null, confidence: "low" },
    });
    expect(out.fields.name).toBe("Exampol 650");
    expect(out.fields.mrp).toBe("32.5");
    expect(out.fields.form).toBe("Other");
    expect(out.fields.category).toBe("Other");
    expect(out.fields.schedule).toBe("");
    expect(out.filled).toBe(4);
    expect(out.low).toEqual({ mrp: true });
  });

  it("keeps what the user typed when the AI returns nothing", () => {
    const out = mergeAiResult({ ...EMPTY_DRAFT, name: "Typed" }, null);
    expect(out.fields.name).toBe("Typed");
    expect(aiSummary(out)).toContain("Couldn't read the box clearly");
  });

  it("summarises how many fields were filled", () => {
    expect(aiSummary({ filled: 1, low: {} })).toBe("Filled 1 field. Check every field against the carton.");
    expect(aiSummary({ filled: 3, low: { mrp: true } })).toContain("especially the ones marked Check this");
  });
});

describe("CSV import", () => {
  it("parses quoted cells and tab-separated Excel pastes", () => {
    expect(parseCSV('name,composition\n"Dolo, 650","Paracetamol ""IP"""\n')).toEqual([
      ["name", "composition"],
      ["Dolo, 650", 'Paracetamol "IP"'],
    ]);
    expect(parseCSV("name\tmrp\r\nA\t10\r\n")).toEqual([["name", "mrp"], ["A", "10"]]);
  });

  it("maps header aliases and normalises values", () => {
    const res = parseImport("Brand,Packing,Price,Dosage Form,Category\nZincovit,15 tabs,Rs 105,tablet,vitamins & supplements\n,skip,,,");
    expect(res).toEqual({
      ok: true,
      rows: [{ name: "Zincovit", packSize: "15 tabs", mrp: 105, form: "Tablet", category: "Vitamins & supplements" }],
    });
  });

  it("keeps cells within database limits", () => {
    const res = parseImport(`name,form,mrp\n${"A".repeat(250)},Lozenge,999999999`);
    expect(res.ok && res.rows[0]).toEqual({ name: "A".repeat(200), form: "Other", mrp: null });
  });

  it("explains what is wrong with bad input", () => {
    expect(parseImport("name")).toEqual({ ok: false, error: "Add a header row and at least one product row." });
    expect(parseImport("brandname,mrp\nA,1")).toEqual({ ok: false, error: "The first row needs a column called name." });
  });
});

describe("formatting and sharing text", () => {
  const product = { name: "Exampol 650", composition: "Paracetamol IP 650 mg", packSize: "10 × 15", mrp: 32.5, scheme: "10+1 free", highlight: "" };

  it("formats MRP and file names", () => {
    expect(mrpText(32.5)).toBe("₹ 32.50");
    expect(mrpText(null)).toBe("—");
    expect(parseMrp("₹ 1,250.505")).toBe(1250.51);
    expect(parseMrp("0")).toBeNull();
    expect(slug("Exampol 650 / Tab")).toBe("exampol-650-tab");
  });

  it("builds the WhatsApp message with the trade-only line", () => {
    expect(shareText({ ...product, highlight: "New launch" }, { name: "Acme", phone: "98480 00000" })).toBe(
      "*New launch: Exampol 650*\nParacetamol IP 650 mg\n10 × 15 | MRP ₹ 32.50\nScheme: 10+1 free\nAcme · 98480 00000\nFor licensed trade only.",
    );
    // An existing product (no highlight) is not called new.
    expect(shareText(product, { name: "", phone: "" }).split("\n")[0]).toBe("*Exampol 650*");
  });

  it("builds the catalog list", () => {
    expect(catalogText([product], { name: "", phone: "" })).toBe("*Product list*\n• Exampol 650 (Paracetamol IP 650 mg) | 10 × 15 | MRP ₹ 32.50");
  });
});

describe("colour helpers", () => {
  it("picks readable text and blends colours", () => {
    expect(textOn("#F2B134")).toBe("#0F1F24");
    expect(textOn("#0B7A63")).toBe("#FFFFFF");
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });
});

describe("database mapping", () => {
  it("round-trips a product row", () => {
    const row: ProductRow = {
      id: "1", name: "A", composition: "", uses: "", form: "Tablet", pack_size: "10", mrp: "12.50", schedule: "H", manufacturer: "M",
      marketed_by: "", storage: "", category: "", scheme: "", highlight: "", template: "weird", image_path: null, example: false, launched_at: null,
      created_at: "2026-10-20T10:00:00.000Z", updated_at: "2026-10-20T10:00:00.000Z",
    };
    const p = toProduct(row);
    expect(p.mrp).toBe(12.5);
    expect(p.template).toBe("clean");
    expect(p.category).toBe("Other");
    expect(toProductRow(p).pack_size).toBe("10");
    expect(productToDraft(p).mrp).toBe("12.5");
  });
});

describe("rate limit", () => {
  it("allows up to the limit within a window, then resets", () => {
    const key = `t-${Math.random()}`;
    expect(allow(key, 2, 1000, 0)).toBe(true);
    expect(allow(key, 2, 1000, 10)).toBe(true);
    expect(allow(key, 2, 1000, 20)).toBe(false);
    expect(allow(key, 2, 1000, 1001)).toBe(true);
  });
});
