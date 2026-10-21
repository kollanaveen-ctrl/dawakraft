// Auto-suggested corners for a box face. The same flood-fill that removes the background finds the
// carton; its corners are the outermost product pixels along the two diagonals. The user then drags
// any corner that is off, so this only has to be close.
import { DEFAULT_TOLERANCE, backgroundMask } from "./cutout";
import { scaleQuad, type PixelBuffer, type Quad } from "./perspective";
import { readPixels } from "./straighten";

/** Fallback when detection fails: a rectangle 8% inside the photo edges. */
export const FALLBACK_INSET = 0.08;
/** The product must cover at least this share of the photo to count as found... */
const MIN_FACE_SHARE = 0.04;
/** ...and less than this share, otherwise the flood-fill found no background at all. */
const MAX_FACE_SHARE = 0.97;
/** Detection runs on a small copy; corners only need to be roughly right. */
const DETECT_MAX_SIDE = 360;

export type CornerGuess = { quad: Quad; found: boolean };

export function insetQuad(width: number, height: number, inset = FALLBACK_INSET): Quad {
  const x0 = width * inset;
  const y0 = height * inset;
  const x1 = width * (1 - inset);
  const y1 = height * (1 - inset);
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/** Keep only the largest connected blob of the mask (1 = product), so specks of shadow don't pull a corner out. */
export function largestComponent(mask: Uint8Array, w: number, h: number): { mask: Uint8Array; size: number } {
  const label = new Int32Array(w * h);
  const q = new Int32Array(w * h);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || label[start]) continue;
    next++;
    let qh = 0;
    let qt = 0;
    q[qt++] = start;
    label[start] = next;
    while (qh < qt) {
      const i = q[qh++];
      const x = i % w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const j of nb) {
        if (j < 0 || j >= w * h || !mask[j] || label[j]) continue;
        label[j] = next;
        q[qt++] = j;
      }
    }
    if (qt > bestSize) {
      bestSize = qt;
      best = next;
    }
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (best && label[i] === best) out[i] = 1;
  return { mask: out, size: bestSize };
}

/**
 * Corners of the product blob in `mask` (1 = product): top-left has the smallest x+y, bottom-right
 * the largest, top-right the largest x−y and bottom-left the smallest. Corners sit on pixel edges.
 * Null when the blob is too small or fills the whole photo.
 */
export function cornersFromMask(mask: Uint8Array, w: number, h: number): Quad | null {
  if (!(w > 0 && h > 0) || mask.length !== w * h) return null;
  const { mask: blob, size } = largestComponent(mask, w, h);
  if (size < w * h * MIN_FACE_SHARE || size > w * h * MAX_FACE_SHARE) return null;
  let tl = 0;
  let br = 0;
  let tr = 0;
  let bl = 0;
  let minSum = Infinity;
  let maxSum = -Infinity;
  let minDiff = Infinity;
  let maxDiff = -Infinity;
  for (let i = 0; i < w * h; i++) {
    if (!blob[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    const sum = x + y;
    const diff = x - y;
    if (sum < minSum) {
      minSum = sum;
      tl = i;
    }
    if (sum > maxSum) {
      maxSum = sum;
      br = i;
    }
    if (diff > maxDiff) {
      maxDiff = diff;
      tr = i;
    }
    if (diff < minDiff) {
      minDiff = diff;
      bl = i;
    }
  }
  const at = (i: number, ox: number, oy: number) => ({ x: (i % w) + ox, y: Math.floor(i / w) + oy });
  return [at(tl, 0, 0), at(tr, 1, 0), at(br, 1, 1), at(bl, 0, 1)];
}

/** Corners of the box face in `img`, or null when the box can't be told apart from the background. */
export function findCorners(img: PixelBuffer, tol = DEFAULT_TOLERANCE): Quad | null {
  const { width: w, height: h } = img;
  if (!(w > 0 && h > 0)) return null;
  const bg = backgroundMask(img.data, w, h, tol);
  const product = bg.map((v) => (v ? 0 : 1));
  return cornersFromMask(product, w, h);
}

/** Corners of the box face, falling back to a rectangle just inside the photo edges. */
export function autoCorners(img: PixelBuffer, tol = DEFAULT_TOLERANCE): Quad {
  return findCorners(img, tol) ?? insetQuad(img.width, img.height);
}

/** Canvas wrapper: detect on a small copy, then scale the corners back to the canvas's pixels. */
export function detectCornersOnCanvas(cv: HTMLCanvasElement, tol = DEFAULT_TOLERANCE): CornerGuess {
  const small = readPixels(cv, DETECT_MAX_SIDE);
  const found = small ? findCorners(small, tol) : null;
  if (!small || !found) return { quad: insetQuad(cv.width, cv.height), found: false };
  return { quad: scaleQuad(found, cv.width / small.width, cv.height / small.height), found: true };
}
