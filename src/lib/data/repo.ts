"use client";
// All reads and writes go through here (products, company profile, photos): to Supabase,
// or to this browser's own storage in demo mode (before real Supabase keys are added).
import type { PostgrestError } from "@supabase/supabase-js";
import { demoMode } from "../config";
import { supabaseBrowser } from "../supabase/client";
import type { Company, Product } from "../types";
import * as demo from "./demo-store";
import { normalizeStoredProduct, toCompany, toCompanyRow, toProduct, toProductRow, type CompanyRow, type ProductRow } from "./mappers";

const BUCKET = "media";
const INSERT_CHUNK = 100;
const DEMO_USER = "demo";

export class RepoError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

/** Plain-language message for a failed save. */
export function friendlyError(e: unknown): string {
  const code = (e as PostgrestError | undefined)?.code;
  if (code === "42501") return "You can't change this catalog. Sign in again and retry.";
  if (code === "23514" || code === "22001") return "Some details are too long or not valid. Shorten them and try again.";
  if (e instanceof RepoError) return e.message;
  return "Couldn't save. Check your connection and try again.";
}

function check<T>(res: { data: T; error: PostgrestError | null }): T {
  if (res.error) throw res.error;
  return res.data;
}

const db = () => supabaseBrowser();

export async function currentUserId(): Promise<string | null> {
  if (demoMode) return DEMO_USER;
  const { data } = await db().auth.getUser();
  return data.user?.id ?? null;
}

export async function signOut(): Promise<void> {
  if (demoMode) return;
  await db().auth.signOut();
}

export async function listProducts(): Promise<Product[]> {
  if (demoMode) return (await demo.listProducts()).map(normalizeStoredProduct);
  const rows = check(await db().from("products").select("*").order("created_at", { ascending: false }));
  return (rows as ProductRow[]).map(toProduct);
}

export async function saveProduct(p: Product): Promise<Product> {
  if (demoMode) {
    await demo.putProducts([p]);
    return p;
  }
  const row = check(await db().from("products").upsert(toProductRow(p)).select().single());
  return toProduct(row as ProductRow);
}

/** Insert in chunks; `onChunk` gets each saved chunk so the caller can show it even if a later chunk fails. */
export async function insertProducts(list: Product[], onChunk: (saved: Product[], done: number) => void): Promise<number> {
  let done = 0;
  for (let i = 0; i < list.length; i += INSERT_CHUNK) {
    const slice = list.slice(i, i + INSERT_CHUNK);
    let saved: Product[];
    if (demoMode) {
      await demo.putProducts(slice);
      saved = slice;
    } else {
      const rows = (check(await db().from("products").insert(slice.map(toProductRow)).select()) ?? []) as ProductRow[];
      saved = rows.map(toProduct);
    }
    done += saved.length;
    onChunk(saved, done);
  }
  return done;
}

export async function updateTemplate(p: Product, template: Product["template"]): Promise<Product> {
  const updated = { ...p, template, updatedAt: new Date().toISOString() };
  if (demoMode) await demo.putProducts([updated]);
  else check(await db().from("products").update({ template, updated_at: updated.updatedAt }).eq("id", p.id));
  return updated;
}

export async function deleteProducts(list: Product[]): Promise<void> {
  if (!list.length) return;
  if (demoMode) await demo.deleteProducts(list.map((p) => p.id));
  else check(await db().from("products").delete().in("id", list.map((p) => p.id)));
  await removeMedia(list.map((p) => p.imagePath));
}

export async function getCompany(): Promise<Company> {
  if (demoMode) return (await demo.getCompany()) ?? toCompany(null);
  const row = check(await db().from("companies").select("*").maybeSingle());
  return toCompany(row as CompanyRow | null);
}

export async function saveCompany(userId: string, c: Company): Promise<Company> {
  if (demoMode) {
    const clean = toCompany(toCompanyRow(c));
    await demo.putCompany(clean);
    return clean;
  }
  const payload = { ...toCompanyRow(c), owner_id: userId, updated_at: new Date().toISOString() };
  const row = check(await db().from("companies").upsert(payload, { onConflict: "owner_id" }).select().single());
  return toCompany(row as CompanyRow);
}

/** Upload a photo under the user's own folder and return its storage path. */
export async function uploadMedia(userId: string, name: string, blob: Blob): Promise<string> {
  const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
  const path = `${userId}/${name}-${Date.now()}.${ext}`;
  if (demoMode) {
    await demo.putMedia(path, blob);
    return path;
  }
  const { error } = await db().storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new RepoError("Couldn't upload the photo. Check your connection and try again.", error);
  return path;
}

/** Best-effort cleanup of replaced or deleted photos. */
export async function removeMedia(paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p));
  if (!list.length) return;
  if (demoMode) return demo.deleteMedia(list);
  const { error } = await db().storage.from(BUCKET).remove(list);
  if (error) console.warn("Photo cleanup failed", error.message);
}

export async function downloadMedia(path: string): Promise<Blob | null> {
  if (demoMode) return demo.getMedia(path);
  const { data, error } = await db().storage.from(BUCKET).download(path);
  return error ? null : data;
}
