import { CATEGORIES, FORMS, IMPORT_MAX_ROWS } from "./constants";
import { parseMrp } from "./format";

export type ImportRow = {
  name: string;
  composition?: string;
  form?: string;
  packSize?: string;
  mrp?: number | null;
  manufacturer?: string;
  category?: string;
};

type ImportKey = keyof ImportRow;

const COLMAP: Record<string, ImportKey> = {
  name: "name",
  brand: "name",
  product: "name",
  "product name": "name",
  composition: "composition",
  generic: "composition",
  form: "form",
  "dosage form": "form",
  pack: "packSize",
  "pack size": "packSize",
  packing: "packSize",
  mrp: "mrp",
  price: "mrp",
  manufacturer: "manufacturer",
  "manufactured by": "manufacturer",
  company: "manufacturer",
  category: "category",
  "therapeutic category": "category",
};

/** Split CSV or tab-separated text (pasted from Excel) into rows of cells. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const delim = text.split("\n")[0].includes("\t") ? "\t" : ",";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// Same limits as the database columns, so one long cell can't fail a whole import.
const LIMITS: Partial<Record<ImportKey, number>> = {
  name: 200,
  composition: 500,
  packSize: 120,
  manufacturer: 200,
};
const MAX_MRP = 1e8;

export type ParseResult = { ok: true; rows: ImportRow[] } | { ok: false; error: string };

function matchListValue<T extends string>(list: readonly T[], value: string): T | undefined {
  return list.find((x) => x.toLowerCase() === value.toLowerCase());
}

/** Turn pasted text into product rows, using the header row to find columns. */
export function parseImport(text: string): ParseResult {
  const rows = parseCSV(text.trim());
  if (rows.length < 2) return { ok: false, error: "Add a header row and at least one product row." };
  const head = rows[0].map((h) => COLMAP[h.trim().toLowerCase()] ?? null);
  if (!head.includes("name")) return { ok: false, error: "The first row needs a column called name." };

  const parsed = rows
    .slice(1)
    .map((r) => {
      const raw: Partial<Record<ImportKey, string>> = {};
      head.forEach((k, i) => {
        if (k) raw[k] = (r[i] || "").trim().slice(0, LIMITS[k] ?? 200);
      });
      const mrp = raw.mrp ? parseMrp(raw.mrp) : null;
      const row: ImportRow = { ...raw, name: raw.name || "", mrp: mrp != null && mrp < MAX_MRP ? mrp : null };
      if (raw.form) row.form = matchListValue(FORMS, raw.form) ?? "Other";
      if (raw.category) row.category = matchListValue(CATEGORIES, raw.category) ?? "";
      return row;
    })
    .filter((r) => r.name)
    .slice(0, IMPORT_MAX_ROWS);
  return { ok: true, rows: parsed };
}
