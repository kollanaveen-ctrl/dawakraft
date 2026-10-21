// Which box photo shows the front, the side and the top. The 3D pack shot is built from these.

export type FaceRole = "front" | "side" | "top" | "none";
export type Faces = { front: number; side: number | null; top: number | null };
export type FaceRotations = { front: number; side: number; top: number };

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
