// Splitting the catalog into printed-catalogue pages: products grouped into sections (by dosage
// form, as the company's printed catalogue does, or by therapy category), sorted by name, four to
// a page. Pure, so it is unit-tested.
import { CATEGORIES } from "../constants";
import type { Product } from "../types";

export const CARDS_PER_PAGE = 4;

export type GroupBy = "form" | "category";

/** Section names in the order the printed catalogue uses, by dosage form. */
const FORM_SECTIONS: readonly (readonly [string, readonly string[]])[] = [
  ["Tablets", ["Tablet"]],
  ["Capsules", ["Capsule"]],
  ["Liquid", ["Syrup", "Suspension"]],
  ["Dry Syrup", ["Dry syrup"]],
  ["Drops", ["Drops"]],
  ["Ointment", ["Ointment", "Cream", "Gel"]],
  ["Injections", ["Injection"]],
  ["Sachets", ["Sachet"]],
  ["Inhalers", ["Inhaler"]],
];
const OTHERS = "Others";

export type CataloguePage = {
  /** 1-based page number, as printed in the footer. */
  number: number;
  /** The section name shown in the header pill, e.g. "Tablets". */
  section: string;
  products: Product[];
};

/** The Indian financial year a date falls in, e.g. 22 Oct 2026 → "2026-27" (April to March). */
export function financialYear(date: Date): string {
  const y = date.getFullYear();
  const start = date.getMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** The section a product belongs to. */
export function sectionOf(p: Pick<Product, "form" | "category">, groupBy: GroupBy): string {
  if (groupBy === "category") return p.category || "Other";
  const form = (p.form || "").trim().toLowerCase();
  const hit = FORM_SECTIONS.find(([, forms]) => forms.some((f) => f.toLowerCase() === form));
  return hit ? hit[0] : OTHERS;
}

function sectionRank(section: string, groupBy: GroupBy): number {
  const order: readonly string[] = groupBy === "category" ? CATEGORIES : [...FORM_SECTIONS.map(([name]) => name), OTHERS];
  const i = order.indexOf(section);
  return i === -1 ? order.length : i;
}

/** Pages for the catalogue: each section starts on a new page, products A to Z within it. */
export function paginate(products: readonly Product[], groupBy: GroupBy, perPage = CARDS_PER_PAGE): CataloguePage[] {
  const sections = new Map<string, Product[]>();
  for (const p of products) {
    const s = sectionOf(p, groupBy);
    sections.set(s, [...(sections.get(s) ?? []), p]);
  }
  const ordered = [...sections.entries()].sort(
    ([a], [b]) => sectionRank(a, groupBy) - sectionRank(b, groupBy) || a.localeCompare(b),
  );
  const pages: CataloguePage[] = [];
  for (const [section, list] of ordered) {
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }));
    for (let i = 0; i < sorted.length; i += perPage) {
      pages.push({ number: pages.length + 1, section, products: sorted.slice(i, i + perPage) });
    }
  }
  return pages;
}
