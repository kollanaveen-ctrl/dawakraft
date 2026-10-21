// The 3D pack shot: the cleaned front, side and top photos are wrapped onto a box drawn at an
// angle (an oblique 3D view), giving a product picture for the circular. It runs on the phone,
// costs nothing, and takes well under a second.
import type { FaceRotations } from "../faces";
import { cleanPhoto } from "./cutout";
import { fileToImage } from "./encode";

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

/** Draw the box. Without a side or top photo there is no depth, so the flat front is returned. */
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
};

export type PackResult = { canvas: HTMLCanvasElement; ok: boolean; is3D: boolean };

/** Clean each face photo (rotate, remove background) and build the pack shot. */
export async function buildPackImage(input: PackInput): Promise<PackResult> {
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
