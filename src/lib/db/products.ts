// Server-only: SQL for the products table. Every statement is scoped to the signed-in owner
// (owner_id is always bound from the session), which replaces Supabase's row-level security.
// The builders are pure, so the tests can check that scoping directly.
import { chunkRows, placeholders, MAX_PARAMS, type D1Value, type Statement } from "../cloudflare/d1";
import { asTemplate, toProduct, toProductRow, type ProductRow } from "../data/mappers";
import type { Product } from "../types";
import type { ProductInput } from "./schemas";

/** Column order for INSERTs; owner_id comes first and is never taken from the client. */
export const PRODUCT_COLUMNS = [
  "owner_id", "id", "name", "composition", "uses", "form", "pack_size", "mrp", "schedule", "manufacturer",
  "marketed_by", "storage", "category", "scheme", "highlight", "template", "promo", "image_path", "example",
  "launched_at", "created_at", "updated_at",
] as const;

/** Columns an upsert may change on an existing row (never owner_id, id or created_at). */
const UPDATABLE = PRODUCT_COLUMNS.filter((c) => c !== "owner_id" && c !== "id" && c !== "created_at");

/** Hard cap on one listing, so a runaway catalog can't produce an unbounded response. */
export const LIST_LIMIT = 5000;

export function inputToProduct(input: ProductInput): Product {
  return { ...input, template: asTemplate(input.template) };
}

/** One row's values in PRODUCT_COLUMNS order, with the owner from the session. */
export function productValues(ownerId: string, p: Product): D1Value[] {
  const r = toProductRow(p);
  return [
    ownerId, r.id, r.name, r.composition, r.uses, r.form, r.pack_size, r.mrp == null ? null : Number(r.mrp), r.schedule,
    r.manufacturer, r.marketed_by, r.storage, r.category, r.scheme, r.highlight, r.template,
    JSON.stringify(r.promo ?? {}), r.image_path, r.example ? 1 : 0, r.launched_at, r.created_at, r.updated_at,
  ];
}

/** A raw D1 row (promo as JSON text, example as 0/1) as an app Product. */
export function rowToProduct(raw: Record<string, unknown>): Product {
  let promo: unknown = {};
  try {
    promo = typeof raw.promo === "string" ? JSON.parse(raw.promo) : raw.promo;
  } catch {
    promo = {};
  }
  return toProduct({ ...(raw as unknown as ProductRow), promo: promo as ProductRow["promo"], example: Boolean(raw.example) });
}

const COLUMN_LIST = PRODUCT_COLUMNS.join(", ");

export function listProductsSql(ownerId: string): Statement {
  return { sql: `SELECT * FROM products WHERE owner_id = ? ORDER BY created_at DESC LIMIT ${LIST_LIMIT}`, params: [ownerId] };
}

/**
 * Insert or update one product. On an id clash the update only applies when the existing row
 * has the same owner; otherwise nothing is returned and the route answers "not found".
 */
export function upsertProductSql(ownerId: string, p: Product): Statement {
  const set = UPDATABLE.map((c) => `${c} = excluded.${c}`).join(", ");
  return {
    sql:
      `INSERT INTO products (${COLUMN_LIST}) VALUES ${placeholders(1, PRODUCT_COLUMNS.length)} ` +
      `ON CONFLICT (id) DO UPDATE SET ${set} WHERE products.owner_id = excluded.owner_id RETURNING *`,
    params: productValues(ownerId, p),
  };
}

/** Multi-row INSERTs, each binding at most 100 values (4 products per statement). */
export function insertProductsSql(ownerId: string, list: Product[]): Statement[] {
  return chunkRows(list, PRODUCT_COLUMNS.length).map((rows) => ({
    sql: `INSERT INTO products (${COLUMN_LIST}) VALUES ${placeholders(rows.length, PRODUCT_COLUMNS.length)} RETURNING *`,
    params: rows.flatMap((p) => productValues(ownerId, p)),
  }));
}

export function updateTemplateSql(ownerId: string, id: string, template: string, updatedAt: string): Statement {
  return {
    sql: "UPDATE products SET template = ?, updated_at = ? WHERE owner_id = ? AND id = ? RETURNING *",
    params: [template, updatedAt, ownerId, id],
  };
}

/** Removes in chunks of 99 ids (plus the owner = 100 values), returning each row's photo paths. */
export function deleteProductsSql(ownerId: string, ids: string[]): Statement[] {
  return chunkRows(ids, 1, MAX_PARAMS - 1).map((chunk) => ({
    sql:
      `DELETE FROM products WHERE owner_id = ? AND id IN (${chunk.map(() => "?").join(", ")}) ` +
      `RETURNING image_path, json_extract(promo, '$.photoPath') AS photo_path`,
    params: [ownerId, ...chunk],
  }));
}
