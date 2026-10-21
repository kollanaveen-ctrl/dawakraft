// Perspective maths for straightening a photographed box face. A carton face in a photo is a
// skewed four-sided shape; a homography (projective transform) maps it back to a flat rectangle.
// Pure and DOM-free on purpose, so it runs in tests and could move to a worker later.

export type Point = { x: number; y: number };
/** Four corners, always in the order top-left, top-right, bottom-right, bottom-left. */
export type Quad = readonly [Point, Point, Point, Point];
/** The same shape as ImageData, so canvas pixels pass straight in. RGBA, row by row. */
export type PixelBuffer = { width: number; height: number; data: Uint8ClampedArray };
/** A 3x3 matrix, row by row, with the last entry fixed at 1. */
export type Homography = readonly number[];
export type Size = { width: number; height: number };

/** Side and top photos may disagree on depth by this share before we warn. */
export const MAX_DEPTH_MISMATCH = 0.2;
const SINGULAR = 1e-10;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Put four tapped points into top-left, top-right, bottom-right, bottom-left order, whatever order they came in. */
export function orderQuad(points: readonly Point[]): Quad {
  if (points.length !== 4) throw new Error("A box face needs exactly four corners");
  const cx = points.reduce((s, p) => s + p.x, 0) / 4;
  const cy = points.reduce((s, p) => s + p.y, 0) / 4;
  // With y pointing down, increasing angle runs clockwise on screen: left, top, right, bottom.
  const angle = (p: Point) => Math.atan2(p.y - cy, p.x - cx);
  const around = [...points].sort((a, b) => angle(a) - angle(b));
  // The top-left corner is the one nearest the image origin.
  const start = around.reduce((best, p, k) => (p.x + p.y < around[best].x + around[best].y ? k : best), 0);
  const at = (k: number) => around[(start + k) % 4];
  return [at(0), at(1), at(2), at(3)];
}

/** Width over height of the face, averaging opposite edges to soften the perspective. */
export function estimateAspect(quad: Quad): number {
  const [tl, tr, br, bl] = quad;
  const w = (dist(tl, tr) + dist(bl, br)) / 2;
  const h = (dist(tl, bl) + dist(tr, br)) / 2;
  return h > 0 ? w / h : 0;
}

/** Output size for a straightened face: its own pixel size, shrunk so the long side fits `maxSide`. */
export function rectSize(quad: Quad, maxSide: number): Size {
  const [tl, tr, br, bl] = quad;
  const w = (dist(tl, tr) + dist(bl, br)) / 2;
  const h = (dist(tl, bl) + dist(tr, br)) / 2;
  const s = Math.min(1, maxSide / Math.max(w, h, 1));
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

export function rectQuad(width: number, height: number): Quad {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

/** A new quad with `fn` applied to each corner (keeps the corner order). */
export function mapQuad(quad: Quad, fn: (p: Point, k: number) => Point): Quad {
  return [fn(quad[0], 0), fn(quad[1], 1), fn(quad[2], 2), fn(quad[3], 3)];
}

export function scaleQuad(quad: Quad, sx: number, sy: number): Quad {
  return mapQuad(quad, (p) => ({ x: p.x * sx, y: p.y * sy }));
}

/** Solve A·x = b by Gaussian elimination with partial pivoting. Null when A is (nearly) singular. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < SINGULAR) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = col + 1; r < n; r++) {
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r][n];
    for (let c = r + 1; c < n; c++) s -= m[r][c] * x[c];
    x[r] = s / m[r][r];
  }
  return x;
}

/** The homography taking each corner of `src` to the matching corner of `dst`. Null for a collapsed shape. */
export function homography(src: Quad, dst: Quad): Homography | null {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(a, b);
  return h && h.every(Number.isFinite) ? [...h, 1] : null;
}

export function applyHomography(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

/** Bilinear sample of `img` at (fx, fy) in pixel-centre coordinates, written into out[o..o+3]. Edges are clamped. */
function sampleInto(img: PixelBuffer, fx: number, fy: number, out: Uint8ClampedArray, o: number) {
  const { width: w, height: h, data: d } = img;
  const x = Math.min(w - 1, Math.max(0, fx));
  const y = Math.min(h - 1, Math.max(0, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const ax = x - x0;
  const ay = y - y0;
  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;
  for (let c = 0; c < 4; c++) {
    const top = d[i00 + c] + (d[i10 + c] - d[i00 + c]) * ax;
    const bottom = d[i01 + c] + (d[i11 + c] - d[i01 + c]) * ax;
    out[o + c] = top + (bottom - top) * ay;
  }
}

/**
 * Straighten the face inside `quad` (ordered tl, tr, br, bl) into an outW × outH rectangle.
 * Each output pixel is mapped back into the photo (inverse mapping, so there are no holes) and
 * read with bilinear sampling, which keeps small print such as composition and strength legible.
 * Returns a new buffer; null when the corners collapse onto a line.
 */
export function warpToRect(img: PixelBuffer, quad: Quad, outW: number, outH: number): PixelBuffer | null {
  if (!(outW > 0 && outH > 0) || !img.width || !img.height) return null;
  const h = homography(rectQuad(outW, outH), quad);
  if (!h) return null;
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    const py = y + 0.5;
    for (let x = 0; x < outW; x++) {
      const px = x + 0.5;
      const w = h[6] * px + h[7] * py + h[8];
      const sx = (h[0] * px + h[1] * py + h[2]) / w;
      const sy = (h[3] * px + h[4] * py + h[5]) / w;
      sampleInto(img, sx - 0.5, sy - 0.5, out, (y * outW + x) * 4);
    }
  }
  return { width: outW, height: outH, data: out };
}

export type DepthCheck = {
  ok: boolean;
  /** Box depth as a share of the front width, read from the side photo (null without one). */
  depthFromSide: number | null;
  /** Box depth as a share of the front width, read from the top photo (null without one). */
  depthFromTop: number | null;
  /** Relative difference between the two readings; 0 when only one is available. */
  mismatch: number;
};

/**
 * The side face is depth × height and the top face is width × depth, so each gives the box depth
 * independently. If they disagree by more than 20%, one of the two sets of corners is probably off.
 */
export function depthConsistency(frontAspect: number, sideAspect?: number | null, topAspect?: number | null): DepthCheck {
  const depthFromSide = sideAspect && sideAspect > 0 && frontAspect > 0 ? sideAspect / frontAspect : null;
  const depthFromTop = topAspect && topAspect > 0 ? 1 / topAspect : null;
  const mismatch =
    depthFromSide != null && depthFromTop != null
      ? Math.abs(depthFromSide - depthFromTop) / Math.max(depthFromSide, depthFromTop)
      : 0;
  return { ok: mismatch <= MAX_DEPTH_MISMATCH, depthFromSide, depthFromTop, mismatch };
}
