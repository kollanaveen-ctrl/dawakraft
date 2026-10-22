// How the catalog sorts itself into segments: category, company, and new launch vs existing.
import type { Product } from "./types";

/** A product counts as a new launch for this many days, then moves to Existing by itself. */
export const NEW_LAUNCH_DAYS = 60;
const DAY_MS = 86_400_000;
const NEW_LAUNCH_TEXT = "New launch";

export type LaunchFilter = "all" | "new" | "existing";

export function isNewLaunch(p: Pick<Product, "launchedAt">, now = Date.now()): boolean {
  if (!p.launchedAt) return false;
  const t = Date.parse(p.launchedAt);
  return Number.isFinite(t) && now - t < NEW_LAUNCH_DAYS * DAY_MS;
}

/**
 * The highlight printed on the circular. "New launch" disappears by itself once the product
 * is no longer new, so a circular never calls an old product new.
 */
export function effectiveHighlight(p: Pick<Product, "highlight" | "launchedAt">, now = Date.now()): string {
  return highlightFor(p.highlight, isNewLaunch(p, now));
}

export function highlightFor(highlight: string, isNew: boolean): string {
  const h = highlight.trim();
  return !isNew && h.toLowerCase() === NEW_LAUNCH_TEXT.toLowerCase() ? "" : h;
}

/** When "New launch" is ticked or unticked, keep the highlight line in step with it. */
export function highlightOnToggle(highlight: string, isNew: boolean): string {
  const h = highlight.trim();
  if (isNew && !h) return NEW_LAUNCH_TEXT;
  return highlightFor(h, isNew);
}

/** The brand owner: "Marketed by" when printed, otherwise "Manufactured by". */
export function companyName(p: Pick<Product, "marketedBy" | "manufacturer">): string {
  return (p.marketedBy || p.manufacturer || "").trim();
}

const SUFFIXES = /\b(private|pvt|limited|ltd|llp|inc|co|company|corporation|corp)\b/g;

/** Groups spellings like "Cipla Ltd." and "CIPLA LIMITED" together. */
export function companyKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(SUFFIXES, " ").replace(/\s+/g, " ").trim();
}

export type CompanyGroup = { key: string; label: string; count: number };

/** Companies in the catalog, largest first; each labelled with its most common spelling. */
export function companyGroups(products: Pick<Product, "marketedBy" | "manufacturer">[]): CompanyGroup[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const p of products) {
    const name = companyName(p);
    const key = companyKey(name);
    if (!key) continue;
    const g = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() };
    g.count++;
    g.spellings.set(name, (g.spellings.get(name) ?? 0) + 1);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      count: g.count,
      label: [...g.spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export type SegmentFilter = { category: string; company: string; launch: LaunchFilter; query: string };

export function matchesSegment(p: Product, f: SegmentFilter, now = Date.now()): boolean {
  if (f.category !== "All" && (p.category || "Other") !== f.category) return false;
  if (f.company !== "All" && companyKey(companyName(p)) !== f.company) return false;
  if (f.launch !== "all" && isNewLaunch(p, now) !== (f.launch === "new")) return false;
  if (!f.query) return true;
  return [p.name, p.composition, p.uses, p.manufacturer, p.marketedBy, p.category].join(" ").toLowerCase().includes(f.query);
}

/**
 * The launch date to save when the user ticks or unticks "New launch": keep the original date
 * while still new, start a fresh one for a relaunch, clear it for an existing product.
 */
export function nextLaunchedAt(current: string | null, wantNew: boolean, nowIso: string): string | null {
  if (!wantNew) return null;
  return current && isNewLaunch({ launchedAt: current }, Date.parse(nowIso)) ? current : nowIso;
}
