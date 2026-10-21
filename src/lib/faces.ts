// Which box photo shows the front, the side and the top. The 3D pack shot is built from these.
import type { ImageRole } from "./constants";
import type { Quad } from "./image/perspective";

export type FaceRole = "front" | "side" | "top" | "none";
export type Faces = { front: number; side: number | null; top: number | null };
export type FaceRotations = { front: number; side: number; top: number };

/** The three faces of a carton that build the 3D pack shot. */
export type BoxFace = keyof FaceRotations;
export const BOX_FACES: readonly BoxFace[] = ["front", "side", "top"];
/** Corners the user placed, per face, in the rotated photo's pixels. A missing face uses the auto-suggestion. */
export type FaceCorners = Partial<Record<BoxFace, Quad>>;
/** Each face straightened into a flat rectangle (for the pack shot, and later for the AI to read). */
export type FaceCanvases = Partial<Record<BoxFace, HTMLCanvasElement>>;

export const NO_FACES: Faces = { front: 0, side: null, top: null };
export const NO_ROTATION: FaceRotations = { front: 0, side: 0, top: 0 };

export function roleOf(faces: Faces, i: number): FaceRole {
  if (faces.front === i) return "front";
  if (faces.side === i) return "side";
  if (faces.top === i) return "top";
  return "none";
}

/** Give photo `i` a role; each role belongs to at most one photo, and some photo is always the front. */
export function assignRole(faces: Faces, i: number, role: FaceRole, count: number): Faces {
  const clear = (v: number | null) => (v === i ? null : v);
  const next: Faces = { front: faces.front, side: clear(faces.side), top: clear(faces.top) };
  if (role === "side") next.side = i;
  if (role === "top") next.top = i;
  if (role === "front") return { ...next, front: i };
  if (faces.front === i) {
    const other = Array.from({ length: count }, (_, k) => k).find((k) => k !== i && k !== next.side && k !== next.top);
    next.front = other ?? i;
  }
  return next;
}

/** Faces after photo `i` is removed (later photos shift down by one). */
export function removePhoto(faces: Faces, i: number, count: number): Faces {
  if (count <= 1) return NO_FACES;
  const shift = (v: number | null) => (v === null || v === i ? null : v > i ? v - 1 : v);
  return { front: shift(faces.front) ?? 0, side: shift(faces.side), top: shift(faces.top) };
}

/** Corners without the given face (after it is rotated, its old corners no longer fit). */
export function withoutCorners(corners: FaceCorners, face: BoxFace): FaceCorners {
  return Object.fromEntries(Object.entries(corners).filter(([k]) => k !== face)) as FaceCorners;
}

/** The role sent to the AI for photo `i`: unassigned photos become "other". */
export function aiRoleOf(faces: Faces, i: number): ImageRole {
  const role = roleOf(faces, i);
  return role === "none" ? "other" : role;
}
