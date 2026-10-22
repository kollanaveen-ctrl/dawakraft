// One page of the printed product catalogue, drawn on a canvas: company logo and the section pill
// with "Product Catalogue 2026-27" at the top, four Catalogue cards in a 2 × 2 grid, and the footer
// with the division bar, page dots and page number (mirrored on odd and even pages, like a bound
// catalogue). Measurements come from the company's PDF and are written in its 975 × 1243 frame.
import { drawCardBody, hexPattern } from "../circular/catalogCard";
import { type Ctx, type Drawable, fitText, font, imageSize } from "../circular/draw";
import { TRADE_LINE } from "../constants";
import type { Company } from "../types";
import type { CataloguePage } from "./pages";

/** The PDF page frame the layout is measured in (points × 1.53). */
const FRAME_W = 975;
const FRAME_H = 1243;
/** Output pixels: sharp when printed at A4-like size, small enough for WhatsApp. */
export const PAGE_W = 1240;
export const PAGE_H = Math.round((PAGE_W * FRAME_H) / FRAME_W);

const NAVY = "#043F88";
const BAR = "#0B2E6B";
const PILL_RING = "#8B1F4E";
const GREY = "#6B6E73";
const DOTS = ["#2C5AA0", "#8FA8CC", "#C9D5E6", "#E3EAF3"];

const MARGIN = 65;
const GAP_X = 15;
const CARD_W = (FRAME_W - MARGIN * 2 - GAP_X) / 2;
const CARD_H = 481;
const ROW_TOP = [122, 642];
const FOOT_Y = 1162;
/** Cards are drawn at circular width, then scaled into their slot. */
const CARD_SRC_W = 1080;
const CARD_SRC_H = Math.round((CARD_SRC_W * CARD_H) / CARD_W);

export type PageOptions = {
  company: Company;
  logo: Drawable | null;
  /** e.g. "Product Catalogue 2026-27". */
  title: string;
  /** e.g. "Ultima Division"; the company name is used when empty. */
  division: string;
  /** Product pictures by product id (missing or null draws the sample pack). */
  images: ReadonlyMap<string, Drawable | null>;
};

function header(ctx: Ctx, page: CataloguePage, o: PageOptions) {
  const right = FRAME_W - MARGIN;
  if (o.logo) {
    const [iw, ih] = imageSize(o.logo);
    if (iw && ih) {
      const s = Math.min(180 / iw, 50 / ih);
      ctx.drawImage(o.logo, MARGIN, 60 + (50 - ih * s) / 2, iw * s, ih * s);
    }
  } else if (o.company.name) {
    ctx.fillStyle = NAVY;
    fitText(ctx, o.company.name, MARGIN, 96, 320, 700, 28, "serif", 16);
  }

  ctx.textAlign = "right";
  ctx.fillStyle = NAVY;
  ctx.font = font(700, 22, "serif");
  ctx.fillText(o.title, right, 86);
  const titleW = ctx.measureText(o.title).width;
  ctx.font = font(600, 17, "serif");
  const pillW = ctx.measureText(page.section).width + 24;
  const pillX = right - titleW - 18 - pillW;
  ctx.beginPath();
  ctx.roundRect(pillX, 66, pillW, 26, 13);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = PILL_RING;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillText(page.section, pillX + pillW / 2, 85);
  ctx.textAlign = "left";
}

function card(ctx: Ctx, page: CataloguePage, k: number, o: PageOptions) {
  const p = page.products[k];
  const x = MARGIN + (k % 2) * (CARD_W + GAP_X);
  const y = ROW_TOP[Math.floor(k / 2)];
  const src = document.createElement("canvas");
  src.width = CARD_SRC_W;
  src.height = CARD_SRC_H;
  const c = src.getContext("2d");
  if (!c) return;
  c.textBaseline = "alphabetic";
  drawCardBody(c, p, o.images.get(p.id) ?? null, CARD_SRC_W, CARD_SRC_H, 60);
  ctx.drawImage(src, x, y, CARD_W, CARD_H);
}

/** Page number, dots and the division bar. Even pages put the number on the left, odd on the right. */
function footer(ctx: Ctx, page: CataloguePage, o: PageOptions) {
  const even = page.number % 2 === 0;
  const flip = (x: number) => (even ? x : FRAME_W - x);
  const division = o.division.trim() || o.company.name.trim();

  ctx.fillStyle = BAR;
  ctx.beginPath();
  ctx.arc(flip(80), FOOT_Y, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.font = font(700, page.number > 99 ? 11 : 13, "serif");
  ctx.fillText(String(page.number), flip(80), FOOT_Y + 5);

  [10, 9, 8, 5].forEach((r, i) => {
    ctx.fillStyle = DOTS[i];
    ctx.beginPath();
    ctx.arc(flip(117 + i * 29), FOOT_Y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  const lineEnd = division ? 655 : FRAME_W - MARGIN;
  ctx.strokeStyle = BAR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(flip(216), FOOT_Y);
  ctx.lineTo(flip(lineEnd), FOOT_Y);
  ctx.stroke();
  ctx.fillStyle = BAR;
  ctx.beginPath();
  ctx.arc(flip(lineEnd), FOOT_Y, 4, 0, Math.PI * 2);
  ctx.fill();

  if (division) {
    // The bar runs off the page edge, with a rounded end towards the middle.
    const x0 = even ? 663 : -20;
    const x1 = even ? FRAME_W + 20 : FRAME_W - 663;
    ctx.beginPath();
    ctx.roundRect(x0, FOOT_Y - 17, x1 - x0, 34, 17);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = font(700, 18, "serif", true);
    const cx = even ? (663 + FRAME_W) / 2 : (FRAME_W - 663) / 2;
    ctx.fillText(division, cx, FOOT_Y + 6, FRAME_W - 663 - 40);
  }

  // Every page carries the trade-only line (and the licence when there is one).
  ctx.fillStyle = GREY;
  const trade = (o.company.licence ? "DL: " + o.company.licence + "   ·   " : "") + TRADE_LINE;
  fitText(ctx, trade, FRAME_W / 2, 1218, FRAME_W - MARGIN * 2, 400, 11, "body", 8);
  ctx.textAlign = "left";
}

/** Draw `page` onto `canvas` (any size with the page's proportions). */
export function drawCataloguePage(canvas: HTMLCanvasElement, page: CataloguePage, o: PageOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(canvas.width / FRAME_W, 0, 0, canvas.height / FRAME_H, 0, 0);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, FRAME_W, FRAME_H);
  ctx.save();
  ctx.scale(FRAME_W / CARD_SRC_W, FRAME_W / CARD_SRC_W);
  hexPattern(ctx, CARD_SRC_W, (FRAME_H * CARD_SRC_W) / FRAME_W);
  ctx.restore();
  header(ctx, page, o);
  page.products.forEach((_, k) => card(ctx, page, k, o));
  footer(ctx, page, o);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** A full-size page canvas. */
export function pageCanvas(page: CataloguePage, o: PageOptions): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = PAGE_W;
  cv.height = PAGE_H;
  drawCataloguePage(cv, page, o);
  return cv;
}

/** All pages as one PDF, each page the size of the company's printed catalogue. */
export async function cataloguePdf(pages: readonly CataloguePage[], o: PageOptions): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const size: [number, number] = [Math.round((FRAME_W / 1.53) * 10) / 10, Math.round((FRAME_H / 1.53) * 10) / 10];
  const doc = new jsPDF({ unit: "pt", format: size, orientation: "portrait", compress: true });
  pages.forEach((page, i) => {
    if (i) doc.addPage(size, "portrait");
    const jpeg = pageCanvas(page, o).toDataURL("image/jpeg", 0.9);
    doc.addImage(jpeg, "JPEG", 0, 0, size[0], size[1], undefined, "FAST");
  });
  return doc.output("blob");
}
