import { describe, expect, it } from "vitest";
import { autoCorners, cornersFromMask, findCorners, insetQuad } from "../image/corners";
import {
  applyHomography,
  depthConsistency,
  estimateAspect,
  homography,
  orderQuad,
  rectQuad,
  rectSize,
  warpToRect,
  type PixelBuffer,
  type Point,
  type Quad,
} from "../image/perspective";

const SKEWED: Quad = [
  { x: 22, y: 14 },
  { x: 168, y: 30 },
  { x: 150, y: 128 },
  { x: 12, y: 110 },
];

function blank(width: number, height: number, rgb: [number, number, number]): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...rgb, 255], i * 4);
  return { width, height, data };
}

const close = (a: Point, b: Point, eps = 1e-6) => Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;

describe("ordering tapped corners", () => {
  it("returns top-left, top-right, bottom-right, bottom-left whatever the tap order", () => {
    const [tl, tr, br, bl] = SKEWED;
    for (const taps of [[br, tl, bl, tr], [bl, br, tr, tl], [tr, bl, tl, br], [tl, tr, br, bl]]) {
      expect(orderQuad(taps)).toEqual(SKEWED);
    }
  });

  it("refuses anything but four points", () => {
    expect(() => orderQuad(SKEWED.slice(0, 3))).toThrow();
  });
});

describe("face shape", () => {
  it("averages opposite edges to get width over height", () => {
    expect(estimateAspect(rectQuad(300, 100))).toBeCloseTo(3);
    // A trapezoid 200 wide at the top and 100 at the bottom, 100 tall: average width 150.
    const trap: Quad = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 150, y: 100 }, { x: 50, y: 100 }];
    const sideLen = Math.hypot(50, 100);
    expect(estimateAspect(trap)).toBeCloseTo(150 / sideLen);
  });

  it("caps the straightened size at the long side but never enlarges", () => {
    expect(rectSize(rectQuad(2400, 1200), 1200)).toEqual({ width: 1200, height: 600 });
    expect(rectSize(rectQuad(300, 100), 1200)).toEqual({ width: 300, height: 100 });
  });
});

describe("homography", () => {
  it("maps each corner of the photo quad exactly onto the rectangle", () => {
    const dst = rectQuad(400, 250);
    const h = homography(SKEWED, dst);
    expect(h).not.toBeNull();
    SKEWED.forEach((p, k) => expect(close(applyHomography(h!, p), dst[k], 1e-6)).toBe(true));
  });

  it("gives null when the corners collapse onto a line", () => {
    const flat: Quad = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }];
    expect(homography(flat, rectQuad(10, 10))).toBeNull();
  });
});

describe("straightening a skewed face", () => {
  // Paint a photo whose face encodes its own position: red = how far across, green = how far down.
  const W = 200;
  const H = 150;
  const OUT_W = 120;
  const OUT_H = 80;
  function paintedPhoto(): PixelBuffer {
    const img = blank(W, H, [0, 0, 255]);
    const toFace = homography(SKEWED, rectQuad(1, 1))!;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const { x: u, y: v } = applyHomography(toFace, { x: x + 0.5, y: y + 0.5 });
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;
        img.data.set([u * 255, v * 255, 0, 255], (y * W + x) * 4);
      }
    }
    return img;
  }

  it("recovers the flat face with bilinear sampling", () => {
    const out = warpToRect(paintedPhoto(), SKEWED, OUT_W, OUT_H);
    expect(out).not.toBeNull();
    expect(out!.width).toBe(OUT_W);
    expect(out!.height).toBe(OUT_H);
    for (const [x, y] of [[10, 10], [60, 40], [110, 70], [100, 15], [15, 65]]) {
      const i = (y * OUT_W + x) * 4;
      expect(Math.abs(out!.data[i] - ((x + 0.5) / OUT_W) * 255)).toBeLessThan(5);
      expect(Math.abs(out!.data[i + 1] - ((y + 0.5) / OUT_H) * 255)).toBeLessThan(5);
      expect(out!.data[i + 2]).toBeLessThan(20); // no background blue leaks into the face
    }
  });

  it("returns a new buffer and leaves the photo untouched", () => {
    const photo = paintedPhoto();
    const before = photo.data.slice();
    const out = warpToRect(photo, SKEWED, OUT_W, OUT_H);
    expect(out!.data).not.toBe(photo.data);
    expect(photo.data).toEqual(before);
  });

  it("gives null for an empty output or collapsed corners", () => {
    expect(warpToRect(paintedPhoto(), SKEWED, 0, 10)).toBeNull();
    const flat: Quad = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }];
    expect(warpToRect(paintedPhoto(), flat, 10, 10)).toBeNull();
  });
});

describe("box depth from side and top", () => {
  // Box 60 wide, 100 tall, 30 deep: front 0.6, side 30/100 = 0.3, top 60/30 = 2.
  it("agrees when both photos match", () => {
    const d = depthConsistency(0.6, 0.3, 2);
    expect(d.depthFromSide).toBeCloseTo(0.5);
    expect(d.depthFromTop).toBeCloseTo(0.5);
    expect(d.mismatch).toBeCloseTo(0);
    expect(d.ok).toBe(true);
  });

  it("flags more than 20% disagreement", () => {
    const d = depthConsistency(0.6, 0.3, 1.2); // top says 0.83 of the width deep
    expect(d.mismatch).toBeGreaterThan(0.2);
    expect(d.ok).toBe(false);
    expect(depthConsistency(0.6, 0.3, 1.8).ok).toBe(true); // 10% off is fine
  });

  it("has nothing to compare with only one depth photo", () => {
    expect(depthConsistency(0.6, 0.3)).toEqual({ ok: true, depthFromSide: 0.5, depthFromTop: null, mismatch: 0 });
    expect(depthConsistency(0.6, null, 2)).toEqual({ ok: true, depthFromSide: null, depthFromTop: 0.5, mismatch: 0 });
  });
});

describe("auto-suggested corners", () => {
  const W = 100;
  const H = 80;

  it("finds the corners of a tilted box in a mask, ignoring a stray speck", () => {
    const quad: Quad = [{ x: 20, y: 10 }, { x: 80, y: 18 }, { x: 74, y: 70 }, { x: 14, y: 62 }];
    const toFace = homography(quad, rectQuad(1, 1))!;
    const mask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const { x: u, y: v } = applyHomography(toFace, { x: x + 0.5, y: y + 0.5 });
        if (u >= 0 && u <= 1 && v >= 0 && v <= 1) mask[y * W + x] = 1;
      }
    }
    mask[2 * W + 2] = 1; // speck near the top-left of the photo
    const found = cornersFromMask(mask, W, H);
    expect(found).not.toBeNull();
    found!.forEach((p, k) => expect(close(p, quad[k], 2.5)).toBe(true));
  });

  it("puts corners on the pixel edges of an upright box photo", () => {
    const img = blank(W, H, [235, 235, 230]);
    for (let y = 20; y < 60; y++) for (let x = 10; x < 70; x++) img.data.set([30, 90, 160, 255], (y * W + x) * 4);
    expect(findCorners(img)).toEqual([{ x: 10, y: 20 }, { x: 70, y: 20 }, { x: 70, y: 60 }, { x: 10, y: 60 }]);
  });

  it("falls back to a rectangle 8% inside the edges when the box can't be found", () => {
    const plain = blank(W, H, [240, 240, 240]); // white box on a white table
    expect(findCorners(plain)).toBeNull();
    expect(autoCorners(plain)).toEqual(insetQuad(W, H));
    expect(insetQuad(W, H)[0]).toEqual({ x: 8, y: 6.4 });
    expect(cornersFromMask(new Uint8Array(W * H), W, H)).toBeNull();
  });
});
