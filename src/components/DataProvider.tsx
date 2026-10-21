"use client";
// Holds the signed-in user's catalog and company profile for every screen,
// and caches product photos so each one downloads only once.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { EMPTY_COMPANY } from "@/lib/data/mappers";
import * as repo from "@/lib/data/repo";
import { loadImage } from "@/lib/image/encode";
import type { Company, Product } from "@/lib/types";

type DataState = {
  loaded: boolean;
  loadError: string | null;
  userId: string | null;
  products: Product[];
  company: Company;
  /** Replace or add one product in local state (after it was saved). */
  putProduct: (p: Product) => void;
  putProducts: (list: Product[]) => void;
  dropProducts: (ids: string[]) => void;
  setCompany: (c: Company) => void;
  reload: () => Promise<void>;
};

const DataContext = createContext<DataState | null>(null);

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

/** Load a stored photo once and reuse it across screens. */
export function mediaImage(path: string): Promise<HTMLImageElement | null> {
  const hit = imageCache.get(path);
  if (hit) return hit;
  const job = repo
    .downloadMedia(path)
    .then((blob) => (blob ? loadImage(URL.createObjectURL(blob)) : null))
    .catch(() => null);
  imageCache.set(path, job);
  job.then((img) => {
    if (!img) imageCache.delete(path);
  });
  return job;
}

/** Remember a just-uploaded photo so it shows without downloading it again. */
export function primeMediaImage(path: string, img: HTMLImageElement) {
  imageCache.set(path, Promise.resolve(img));
}

export function useMediaImage(path: string | null | undefined): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{ path: string; img: HTMLImageElement | null } | null>(null);
  useEffect(() => {
    if (!path) return;
    let live = true;
    mediaImage(path).then((img) => {
      if (live) setLoaded({ path, img });
    });
    return () => {
      live = false;
    };
  }, [path]);
  return path && loaded?.path === path ? loaded.img : null;
}

async function fetchAll() {
  try {
    const [uid, list, profile] = await Promise.all([repo.currentUserId(), repo.listProducts(), repo.getCompany()]);
    return { ok: true as const, uid, list, profile };
  } catch (e) {
    console.error("Catalog load failed", e);
    return { ok: false as const };
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [company, setCompany] = useState<Company>(EMPTY_COMPANY);

  const apply = useCallback((res: Awaited<ReturnType<typeof fetchAll>>) => {
    if (res.ok) {
      setUserId(res.uid);
      setProducts(res.list);
      setCompany(res.profile);
      setLoadError(null);
    } else {
      setLoadError("The catalog couldn't load. Reload the page to try again.");
    }
    setLoaded(true);
  }, []);

  const reload = useCallback(() => fetchAll().then(apply), [apply]);

  useEffect(() => {
    let live = true;
    fetchAll().then((res) => {
      if (live) apply(res);
    });
    return () => {
      live = false;
    };
  }, [apply]);

  const value = useMemo<DataState>(
    () => ({
      loaded,
      loadError,
      userId,
      products,
      company,
      putProduct: (p) =>
        setProducts((list) => {
          const rest = list.filter((x) => x.id !== p.id);
          return [p, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        }),
      putProducts: (more) =>
        setProducts((list) => [...more, ...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      dropProducts: (ids) => setProducts((list) => list.filter((p) => !ids.includes(p.id))),
      setCompany,
      reload,
    }),
    [loaded, loadError, userId, products, company, reload],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
