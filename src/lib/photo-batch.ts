import type { BoxReading } from "./ai/types";
import type { DraftFields } from "./types";

export type PhotoView = NonNullable<BoxReading["photoViews"]>[number];
export const VIEW_LABELS = { front: "Front", side: "Box end", top: "Top", back: "Details panel", pack: "Strip / bottle / tube", other: "Needs identifying" } as const;

/** Ignore out-of-range indexes and duplicate assignments from a malformed model response. */
export function usableViews(views: PhotoView[] | undefined, count: number): PhotoView[] {
  const seen = new Set<number>();
  return (views ?? []).filter(v => {
    if (!Number.isInteger(v.index) || v.index < 0 || v.index >= count || seen.has(v.index)) return false;
    seen.add(v.index); return true;
  });
}

export function photoRequirements(views: PhotoView[], mixed: boolean, threeD = true): string[] {
  if (mixed) return ["These photos appear to show different products or strengths. Keep photos of one product only, then analyse again."];
  const front = views.find(v => v.view === "front" && v.confidence === "high" && v.usable);
  if (!front) return ["Add a clear photo of the product front with the brand facing the camera, then check photos with AI."];
  if (threeD && front.kind === "box" && !views.some(v => v.view === "side" && v.kind === "box" && v.confidence === "high" && v.usable)) return ["For a 3D box image, add a clear photo of the narrow box end. A rear details panel cannot be used as the box end."];
  return [];
}

export function missingProductData(fields: DraftFields): string[] {
  const labels = { name: "brand name", composition: "composition and strength", packSize: "pack size", manufacturer: "manufacturer", form: "dosage form" };
  const missing = (Object.keys(labels) as (keyof typeof labels)[]).filter(k => !fields[k].trim()).map(k => labels[k]);
  if (!(Number(fields.mrp) > 0) || !Number.isFinite(Number(fields.mrp))) missing.push("MRP");
  return missing;
}
