// The "Catalogue card" circular: a copy of one card from the printed product catalogue
// (navy serif title, composition, italic uses, big pack shot, pale blue MRP band).
import { TRADE_LINE } from "../constants";
import { mrpText } from "../format";
import type { Company, ProductFields } from "../types";
import { type Ctx, type Drawable, fitText, font, imageSize, lines, productArt, rxBadge } from "./draw";
import type { CircularInput } from "./render";

// Colours measured from the printed catalogue.
const NAVY = "#043F88";
const INK = "#231F20";
const GREY = "#58595B";
const CARD = "#F7F8FA";
const BAND = "#E3F1FB";
const RULE = "#A9B6CC";

const PAD = 50;
const HEX_R = 112;
const BAND_H = 130;
const FOOT_H = 72;
const TITLE_PX = 88;
const COMP_PX = 38;
const USES_PX = 30;
const BAND_PX = 52;

/** Faint hexagon lines behind the card, like the catalogue's paper. A few cells are tinted. */
export function hexPattern(ctx: Ctx, w: number, h: number) {
  const dx = Math.sqrt(3) * HEX_R;
  const dy = 1.5 * HEX_R;
  const tinted = new Set(["1,4", "2,1", "4,5", "5,2", "7,4"]);
  ctx.lineWidth = 2;
  for (let row = 0; row * dy < h + HEX_R; row++) {
    for (let col = -1; col * dx < w + dx; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0);
      const cy = row * dy;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        const px = cx + HEX_R * Math.cos(a);
        const py = cy + HEX_R * Math.sin(a);
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
      if (tinted.has(`${row},${col}`)) {
        ctx.fillStyle = row === 4 ? "rgba(190,60,110,0.035)" : "rgba(4,63,136,0.035)";
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(4,63,136,0.05)";
      ctx.stroke();
    }
  }
}

/** Company logo, small at top-left (left-aligned inside the box). */
function logoMark(ctx: Ctx, logo: Drawable, x: number, y: number, maxW: number, maxH: number) {
  const [iw, ih] = imageSize(logo);
  if (!iw || !ih) return;
  const s = Math.min(maxW / iw, maxH / ih);
  ctx.drawImage(logo, x, y + (maxH - ih * s) / 2, iw * s, ih * s);
}

/** Product photo scaled to fit, centred and resting on the bottom of the box. */
function drawFitBottom(ctx: Ctx, img: Drawable, x: number, y: number, w: number, h: number) {
  const [iw, ih] = imageSize(img);
  if (!iw || !ih) return;
  const s = Math.min(w / iw, h / ih);
  ctx.drawImage(img, x + (w - iw * s) / 2, y + h - ih * s, iw * s, ih * s);
}

/** Title, dotted rule, composition and uses. Returns the y where the text ends. */
function textBlock(ctx: Ctx, p: ProductFields, w: number, top: number): number {
  const cx = w / 2;
  const maxW = w - PAD * 2;
  ctx.textAlign = "center";
  ctx.fillStyle = NAVY;
  fitText(ctx, p.name || "Product name", cx, top + TITLE_PX * 0.8, maxW, 700, TITLE_PX, "serif", 40);

  const ruleY = top + TITLE_PX + 26;
  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD - 10, ruleY);
  ctx.lineTo(w - PAD + 10, ruleY);
  ctx.stroke();
  ctx.restore();

  let y = ruleY + 26;
  if (p.composition) {
    ctx.fillStyle = INK;
    ctx.font = font(600, COMP_PX, "serif");
    for (const l of lines(ctx, p.composition, maxW, 2)) {
      y += COMP_PX * 1.25;
      ctx.fillText(l, cx, y);
    }
    y += 10;
  }
  if (p.uses) {
    ctx.fillStyle = GREY;
    ctx.font = font(400, USES_PX, "serif", true);
    y += 8;
    for (const l of lines(ctx, p.uses, maxW - 60, 2)) {
      y += USES_PX * 1.35;
      ctx.fillText(l, cx, y);
    }
  }
  ctx.textAlign = "left";
  return y;
}

/** "M.R.P. ₹146.89 | Tablets 10x10", centred on the pale blue band. */
function priceBand(ctx: Ctx, p: ProductFields, w: number, top: number) {
  ctx.fillStyle = BAND;
  ctx.fillRect(0, top, w, BAND_H);
  const mrp = mrpText(p.mrp);
  const price = mrp === "—" ? "" : "M.R.P. " + mrp.replace("₹ ", "₹");
  const pack = p.packSize || p.form || "";
  const parts = [price, pack].filter(Boolean);
  if (!parts.length) return;

  let px = BAND_PX;
  const gap = () => px * 0.45;
  const widths = () => {
    ctx.font = font(700, px, "serif");
    const a = price ? ctx.measureText(price).width : 0;
    ctx.font = font(400, px, "serif");
    const bar = parts.length === 2 ? ctx.measureText("|").width + gap() * 2 : 0;
    const b = pack ? ctx.measureText(pack).width : 0;
    return { a, bar, b, total: a + bar + b };
  };
  let m = widths();
  while (px > 24 && m.total > w - PAD * 2) {
    px -= 2;
    m = widths();
  }
  const base = top + BAND_H / 2 + px * 0.35;
  let x = (w - m.total) / 2;
  ctx.fillStyle = NAVY;
  ctx.textAlign = "left";
  if (price) {
    ctx.font = font(700, px, "serif");
    ctx.fillText(price, x, base);
    x += m.a;
  }
  ctx.font = font(400, px, "serif");
  if (parts.length === 2) {
    x += gap();
    ctx.fillText("|", x, base);
    x += m.bar - gap();
  }
  if (pack) ctx.fillText(pack, x, base);
}

/** Small grey compliance footer: company, licence and the trade-only line. */
function tradeFooter(ctx: Ctx, c: Company, w: number, top: number) {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, top, w, FOOT_H);
  ctx.fillStyle = GREY;
  ctx.textAlign = "center";
  const who = [c.name, c.licence ? "DL: " + c.licence : ""].filter(Boolean).join("   ·   ");
  if (who) {
    fitText(ctx, who, w / 2, top + 30, w - PAD * 2, 600, 21, "body", 12);
    fitText(ctx, TRADE_LINE, w / 2, top + 58, w - PAD * 2, 400, 18, "body", 11);
  } else {
    fitText(ctx, TRADE_LINE, w / 2, top + 44, w - PAD * 2, 400, 18, "body", 11);
  }
  ctx.textAlign = "left";
}

/**
 * The card itself, at `w` × `h` from the canvas origin: paper, title, composition, uses, pack
 * shot and price band. `textTop` leaves room above the title (for a logo on the circular).
 */
export function drawCardBody(ctx: Ctx, p: ProductFields, image: Drawable | null, w: number, h: number, textTop = 118) {
  const bandTop = h - BAND_H;
  ctx.fillStyle = CARD;
  ctx.fillRect(0, 0, w, bandTop);
  hexPattern(ctx, w, bandTop);
  rxBadge(ctx, p.schedule, w - PAD - 34, Math.max(64, textTop - 42), 42);

  const textEnd = textBlock(ctx, p, w, textTop);
  const artTop = textEnd + 30;
  const artH = bandTop - 24 - artTop;
  if (image) drawFitBottom(ctx, image, PAD, artTop, w - PAD * 2, artH);
  else productArt(ctx, null, p, NAVY, PAD, artTop, w - PAD * 2, artH);

  priceBand(ctx, p, w, bandTop);
}

/** Draw the Catalogue card at `w` × `h` (the circular size). */
export function drawCatalogCard(ctx: Ctx, { product: p, company: c, image, logo }: CircularInput, w: number, h: number) {
  const footTop = h - FOOT_H;
  drawCardBody(ctx, p, image, w, footTop);
  if (logo) logoMark(ctx, logo, PAD - 10, 26, 220, 76);
  tradeFooter(ctx, c, w, footTop);
}
