"use client";
// All reads and writes go through here (products, company profile, photos): to the app's own API
// routes (backed by Cloudflare D1 and R2), or to this browser's own storage in demo mode
// (before NEXT_PUBLIC_DATA_BACKEND=cloudflare is set).
import { demoMode } from "../config";
import type { Company, Product } from "../types";
import * as demo from "./demo-store";
import { normalizeStoredProduct, toCompany, toCompanyRow } from "./mappers";

const INSERT_CHUNK = 100;
const DEMO_USER = "demo";

export class RepoError extends Error {
  constructor(message: string, public readonly cause?: unknown, public readonly code?: string) {
    super(message);
  }
}

/** Plain-language messages for the API's error codes (src/lib/api/respond.ts). */
const MESSAGES: Record<string, string> = {
  not_signed_in: "You've been signed out. Sign in again and retry.",
  forbidden: "You can't change this catalog. Sign in again and retry.",
  not_found: "That product isn't in your catalog any more. Reload the page.",
  invalid: "Some details are too long or not valid. Shorten them and try again.",
  bad_request: "Some details are too long or not valid. Shorten them and try again.",
  too_large: "That's too big to save. Use a smaller photo or fewer rows at a time.",
  rate_limited: "Too many tries in a short time. Wait a few minutes and try again.",
  not_configured: "The catalog isn't connected yet. Ask whoever set up Dawakraft to finish the setup.",
  storage_not_configured: "Photo storage isn't switched on yet, so photos can't be saved.",
  unavailable: "The catalog is busy or can't be reached. Wait a moment and try again.",
};

/** True when photo storage (R2) isn't set up yet: callers save without the photo instead of failing. */
export function storageOff(e: unknown): boolean {
  return e instanceof RepoError && e.code === "storage_not_configured";
}

/** Plain-language message for a failed save. */
export function friendlyError(e: unknown): string {
  if (e instanceof RepoError) return (e.code && MESSAGES[e.code]) || e.message;
  return "Couldn't save. Check your connection and try again.";
}

let leaving = false;

/** The session ended (expired or signed out elsewhere): clear the stale cookie, then go to /login. */
async function backToLogin(): Promise<void> {
  if (leaving || typeof window === "undefined") return;
  leaving = true;
  await fetch("/api/auth/signout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
  window.location.replace("/login");
}

type Envelope<T> ={ ok: true; data: T } | { ok: false; error: string };

/** Call one of the app's API routes and unwrap { ok, data }; failures throw a RepoError with the code. */
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers,
    });
  } catch (e) {
    throw new RepoError("Couldn't save. Check your connection and try again.", e, "network");
  }
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (res.ok && body?.ok) return body.data;
  const code = body && !body.ok ? body.error : `http_${res.status}`;
  if (code === "not_signed_in") void backToLogin();
  throw new RepoError(MESSAGES[code] ?? "Couldn't save. Check your connection and try again.", undefined, code);
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });

export async function currentUserId(): Promise<string | null> {
  if (demoMode) return DEMO_USER;
  const me = await api<{ userId: string; email: string } | null>("/api/auth/me");
  return me?.userId ?? null;
}

export async function signOut(): Promise<void> {
  if (demoMode) return;
  await api<null>("/api/auth/signout", { method: "POST" });
}

export async function listProducts(): Promise<Product[]> {
  if (demoMode) return (await demo.listProducts()).map(normalizeStoredProduct);
  return api<Product[]>("/api/data/products");
}

export async function saveProduct(p: Product): Promise<Product> {
  if (demoMode) {
    await demo.putProducts([p]);
    return p;
  }
  return api<Product>("/api/data/products", json("POST", p));
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
      saved = await api<Product[]>("/api/data/products/bulk", json("POST", { products: slice }));
    }
    done += saved.length;
    onChunk(saved, done);
  }
  return done;
}

export async function updateTemplate(p: Product, template: Product["template"]): Promise<Product> {
  if (demoMode) {
    const updated = { ...p, template, updatedAt: new Date().toISOString() };
    await demo.putProducts([updated]);
    return updated;
  }
  return api<Product>(`/api/data/products/${encodeURIComponent(p.id)}`, json("PATCH", { template }));
}

export async function deleteProducts(list: Product[]): Promise<void> {
  if (!list.length) return;
  if (demoMode) {
    await demo.deleteProducts(list.map((p) => p.id));
    await removeMedia(list.map((p) => p.imagePath));
    return;
  }
  // The server removes each product's photos too.
  await api<{ deleted: number }>("/api/data/products", json("DELETE", { ids: list.map((p) => p.id) }));
}

export async function getCompany(): Promise<Company> {
  if (demoMode) return (await demo.getCompany()) ?? toCompany(null);
  return api<Company>("/api/data/company");
}

export async function saveCompany(_userId: string, c: Company): Promise<Company> {
  const clean = toCompany(toCompanyRow(c));
  if (demoMode) {
    await demo.putCompany(clean);
    return clean;
  }
  return api<Company>("/api/data/company", json("PUT", clean));
}

/** Upload a photo under the user's own folder and return its storage path. */
export async function uploadMedia(userId: string, name: string, blob: Blob): Promise<string> {
  const type = blob.type === "image/webp" || blob.type === "image/jpeg" ? blob.type : "image/png";
  if (demoMode) {
    const ext = type === "image/webp" ? "webp" : type === "image/jpeg" ? "jpg" : "png";
    const path = `${userId}/${name}-${Date.now()}.${ext}`;
    await demo.putMedia(path, blob);
    return path;
  }
  const { path, url } = await api<{ path: string; url: string }>("/api/media/upload-url", json("POST", { name, contentType: type, size: blob.size }));
  let res: Response;
  try {
    res = await fetch(url, { method: "PUT", headers: { "Content-Type": type }, body: blob });
  } catch (e) {
    throw new RepoError("Couldn't upload the photo. Check your connection and try again.", e, "network");
  }
  if (!res.ok) throw new RepoError("Couldn't upload the photo. Check your connection and try again.", res.status, "upload_failed");
  return path;
}

/** Best-effort cleanup of replaced or deleted photos. */
export async function removeMedia(paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p));
  if (!list.length) return;
  if (demoMode) return demo.deleteMedia(list);
  try {
    await api<null>("/api/media", json("DELETE", { paths: list }));
  } catch (e) {
    console.warn("Photo cleanup failed", e instanceof RepoError ? e.code : e);
  }
}

export async function downloadMedia(path: string): Promise<Blob | null> {
  if (demoMode) return demo.getMedia(path);
  // The route answers with a redirect to a short-lived signed R2 link, which fetch follows.
  const res = await fetch(`/api/media?path=${encodeURIComponent(path)}`, { credentials: "same-origin", cache: "no-store" }).catch(() => null);
  return res?.ok ? res.blob() : null;
}
