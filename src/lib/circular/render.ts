// The circular layouts (Catalogue card, Clean, Side band, Spotlight), drawn at 1080×1350.
import { mix, rgba, textOn } from "../color";
import { TRADE_LINE, type TemplateKey } from "../constants";
import type { Company, ProductFields } from "../types";
import { drawCatalogCard } from "./catalogCard";
import {
  type Ctx,
  type Drawable,
  drawFit,
  fitText,
  font,
  lines,
  pill,
  productArt,
  rr,
  rxBadge,
  specBoxes,
  specsOf,
} from "./draw";

export const CIRCULAR_W = 1080;
export const CIRCULAR_H = 1350;

export type CircularInput = {
  product: ProductFields;
  company: Company;
  template: TemplateKey;
  image: Drawable | null;
  logo: Drawable | null;
};

function footer(ctx: Ctx, c: Company, top: number, bg: string, fg: string) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, top, CIRCULAR_W, CIRCULAR_H - top);
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  const contact = [c.phone, c.email].filter(Boolean).join("   ·   ") || "Add phone and email on the Company page";
  fitText(ctx, contact, 540, top + 46, 980, 600, 28, "body", 16);
  ctx.globalAlpha = 0.85;
  fitText(ctx, c.address || "", 540, top + 82, 980, 400, 22, "body", 14);
  ctx.globalAlpha = 0.7;
  fitText(ctx, (c.licence ? "DL: " + c.licence + "   ·   " : "") + TRADE_LINE, 540, top + 116, 1000, 400, 17, "body", 11);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

function header(ctx: Ctx, c: Company, logo: Drawable | null, h: number, fg: string, logoBg: string) {
  let x = 56;
  if (logo) {
    rr(ctx, 48, (h - 100) / 2, 100, 100, 18);
    ctx.fillStyle = logoBg;
    ctx.fill();
    drawFit(ctx, logo, 56, (h - 100) / 2 + 8, 84, 84);
    x = 172;
  }
  ctx.fillStyle = fg;
  ctx.textAlign = "left";
  fitText(ctx, c.name || "Your company name", x, h / 2 + 2, 560 - (x - 56), 800, 40, "display", 20);
  ctx.globalAlpha = 0.8;
  fitText(ctx, c.tagline || "Pharmaceutical distributor", x, h / 2 + 36, 560 - (x - 56), 500, 23, "body", 14);
  ctx.globalAlpha = 1;
}

function textBlock(
  ctx: Ctx,
  p: ProductFields,
  cx: number,
  top: number,
  height: number,
  maxW: number,
  colName: string,
  colComp: string,
  colCat: string,
) {
  ctx.textAlign = "center";
  ctx.font = font(800, 64);
  const nl = lines(ctx, p.name || "Product name", maxW, 2);
  ctx.font = font(500, 30, "body");
  const cl = lines(ctx, p.composition || "", maxW, 2);
  const total = 30 + nl.length * 70 + (cl.length ? 16 + cl.length * 40 : 0);
  let y = top + Math.max(0, (height - total) / 2) + 22;
  ctx.fillStyle = colCat;
  ctx.font = font(500, 22, "mono");
  ctx.fillText((p.category || "").toUpperCase(), cx, y);
  y += 70;
  ctx.fillStyle = colName;
  ctx.font = font(800, 64);
  nl.forEach((l) => {
    ctx.fillText(l, cx, y);
    y += 70;
  });
  ctx.fillStyle = colComp;
  ctx.font = font(500, 30, "body");
  y -= 14;
  cl.forEach((l) => {
    ctx.fillText(l, cx, y);
    y += 40;
  });
  ctx.textAlign = "left";
}

function schemeStrip(ctx: Ctx, p: ProductFields, y: number) {
  if (!p.scheme) return;
  ctx.fillStyle = "#F2B134";
  ctx.fillRect(0, y, CIRCULAR_W, 58);
  ctx.fillStyle = "#3F2B00";
  ctx.textAlign = "center";
  fitText(ctx, "Trade scheme: " + p.scheme, 540, y + 39, 980, 800, 28, "display", 16);
  ctx.textAlign = "left";
}

function drawBand(ctx: Ctx, { product: p, company: c, image, logo }: CircularInput, brand: string) {
  const onBrand = textOn(brand);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, CIRCULAR_W, CIRCULAR_H);
  ctx.fillStyle = brand;
  ctx.fillRect(0, 0, 470, 1210);
  header(ctx, c, logo, 150, onBrand, "#FFFFFF");
  ctx.fillStyle = rgba(brand, 0.08);
  ctx.beginPath();
  ctx.arc(780, 560, 250, 0, Math.PI * 2);
  ctx.fill();
  productArt(ctx, image, p, brand, 500, 250, 560, 620);
  rxBadge(ctx, p.schedule, 1000, 230, 52);
  if (p.highlight) pill(ctx, p.highlight, 1030, 150, "#F2B134", "#3F2B00", 24);
  ctx.fillStyle = onBrand;
  ctx.globalAlpha = 0.75;
  ctx.font = font(500, 20, "mono");
  ctx.fillText((p.category || "").toUpperCase(), 56, 300);
  ctx.globalAlpha = 1;
  ctx.font = font(800, 58);
  let y = 370;
  lines(ctx, p.name || "Product name", 370, 3).forEach((l) => {
    ctx.fillStyle = onBrand;
    ctx.fillText(l, 56, y);
    y += 64;
  });
  ctx.font = font(500, 28, "body");
  ctx.globalAlpha = 0.88;
  y += 6;
  lines(ctx, p.composition || "", 370, 4).forEach((l) => {
    ctx.fillText(l, 56, y);
    y += 38;
  });
  ctx.globalAlpha = 1;
  let sy = Math.max(y + 30, 760);
  specsOf(p).forEach(([label, value]) => {
    ctx.globalAlpha = 0.7;
    ctx.font = font(500, 19, "mono");
    ctx.fillStyle = onBrand;
    ctx.fillText(label.toUpperCase(), 56, sy);
    ctx.globalAlpha = 1;
    fitText(ctx, value || "—", 56, sy + 40, 370, 800, 34, "display", 18);
    sy += 92;
  });
  if (p.scheme) {
    rr(ctx, 520, 960, 520, 150, 18);
    ctx.fillStyle = "#F2B134";
    ctx.fill();
    ctx.fillStyle = "#3F2B00";
    ctx.font = font(500, 20, "mono");
    ctx.fillText("TRADE SCHEME", 552, 1004);
    fitText(ctx, p.scheme, 552, 1072, 456, 800, 52, "display", 20);
  }
  footer(ctx, c, 1210, mix(brand, "#000000", 0.35), "#FFFFFF");
}

function drawSpotlight(ctx: Ctx, { product: p, company: c, image, logo }: CircularInput, brand: string) {
  ctx.fillStyle = "#0F1F24";
  ctx.fillRect(0, 0, CIRCULAR_W, CIRCULAR_H);
  header(ctx, c, logo, 150, "#FFFFFF", "#FFFFFF");
  if (p.highlight) pill(ctx, p.highlight, 1030, 75, "#F2B134", "#3F2B00", 24);
  rr(ctx, 60, 165, 960, 560, 28);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.fillStyle = rgba(brand, 0.09);
  ctx.beginPath();
  ctx.arc(540, 445, 230, 0, Math.PI * 2);
  ctx.fill();
  productArt(ctx, image, p, brand, 140, 190, 800, 510);
  rxBadge(ctx, p.schedule, 950, 240, 50);
  textBlock(ctx, p, 540, 735, 250, 940, "#FFFFFF", "#B9C8CB", mix(brand, "#FFFFFF", 0.45));
  specBoxes(ctx, specsOf(p), 60, 1000, 960, 112, "rgba(255,255,255,0.08)", "#9FB1B4", "#FFFFFF");
  schemeStrip(ctx, p, 1130);
  footer(ctx, c, 1210, brand, textOn(brand));
}

function drawClean(ctx: Ctx, { product: p, company: c, image, logo }: CircularInput, brand: string) {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, CIRCULAR_W, CIRCULAR_H);
  ctx.fillStyle = brand;
  ctx.fillRect(0, 0, CIRCULAR_W, 150);
  header(ctx, c, logo, 150, textOn(brand), "#FFFFFF");
  if (p.highlight) pill(ctx, p.highlight, 1030, 75, "#F2B134", "#3F2B00", 24);
  ctx.fillStyle = rgba(brand, 0.08);
  ctx.beginPath();
  ctx.arc(540, 440, 250, 0, Math.PI * 2);
  ctx.fill();
  productArt(ctx, image, p, brand, 170, 180, 740, 520);
  rxBadge(ctx, p.schedule, 960, 230, 52);
  textBlock(ctx, p, 540, 712, 270, 960, "#0F1F24", "#4A5A5F", brand);
  specBoxes(ctx, specsOf(p), 60, 1000, 960, 112, rgba(brand, 0.08), "#5A6B70", "#0F1F24");
  schemeStrip(ctx, p, 1130);
  footer(ctx, c, 1210, mix(brand, "#000000", 0.35), "#FFFFFF");
}

/** Draw a circular onto `canvas`, scaling to the canvas width. */
export function renderCircular(canvas: HTMLCanvasElement, input: CircularInput): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const scale = canvas.width / CIRCULAR_W;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, CIRCULAR_W, CIRCULAR_H);
  ctx.textBaseline = "alphabetic";
  const brand = input.company.brandColor || "#0B7A63";
  if (input.template === "catalog") drawCatalogCard(ctx, input, CIRCULAR_W, CIRCULAR_H);
  else if (input.template === "band") drawBand(ctx, input, brand);
  else if (input.template === "spotlight") drawSpotlight(ctx, input, brand);
  else drawClean(ctx, input, brand);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Full-size PNG of a circular, for download and sharing. */
export function circularBlob(input: CircularInput): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = CIRCULAR_W;
  canvas.height = CIRCULAR_H;
  renderCircular(canvas, input);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
