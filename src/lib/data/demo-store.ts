"use client";
// Demo-mode storage: products, company profile and photos kept in this browser (IndexedDB),
// so the whole app can be tried before the Cloudflare database is switched on. Nothing leaves the computer.
import type { Company, Product } from "../types";

const DB_NAME = "dawakraft-demo";
const DB_VERSION = 1;
const PRODUCTS = "products";
const COMPANY = "company";
const MEDIA = "media";
const COMPANY_KEY = "me";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PRODUCTS)) db.createObjectStore(PRODUCTS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(COMPANY)) db.createObjectStore(COMPANY);
      if (!db.objectStoreNames.contains(MEDIA)) db.createObjectStore(MEDIA);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("This browser can't store the demo catalog"));
  });
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = work(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error ?? new Error("Demo storage failed"));
        tx.onabort = () => reject(tx.error ?? new Error("Demo storage failed"));
      }),
  );
}

export async function listProducts(): Promise<Product[]> {
  const all = ((await run<Product[]>(PRODUCTS, "readonly", (s) => s.getAll())) ?? []) as Product[];
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function putProducts(list: Product[]): Promise<void> {
  await run(PRODUCTS, "readwrite", (s) => {
    list.forEach((p) => s.put(p));
  });
}

export async function deleteProducts(ids: string[]): Promise<void> {
  await run(PRODUCTS, "readwrite", (s) => {
    ids.forEach((id) => s.delete(id));
  });
}

export async function getCompany(): Promise<Company | null> {
  return ((await run<Company>(COMPANY, "readonly", (s) => s.get(COMPANY_KEY))) as Company | undefined) ?? null;
}

export async function putCompany(c: Company): Promise<void> {
  await run(COMPANY, "readwrite", (s) => s.put(c, COMPANY_KEY));
}

export async function putMedia(path: string, blob: Blob): Promise<void> {
  await run(MEDIA, "readwrite", (s) => s.put(blob, path));
}

export async function getMedia(path: string): Promise<Blob | null> {
  return ((await run<Blob>(MEDIA, "readonly", (s) => s.get(path))) as Blob | undefined) ?? null;
}

export async function deleteMedia(paths: string[]): Promise<void> {
  await run(MEDIA, "readwrite", (s) => {
    paths.forEach((p) => s.delete(p));
  });
}
