// The 3D pack shot: the front, side and top faces are wrapped onto a box drawn at an angle (an
// oblique 3D view), giving a product picture for the circular. For a box, each face is first
// straightened from its four corners, so the box takes its real proportions from the carton. Other
// packs (bottle, tube, strip) keep the older background-removal path. It all runs on the phone.
import { BOX_FACES, type BoxFace, type FaceCanvases, type FaceCorners, type FaceRotations } from "../faces";
import { detectCornersOnCanvas } from "./corners";
import { cleanPhoto } from "./cutout";
import { fileToImage } from "./encode";
import type { Quad } from "./perspective";
import { loadFaceSource, straightenFace } from "./straighten";

const DEPTH_ANGLE = (32 * Math.PI) / 180;
const DEPTH_SCALE = 0.55;
const MIN_DEPTH_RATIO = 0.15;
const MAX_DEPTH_RATIO = 1.5;
const SHADOW_PAD = 0.08;

export type BoxGeometry = {
  /** Front face width and height, in pixels of the output. */
  w: number;
  h: number;
  /** Depth direction on screen: right and up. */
  dx: number;
  dy: number;
};

type Size = { width: number; height: number };

/** Work out the box shape from the photo sizes: depth comes from the side (or top) photo. */
export function boxGeometry(front: Size, side: Size | null, top: Size | null): BoxGeometry | null {
  const w = front.width;
  const h = front.height;
  let depth: number | null = null;
  if (side && side.height > 0) depth = side.width * (h / side.height);
  else if (top && top.width > 0) depth = top.height * (w / top.width);
  if (depth == null || !(w > 0 && h > 0)) return null;
  const d = Math.min(MAX_DEPTH_RATIO * w, Math.max(MIN_DEPTH_RATIO * w, depth)) * DEPTH_SCALE;
  return { w, h, dx: Math.round(d * Math.cos(DEPTH_ANGLE)), dy: Math.round(d * Math.sin(DEPTH_ANGLE)) };
}

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

function face(ctx: Ctx, pts: [Pt, Pt, Pt, Pt], img: HTMLCanvasElement | null, fill: string, shade: string) {
  ctx.save();
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = fill;
  ctx.fill();
  if (img && img.width && img.height) {
    // Map the photo's corners onto the face: its x-axis → (p1 - p0), its y-axis → (p3 - p0).
    const [p0, p1, , p3] = pts;
    ctx.setTransform(
      (p1[0] - p0[0]) / img.width,
      (p1[1] - p0[1]) / img.width,
      (p3[0] - p0[0]) / img.height,
      (p3[1] - p0[1]) / img.height,
      p0[0],
      p0[1],
    );
    ctx.drawImage(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.restore();
}

/**
 * Draw the box from face pictures (ideally straightened faces, whose sizes then give the box's true
 * proportions). Without a side or top there is no depth, so the flat front is returned.
 */
export function composePackShot(front: HTMLCanvasElement, side: HTMLCanvasElement | null, top: HTMLCanvasElement | null): HTMLCanvasElement {
  const g = boxGeometry(front, side, top);
  if (!g) return front;
  const { w, h, dx, dy } = g;
  const pad = Math.round(h * SHADOW_PAD);
  const out = document.createElement("canvas");
  out.width = w + dx + pad;
  out.height = h + dy + pad;
  const ctx = out.getContext("2d");
  if (!ctx) return front;

  // Soft shadow on the ground.
  ctx.save();
  ctx.filter = `blur(${Math.max(4, Math.round(pad / 2))}px)`;
  ctx.fillStyle = "rgba(15,31,36,0.22)";
  ctx.beginPath();
  ctx.ellipse(w / 2 + dx / 2, dy + h + pad * 0.25, w / 2 + dx / 2, pad * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const top0 = dy; // the front face starts below the depth offset
  face(ctx, [[0, top0], [w, top0], [w, top0 + h], [0, top0 + h]], front, "#FFFFFF", "rgba(0,0,0,0)");
  face(ctx, [[w, top0], [w + dx, top0 - dy], [w + dx, top0 - dy + h], [w, top0 + h]], side, "#C9D3D4", "rgba(0,0,0,0.14)");
  face(ctx, [[dx, top0 - dy], [w + dx, top0 - dy], [w, top0], [0, top0]], top, "#E4EAEA", "rgba(255,255,255,0.08)");

  // Crisp edges where the faces meet.
  ctx.strokeStyle = "rgba(15,31,36,0.18)";
  ctx.lineWidth = Math.max(1, Math.round(w / 300));
  ctx.beginPath();
  ctx.moveTo(w, top0 + h);
  ctx.lineTo(w, top0);
  ctx.lineTo(0, top0);
  ctx.moveTo(w, top0);
  ctx.lineTo(w + dx, top0 - dy);
  ctx.stroke();
  return out;
}

export type PackInput = {
  front: File | HTMLImageElement;
  side: File | null;
  top: File | null;
  rots: FaceRotations;
  removeBg: boolean;
  tol: number;
  threeD: boolean;
  /** Bottle, tube or strip: skip corners and use background removal instead. */
  notABox?: boolean;
  /** Corners the user placed; faces without corners use the auto-suggestion. */
  corners?: FaceCorners;
};

export type PackResult = {
  canvas: HTMLCanvasElement;
  ok: boolean;
  is3D: boolean;
  /** Straightened faces (box path only), kept so they can be sent to the AI. */
  faces?: FaceCanvases;
  /** The corners used for each face (box path only), including auto-suggested ones. */
  corners?: FaceCorners;
};

/** The pack shot from straightened faces: the 3D box when asked for and possible, else the flat front. */
export function packFromFaces(faces: FaceCanvases, threeD: boolean): { canvas: HTMLCanvasElement; is3D: boolean } | null {
  if (!faces.front) return null;
  if (!threeD || (!faces.side && !faces.top)) return { canvas: faces.front, is3D: false };
  const canvas = composePackShot(faces.front, faces.side ?? null, faces.top ?? null);
  return { canvas, is3D: canvas !== faces.front };
}

type StraightFace = { face: BoxFace; quad: Quad; source: HTMLCanvasElement; canvas: HTMLCanvasElement | null };

/** Box path: straighten every face that has a photo (side panels carry composition, so always all of them). */
async function buildBoxPack(input: PackInput, front: File): Promise<PackResult> {
  const files: Record<BoxFace, File | null> = { front, side: input.side, top: input.top };
  const done = await Promise.all(
    BOX_FACES.map(async (face): Promise<StraightFace | null> => {
      const file = files[face];
      if (!file) return null;
      const source = await loadFaceSource(file, input.rots[face]);
      const quad = input.corners?.[face] ?? detectCornersOnCanvas(source).quad;
      return { face, quad, source, canvas: straightenFace(source, quad) };
    }),
  );
  const present = done.filter((f): f is StraightFace => f !== null);
  const faces: FaceCanvases = Object.fromEntries(present.filter((f) => f.canvas).map((f) => [f.face, f.canvas]));
  const corners: FaceCorners = Object.fromEntries(present.map((f) => [f.face, f.quad]));
  const ok = present.every((f) => f.canvas);
  const pack = packFromFaces(faces, input.threeD);
  if (pack) return { ...pack, ok, faces, corners };
  // The front corners didn't make a usable shape: show the upright photo rather than nothing.
  const frontSource = present.find((f) => f.face === "front")?.source;
  if (!frontSource) throw new Error("No front photo");
  return { canvas: frontSource, ok: false, is3D: false, faces, corners };
}

/** Flat path: rotate each photo and (optionally) remove its background, then build the pack shot. */
async function buildCutoutPack(input: PackInput): Promise<PackResult> {
  const prep = async (src: File | HTMLImageElement | null, rot: number, removeBg: boolean) => {
    if (!src) return null;
    const img = src instanceof HTMLImageElement ? src : await fileToImage(src);
    return cleanPhoto(img, rot, removeBg, input.tol);
  };
  // A saved photo (editing without new photos) is already cleaned, so only rotate it.
  const front = await prep(input.front, input.rots.front, input.removeBg && !(input.front instanceof HTMLImageElement));
  if (!front) throw new Error("No front photo");
  if (!input.threeD || (!input.side && !input.top)) return { canvas: front.canvas, ok: front.ok, is3D: false };
  const [side, top] = await Promise.all([
    prep(input.side, input.rots.side, input.removeBg),
    prep(input.top, input.rots.top, input.removeBg),
  ]);
  const canvas = composePackShot(front.canvas, side?.canvas ?? null, top?.canvas ?? null);
  return { canvas, ok: front.ok && (side?.ok ?? true) && (top?.ok ?? true), is3D: canvas !== front.canvas };
}

/**
 * Build the product picture. New photos of a box are straightened from their corners; a saved
 * picture (editing without new photos) or a pack that is not a box goes through background removal.
 */
export async function buildPackImage(input: PackInput): Promise<PackResult> {
  if (input.notABox || !(input.front instanceof File)) return buildCutoutPack(input);
  return buildBoxPack(input, input.front);
}
