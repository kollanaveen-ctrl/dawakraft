// Canvas glue for straightening box faces. The maths lives in perspective.ts (pure); this file only
// moves pixels between canvases and plain buffers.
import { sourceCanvas } from "./cutout";
import { fileToImage } from "./encode";
import { mapQuad, orderQuad, rectSize, warpToRect, type PixelBuffer, type Quad } from "./perspective";

/**
 * Face photos are kept larger than the background-removal path (900px) because the side panels
 * carry composition and strength in small print that the AI must read later.
 */
export const FACE_SOURCE_MAX_SIDE = 1600;
/** Long side of a straightened face. */
export const FACE_MAX_SIDE = 1200;
/** A face smaller than this is a mis-placed set of corners, not a real face. */
const MIN_FACE_PX = 8;

/** Load a face photo and rotate it upright. Corners are always in this canvas's pixels. */
export async function loadFaceSource(src: File | HTMLImageElement, rot: number): Promise<HTMLCanvasElement> {
  const img = src instanceof HTMLImageElement ? src : await fileToImage(src);
  return sourceCanvas(img, rot, FACE_SOURCE_MAX_SIDE);
}

/** Read a canvas's pixels, shrunk first when `maxSide` is smaller than the canvas. */
export function readPixels(cv: HTMLCanvasElement, maxSide = Infinity): PixelBuffer | null {
  const s = Math.min(1, maxSide / Math.max(cv.width, cv.height, 1));
  const w = Math.max(1, Math.round(cv.width * s));
  const h = Math.max(1, Math.round(cv.height * s));
  let src = cv;
  if (s < 1) {
    src = document.createElement("canvas");
    src.width = w;
    src.height = h;
    src.getContext("2d")?.drawImage(cv, 0, 0, w, h);
  }
  const ctx = src.getContext("2d", { willReadFrequently: true });
  if (!ctx || !cv.width || !cv.height) return null;
  const im = ctx.getImageData(0, 0, w, h);
  return { width: w, height: h, data: im.data };
}

/** Draw a pixel buffer into a canvas (a new one unless `target` is given). */
export function bufferToCanvas(buf: PixelBuffer, target?: HTMLCanvasElement): HTMLCanvasElement {
  const cv = target ?? document.createElement("canvas");
  cv.width = buf.width;
  cv.height = buf.height;
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  const im = ctx.createImageData(buf.width, buf.height);
  im.data.set(buf.data);
  ctx.putImageData(im, 0, 0);
  return cv;
}

/**
 * Straighten the face inside `quad` (any corner order) into a flat rectangle, long side up to
 * `maxSide`. Only the pixels under the quad are read, which keeps this quick on a phone.
 * Null when the corners don't enclose a usable shape.
 */
export function straightenFace(source: HTMLCanvasElement, quad: Quad, maxSide = FACE_MAX_SIDE): HTMLCanvasElement | null {
  const ordered = orderQuad(quad);
  const size = rectSize(ordered, maxSide);
  if (size.width < MIN_FACE_PX || size.height < MIN_FACE_PX) return null;
  const xs = ordered.map((p) => p.x);
  const ys = ordered.map((p) => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const x1 = Math.min(source.width, Math.ceil(Math.max(...xs)));
  const y1 = Math.min(source.height, Math.ceil(Math.max(...ys)));
  const ctx = source.getContext("2d", { willReadFrequently: true });
  if (!ctx || x1 - x0 < 1 || y1 - y0 < 1) return null;
  const im = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
  const local = mapQuad(ordered, (p) => ({ x: p.x - x0, y: p.y - y0 }));
  const out = warpToRect({ width: im.width, height: im.height, data: im.data }, local, size.width, size.height);
  return out ? bufferToCanvas(out) : null;
}
