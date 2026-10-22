// Server-only: SQL for the company profile (one row per owner, keyed by owner_id).
import type { Statement } from "../cloudflare/d1";
import { toCompanyRow } from "../data/mappers";
import type { Company } from "../types";

const COLUMNS = ["owner_id", "name", "tagline", "phone", "email", "address", "licence", "brand_color", "logo_path", "updated_at"] as const;

export function getCompanySql(ownerId: string): Statement {
  return { sql: "SELECT * FROM companies WHERE owner_id = ?", params: [ownerId] };
}

export function upsertCompanySql(ownerId: string, c: Company, updatedAt: string): Statement {
  const r = toCompanyRow(c);
  const set = COLUMNS.filter((col) => col !== "owner_id").map((col) => `${col} = excluded.${col}`).join(", ");
  return {
    sql: `INSERT INTO companies (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map(() => "?").join(", ")}) ON CONFLICT (owner_id) DO UPDATE SET ${set} RETURNING *`,
    params: [ownerId, r.name, r.tagline, r.phone, r.email, r.address, r.licence, r.brand_color, r.logo_path, updatedAt],
  };
}
