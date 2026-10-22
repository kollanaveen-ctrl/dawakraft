// Which photo shows the box's front, left end and top, and which shows the strip, bottle or tube
// that stands beside it. The product picture is built from these.
import type { ImageRole } from "./constants";

export type FaceRole = "front" | "side" | "top" | "pack" | "none";
export type Faces = { front: number; side: number | null; top: number | null; pack: number | null };
export type FaceRotations = { front: number; side: number; top: number; pack: number };

/** The three faces of a carton that build the 3D box. `side` is the left end, as in a printed catalogue. */
export type BoxFace = "front" | "side" | "top";
export const BOX_FACES: readonly BoxFace[] = ["front", "side", "top"];
/** Each face straightened into a flat rectangle (for the pack shot, and for the AI to read). */
export type FaceCanvases = Partial<Record<BoxFace, HTMLCanvasElement>>;

/** What stands beside the box in the product picture, placed the way a pharma catalogue shows it. */
export type PackKind = "strip" | "bottle" | "tube";
export const PACK_KINDS: readonly (readonly [PackKind, string])[] = [
  ["strip", "Strip (blister or alu-alu)"],
  ["bottle", "Bottle or vial"],
  ["tube", "Tube"],
];

export const NO_FACES: Faces = { front: 0, side: null, top: null, pack: null };
export const NO_ROTATION: FaceRotations = { front: 0, side: 0, top: 0, pack: 0 };

export function roleOf(faces: Faces, i: number): FaceRole {
  if (faces.front === i) return "front";
  if (faces.side === i) return "side";
  if (faces.top === i) return "top";
  if (faces.pack === i) return "pack";
  return "none";
}

/** Give photo `i` a role; each role belongs to at most one photo, and some photo is always the front. */
export function assignRole(faces: Faces, i: number, role: FaceRole, count: number): Faces {
  const clear = (v: number | null) => (v === i ? null : v);
  const next: Faces = { front: faces.front, side: clear(faces.side), top: clear(faces.top), pack: clear(faces.pack) };
  if (role === "side") next.side = i;
  if (role === "top") next.top = i;
  if (role === "pack") next.pack = i;
  if (role === "front") return { ...next, front: i };
  if (faces.front === i) {
    const other = Array.from({ length: count }, (_, k) => k).find((k) => k !== i && k !== next.side && k !== next.top && k !== next.pack);
    next.front = other ?? i;
  }
  return next;
}

/** Faces after photo `i` is removed (later photos shift down by one). */
export function removePhoto(faces: Faces, i: number, count: number): Faces {
  if (count <= 1) return NO_FACES;
  const shift = (v: number | null) => (v === null || v === i ? null : v > i ? v - 1 : v);
  return { front: shift(faces.front) ?? 0, side: shift(faces.side), top: shift(faces.top), pack: shift(faces.pack) };
}

/** The role sent to the AI for photo `i`: unassigned photos and the strip/bottle become "other". */
export function aiRoleOf(faces: Faces, i: number): ImageRole {
  const role = roleOf(faces, i);
  return role === "none" || role === "pack" ? "other" : role;
}
