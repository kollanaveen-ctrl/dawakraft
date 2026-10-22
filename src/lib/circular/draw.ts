// Canvas drawing helpers for the circular templates, ported from the prototype.
import { rgba, textOn } from "../color";
import { mrpText } from "../format";
import type { ProductFields } from "../types";

export type Ctx = CanvasRenderingContext2D;
export type Drawable = HTMLImageElement | HTMLCanvasElement | ImageBitmap;
export type Family = "display" | "body" | "mono" | "serif" | "promo" | "cond";

const FALLBACK: Record<Family, string> = {
  display: '"Helvetica Neue", Arial, sans-serif',
  body: '"Segoe UI", Arial, sans-serif',
  mono: "Menlo, monospace",
  serif: "Georgia, serif",
  promo: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
  cond: '"Arial Narrow", "Helvetica Neue", Arial, sans-serif',
};
const CSS_VAR: Record<Family, string> = {
  display: "--f-display",
  body: "--f-body",
  mono: "--f-mono",
  serif: "--f-serif",
  promo: "--f-promo",
  cond: "--f-cond",
};

let families: Record<Family, string> | null = null;

/** Font family lists come from next/font CSS variables set on <html>. */
function family(f: Family): string {
  if (!families && typeof document !== "undefined") {
    const style = getComputedStyle(document.documentElement);
    const read = (k: Family) => style.getPropertyValue(CSS_VAR[k]).trim() || FALLBACK[k];
    families = {
      display: read("display"),
      body: read("body"),
      mono: read("mono"),
      serif: read("serif"),
      promo: read("promo"),
      cond: read("cond"),
    };
  }
  return families ? families[f] : FALLBACK[f];
}

export function font(weight: number, px: number, fam: Family = "display", italic = false): string {
  return `${italic ? "italic " : ""}${weight} ${px}px ${family(fam)}`;
}

export async function fontsReady(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(font(800, 40)),
      document.fonts.load(font(500, 22, "body")),
      document.fonts.load(font(600, 22, "body")),
      document.fonts.load(font(500, 20, "mono")),
      document.fonts.load(font(400, 30, "serif")),
      document.fonts.load(font(600, 30, "serif")),
      document.fonts.load(font(700, 30, "serif")),
      document.fonts.load(font(400, 30, "serif", true)),
      document.fonts.load(font(800, 40, "promo", true)),
      document.fonts.load(font(900, 40, "promo", true)),
      document.fonts.load(font(700, 40, "promo")),
      document.fonts.load(font(500, 30, "cond")),
      document.fonts.load(font(600, 30, "cond")),
      document.fonts.load(font(700, 30, "cond")),
      document.fonts.load(font(600, 30, "cond", true)),
    ]);
  } catch {
    // Fonts are a nicety: the canvas falls back to system fonts.
  }
}

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Word-wrap `text` into at most `maxLines`, ending with an ellipsis if cut. */
export function lines(ctx: Ctx, text: string, maxW: number, maxLines: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  if (out.length <= maxLines) return out;
  const keep = out.slice(0, maxLines);
  let last = keep[maxLines - 1] + "…";
  while (ctx.measureText(last).width > maxW && last.length > 2) last = last.slice(0, -2) + "…";
  keep[maxLines - 1] = last;
  return keep;
}

export function fitText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  maxW: number,
  weight: number,
  px: number,
  fam: Family = "display",
  min = 14,
) {
  let s = px;
  ctx.font = font(weight, s, fam);
  while (s > min && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = font(weight, s, fam);
  }
  ctx.fillText(text, x, y);
}

export function pill(ctx: Ctx, text: string, xRight: number, yMid: number, bg: string, fg: string, px = 26) {
  ctx.font = font(800, px);
  const w = ctx.measureText(text).width + 44;
  const h = px + 26;
  rr(ctx, xRight - w, yMid - h / 2, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, xRight - w / 2, yMid + 1);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
}

/** Natural pixel size of an image, canvas or bitmap. */
export function imageSize(img: Drawable): [number, number] {
  if (img instanceof HTMLImageElement) return [img.naturalWidth, img.naturalHeight];
  return [img.width, img.height];
}

/** Draw `img` scaled to fit inside the box, centred. */
export function drawFit(ctx: Ctx, img: Drawable, x: number, y: number, w: number, h: number) {
  const [iw, ih] = imageSize(img);
  if (!iw || !ih) return;
  const s = Math.min(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function packPlaceholder(ctx: Ctx, cx: number, cy: number, w: number, h: number, brand: string, name: string) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const d = Math.round(w * 0.16);
  ctx.fillStyle = "#C9D3D4";
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w + d, y - d * 0.6);
  ctx.lineTo(x + w + d, y + h - d * 0.6);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#E4EAEA";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + d, y - d * 0.6);
  ctx.lineTo(x + w + d, y - d * 0.6);
  ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#C9D3D4";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = brand;
  ctx.fillRect(x, y, w, h * 0.42);
  ctx.fillStyle = textOn(brand);
  ctx.textAlign = "center";
  fitText(ctx, name || "Product", cx, y + h * 0.27, w - 40, 800, Math.round(h * 0.16));
  ctx.fillStyle = "#5A6B70";
  ctx.font = font(500, Math.round(h * 0.07), "body");
  ctx.fillText("Sample pack", cx, y + h * 0.7);
  ctx.textAlign = "left";
  ctx.fillStyle = rgba(brand, 0.25);
  ctx.fillRect(x + w * 0.12, y + h * 0.8, w * 0.76, 6);
}

export function productArt(
  ctx: Ctx,
  img: Drawable | null,
  p: Pick<ProductFields, "name">,
  brand: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (img) drawFit(ctx, img, x, y, w, h);
  else packPlaceholder(ctx, x + w / 2 - 24, y + h / 2 + 20, Math.min(w * 0.62, 430), Math.min(h * 0.5, 290), brand, p.name);
}

export function rxBadge(ctx: Ctx, schedule: string, cx: number, cy: number, r: number) {
  if (!schedule || schedule === "None" || schedule === "G") return;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#B42318";
  ctx.stroke();
  ctx.fillStyle = "#B42318";
  ctx.textAlign = "center";
  ctx.font = font(800, Math.round(r * 0.72));
  ctx.fillText("Rx", cx, cy + r * 0.18);
  ctx.font = font(500, Math.round(r * 0.3), "mono");
  ctx.fillText("SCH " + schedule, cx, cy + r * 0.62);
  ctx.textAlign = "left";
}

export type Spec = [label: string, value: string];

export function specsOf(p: Pick<ProductFields, "form" | "packSize" | "mrp">): Spec[] {
  return [
    ["Form", p.form],
    ["Pack", p.packSize],
    ["MRP", mrpText(p.mrp)],
  ];
}

export function specBoxes(
  ctx: Ctx,
  items: Spec[],
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  labelC: string,
  valueC: string,
) {
  const gap = 16;
  const bw = (w - gap * (items.length - 1)) / items.length;
  items.forEach(([label, value], i) => {
    const bx = x + i * (bw + gap);
    rr(ctx, bx, y, bw, h, 16);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.fillStyle = labelC;
    ctx.font = font(500, 20, "mono");
    ctx.textAlign = "left";
    ctx.fillText(label.toUpperCase(), bx + 22, y + 38);
    ctx.fillStyle = valueC;
    fitText(ctx, value || "—", bx + 22, y + h - 28, bw - 44, 800, 34, "display", 18);
  });
}
