import type { Company, Product } from "./types";

export function mrpText(v: number | string | null | undefined): string {
  const n = Number(v);
  return v !== "" && v != null && Number.isFinite(n) && n > 0 ? "₹ " + n.toFixed(2) : "—";
}

export function slug(s: string | null | undefined): string {
  return (
    String(s || "product")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "product"
  ).slice(0, 60);
}

/** Parse a typed price like "₹ 32.50" into a positive number, or null. */
export function parseMrp(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** WhatsApp message for one product. */
export function shareText(
  p: Pick<Product, "name" | "composition" | "packSize" | "mrp" | "scheme" | "highlight">,
  c: Pick<Company, "name" | "phone">,
): string {
  return [
    p.highlight ? `*${p.highlight}: ${p.name}*` : `*${p.name}*`,
    p.composition,
    [p.packSize, p.mrp ? "MRP " + mrpText(p.mrp) : ""].filter(Boolean).join(" | "),
    p.scheme ? "Scheme: " + p.scheme : "",
    c.name ? `${c.name}${c.phone ? " · " + c.phone : ""}` : "",
    "For licensed trade only.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** "Copy catalog list" text for a set of products. */
export function catalogText(
  list: Pick<Product, "name" | "composition" | "packSize" | "mrp">[],
  c: Pick<Company, "name" | "phone">,
): string {
  const head = `*${c.name || "Product list"}*\n`;
  const body = list
    .map(
      (p) =>
        `• ${p.name}${p.composition ? " (" + p.composition + ")" : ""}${
          p.packSize ? " | " + p.packSize : ""
        }${p.mrp ? " | MRP " + mrpText(p.mrp) : ""}`,
    )
    .join("\n");
  return head + body + (c.phone ? `\n\nOrders: ${c.phone}` : "");
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}
