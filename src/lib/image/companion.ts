// The product picture as a pharma catalogue shows it: the 3D box, and in front of its right end the
// real strip, bottle or tube, cut out from its own photo. The layout maths is pure (tested); the
// drawing below only moves pixels.
import type { PackKind } from "../faces";

type Size = { width: number; height: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Placement = Rect & { angle: number };
export type ShotLayout = {
  width: number;
  height: number;
  box: Rect | null;
  pack: Placement;
  ground: { cx: number; cy: number; rx: number; ry: number };
};

const DEG = Math.PI / 180;
/** Height of a pack drawn without a box, in output pixels. */
const ALONE_HEIGHT = 1000;
/** Room around the group for the soft shadows. */
const PAD_SHARE = 0.06;

type Rule = {
  /** Pack height as a share of the box height. */
  height: number;
  /** Widest the pack may be, as a share of the box width. */
  maxWidth: number;
  /** How much of the pack's width overlaps the box's right end. */
  overlap: number;
  /** How far the pack's bottom sits below the box's bottom (it stands in front), share of box height. */
  drop: number;
  /** Tilt in degrees; negative leans the top to the left, like the strips in the catalogue. */
  angle: number;
};

// Measured from the company catalogue: strips stand taller than the box and slightly tilted,
// bottles stand level in front, tubes lie across the front.
const RULES: Record<PackKind, Rule> = {
  strip: { height: 1.22, maxWidth: 0.75, overlap: 0.45, drop: 0.03, angle: -3 },
  bottle: { height: 0.82, maxWidth: 0.9, overlap: 0.35, drop: 0.04, angle: 0 },
  tube: { height: 0.34, maxWidth: 1.0, overlap: 0.62, drop: 0.12, angle: -4 },
};

function rotatedBounds(p: Placement): { minX: number; minY: number; maxX: number; maxY: number } {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const c = Math.cos(p.angle * DEG);
  const s = Math.sin(p.angle * DEG);
  const pts = [
    [-p.w / 2, -p.h / 2],
    [p.w / 2, -p.h / 2],
    [p.w / 2, p.h / 2],
    [-p.w / 2, p.h / 2],
  ].map(([dx, dy]) => [cx + dx * c - dy * s, cy + dx * s + dy * c]);
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Where the box and the pack go. Without a box the pack stands alone. */
export function shotLayout(box: Size | null, pack: Size, kind: PackKind): ShotLayout {
  const aspect = pack.width / Math.max(1, pack.height);
  let boxRect: Rect | null = null;
  let p: Placement;
  if (box && box.width > 0 && box.height > 0) {
    const r = RULES[kind];
    let h = box.height * r.height;
    let w = h * aspect;
    if (kind === "tube") {
      // A tube lies across the front: size it by width instead.
      w = box.width * r.maxWidth * 0.95;
      h = w / Math.max(0.01, aspect);
    } else if (w > box.width * r.maxWidth) {
      w = box.width * r.maxWidth;
      h = w / Math.max(0.01, aspect);
    }
    const x = kind === "tube" ? box.width * (1 - r.overlap) - w * 0.25 : box.width - w * r.overlap;
    const y = box.height * (1 + r.drop) - h;
    boxRect = { x: 0, y: 0, w: box.width, h: box.height };
    p = { x, y, w, h, angle: r.angle };
  } else {
    const h = ALONE_HEIGHT;
    p = { x: 0, y: 0, w: h * aspect, h, angle: 0 };
  }

  const b = rotatedBounds(p);
  const minX = Math.min(b.minX, 0);
  const minY = Math.min(b.minY, 0);
  const maxX = Math.max(b.maxX, boxRect ? boxRect.w : 0);
  const maxY = Math.max(b.maxY, boxRect ? boxRect.h : 0);
  const pad = Math.round((maxY - minY) * PAD_SHARE);
  const ox = pad - minX;
  const oy = pad - minY;
  const shift = <T extends Rect>(r: T): T => ({ ...r, x: r.x + ox, y: r.y + oy });
  return {
    width: Math.ceil(maxX - minX + pad * 2),
    height: Math.ceil(maxY - minY + pad * 2),
    box: boxRect ? shift(boxRect) : null,
    pack: shift(p),
    ground: { cx: (minX + maxX) / 2 + ox, cy: maxY + oy - pad * 0.15, rx: (maxX - minX) * 0.5, ry: pad * 0.55 },
  };
}

/** Turn the pack photo the way it stands in the picture: strips upright, tubes lying down. */
export function packNeedsTurn(pack: Size, kind: PackKind): boolean {
  if (kind === "strip") return pack.width > pack.height * 1.05;
  if (kind === "tube") return pack.height > pack.width * 1.05;
  return false;
}

function turned(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.height;
  out.height = src.width;
  const ctx = out.getContext("2d");
  if (!ctx) return src;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

/**
 * Draw the finished product picture on a transparent canvas: one soft ground shadow under the
 * group, the box, then the pack in front with its own small shadow falling on the box.
 */
export function composeProductShot(box: HTMLCanvasElement | null, packPhoto: HTMLCanvasElement, kind: PackKind): HTMLCanvasElement {
  const pack = packNeedsTurn(packPhoto, kind) ? turned(packPhoto) : packPhoto;
  const L = shotLayout(box, pack, kind);
  const out = document.createElement("canvas");
  out.width = L.width;
  out.height = L.height;
  const ctx = out.getContext("2d");
  if (!ctx) return box ?? pack;

  ctx.save();
  ctx.filter = `blur(${Math.max(4, Math.round(L.ground.ry * 0.6))}px)`;
  ctx.fillStyle = "rgba(15,31,36,0.24)";
  ctx.beginPath();
  ctx.ellipse(L.ground.cx, L.ground.cy, L.ground.rx, L.ground.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (box && L.box) ctx.drawImage(box, L.box.x, L.box.y, L.box.w, L.box.h);

  const p = L.pack;
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
  ctx.rotate(p.angle * DEG);
  ctx.shadowColor = "rgba(15,31,36,0.28)";
  ctx.shadowBlur = Math.round(p.h * 0.05);
  ctx.shadowOffsetX = -Math.round(p.h * 0.015);
  ctx.shadowOffsetY = Math.round(p.h * 0.02);
  ctx.drawImage(pack, -p.w / 2, -p.h / 2, p.w, p.h);
  ctx.restore();
  return out;
}
