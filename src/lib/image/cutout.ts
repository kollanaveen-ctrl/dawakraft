// Background removal that runs on the phone: flood-fill from the photo's edges
// and clear pixels close to the edge colour. Ported unchanged from the prototype.

export const DEFAULT_TOLERANCE = 46;
const SOURCE_MAX_SIDE = 900;
const MIN_KEPT_SHARE = 0.04;
const EDGE_ALPHA = 150;
const CROP_PAD = 8;

/** Downscale and rotate a photo onto a canvas. */
export function sourceCanvas(img: HTMLImageElement | ImageBitmap, rot: number, maxSide: number): HTMLCanvasElement {
  const iw = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const ih = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const s = Math.min(1, maxSide / Math.max(iw, ih));
  const w = Math.round(iw * s);
  const h = Math.round(ih * s);
  const sw = rot % 180 ? h : w;
  const sh = rot % 180 ? w : h;
  const cv = document.createElement("canvas");
  cv.width = sw;
  cv.height = sh;
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  ctx.translate(sw / 2, sh / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return cv;
}

export type CutResult = { canvas: HTMLCanvasElement; ok: boolean };

/** Rotate and (optionally) remove the background of the front photo. */
export function cleanPhoto(img: HTMLImageElement, rot: number, removeBg: boolean, tol: number): CutResult {
  const src = sourceCanvas(img, rot, SOURCE_MAX_SIDE);
  return removeBg ? cutout(src, tol) : { canvas: src, ok: true };
}

/**
 * Flood-fill from the photo's edges: 1 marks background (close to the average edge colour and
 * connected to the edge), 0 marks the product. Pure, so corner detection can share it in tests.
 */
export function backgroundMask(d: Uint8ClampedArray, w: number, h: number, tol: number): Uint8Array {
  const bg = new Uint8Array(w * h);
  if (!w || !h) return bg;
  const border: number[] = [];
  for (let x = 0; x < w; x += 2) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += 2) border.push(y * w, y * w + w - 1);
  let r = 0;
  let g = 0;
  let b = 0;
  border.forEach((i) => {
    r += d[i * 4];
    g += d[i * 4 + 1];
    b += d[i * 4 + 2];
  });
  r /= border.length;
  g /= border.length;
  b /= border.length;
  const dist = (i: number) => {
    const dr = d[i * 4] - r;
    const dg = d[i * 4 + 1] - g;
    const db = d[i * 4 + 2] - b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  const q = new Int32Array(w * h);
  let qh = 0;
  let qt = 0;
  border.forEach((i) => {
    if (!bg[i] && dist(i) < tol * 1.3) {
      bg[i] = 1;
      q[qt++] = i;
    }
  });
  while (qh < qt) {
    const i = q[qh++];
    const x = i % w;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
    for (const j of nb) {
      if (j < 0 || j >= w * h || bg[j]) continue;
      if (dist(j) < tol) {
        bg[j] = 1;
        q[qt++] = j;
      }
    }
  }
  return bg;
}

export function cutout(src: HTMLCanvasElement, tol: number): CutResult {
  const w = src.width;
  const h = src.height;
  const ctx = src.getContext("2d", { willReadFrequently: true });
  if (!ctx || !w || !h) return { canvas: src, ok: false };
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  const bg = backgroundMask(d, w, h, tol);

  let kept = 0;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) {
      d[i * 4 + 3] = 0;
      continue;
    }
    kept++;
    const x = i % w;
    const y = (i - x) / w;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    const edges =
      (x > 0 && bg[i - 1] ? 1 : 0) +
      (x < w - 1 && bg[i + 1] ? 1 : 0) +
      (i - w >= 0 && bg[i - w] ? 1 : 0) +
      (i + w < w * h && bg[i + w] ? 1 : 0);
    if (edges >= 2) d[i * 4 + 3] = EDGE_ALPHA;
  }
  if (kept < w * h * MIN_KEPT_SHARE) return { canvas: src, ok: false };
  ctx.putImageData(im, 0, 0);

  minX = Math.max(0, minX - CROP_PAD);
  minY = Math.max(0, minY - CROP_PAD);
  maxX = Math.min(w - 1, maxX + CROP_PAD);
  maxY = Math.min(h - 1, maxY + CROP_PAD);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")?.drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return { canvas: out, ok: true };
}
