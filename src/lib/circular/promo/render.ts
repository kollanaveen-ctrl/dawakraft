// The Promo circular: a landscape visual aid in the style of the company's own circulars.
// Left: brand wordmark with its suffix badge, composition, ingredient tags with bullets, the "In"
// indications list and the product picture. Right: the lifestyle photo with the headline, banner
// and tagline. Price ticket in between, company footer at the bottom. Everything is measured
// first and scaled down together when there is a lot of text, so nothing overflows.
import { TRADE_LINE } from "../../constants";
import { mrpText } from "../../format";
import { type Promo, splitBrand } from "../../promo";
import type { Company, ProductFields } from "../../types";
import { type Ctx, type Drawable, font, imageSize, lines, productArt } from "../draw";
import type { PromoTheme } from "./theme";

export const PROMO_W = 1600;
export const PROMO_H = 1228;

const X0 = 70;
const LEFT_W = 760;
const FOOT_TOP = 1132;
const STRIP_TOP = 1202;
const RIGHT_X = 880;
const RIGHT_W = 680;
const INK = "#1E2533";
const HEAD_INK = "#12203F";

export type PromoInput = {
  product: ProductFields;
  promo: Promo;
  company: Company;
  theme: PromoTheme;
  image: Drawable | null;
  logo: Drawable | null;
  photo: Drawable | null;
};

const FORM_WORD: Record<string, string> = {
  Tablet: "Tablets",
  Capsule: "Capsules",
  Syrup: "Syrup",
  Suspension: "Suspension",
  Injection: "Injection",
  Ointment: "Ointment",
  Cream: "Cream",
  Gel: "Gel",
  Drops: "Drops",
  Sachet: "Sachets",
  Inhaler: "Inhaler",
};

/** Draw `img` to cover the box (cropping the overflow), anchored to the right. */
function drawCover(ctx: Ctx, img: Drawable, x: number, y: number, w: number, h: number) {
  const [iw, ih] = imageSize(img);
  if (!iw || !ih) return;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, iw - sw, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function background(ctx: Ctx, t: PromoTheme, photo: Drawable | null) {
  const g = ctx.createLinearGradient(0, 0, 0, FOOT_TOP);
  g.addColorStop(0, "#FFFFFF");
  // With a photo the left stays pure white, so it meets the photo's white fade without a seam.
  g.addColorStop(1, photo ? "#FFFFFF" : "#EEF0F5");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PROMO_W, FOOT_TOP);
  if (photo) {
    drawCover(ctx, photo, 480, 0, PROMO_W - 480, FOOT_TOP);
    const fade = ctx.createLinearGradient(480, 0, 1060, 0);
    fade.addColorStop(0, "rgba(255,255,255,1)");
    fade.addColorStop(0.55, "rgba(255,255,255,0.72)");
    fade.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = fade;
    ctx.fillRect(480, 0, 580, FOOT_TOP);
    // A soft light behind the headline keeps it readable on busy photos.
    const glow = ctx.createRadialGradient(RIGHT_X + RIGHT_W / 2, 150, 40, RIGHT_X + RIGHT_W / 2, 150, 520);
    glow.addColorStop(0, "rgba(255,255,255,0.78)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(RIGHT_X - 200, 0, RIGHT_W + 300, 640);
    return;
  }
  // No photo: a calm wash in the theme colour with large soft rings, like a studio backdrop.
  const wash = ctx.createRadialGradient(1260, 640, 80, 1260, 640, 760);
  wash.addColorStop(0, t.wash);
  wash.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, PROMO_W, FOOT_TOP);
  ctx.save();
  ctx.lineWidth = 3;
  for (const [r, a] of [
    [300, 0.16],
    [420, 0.1],
    [540, 0.06],
  ] as const) {
    ctx.strokeStyle = `rgba(255,255,255,${a * 4})`;
    ctx.beginPath();
    ctx.arc(1260, 660, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ribbons(ctx, t);
}

/** Two broad curved ribbons sweeping up from the bottom right, like the waves on pharma packs. */
function ribbons(ctx: Ctx, t: PromoTheme) {
  const band = (from: number, to: number, lift: number, colour: string, alpha: number) => {
    const g = ctx.createLinearGradient(700, FOOT_TOP, PROMO_W, 300);
    g.addColorStop(0, `${colour}00`);
    g.addColorStop(0.45, colour + Math.round(alpha * 255).toString(16).padStart(2, "0"));
    g.addColorStop(1, colour + Math.round(alpha * 0.6 * 255).toString(16).padStart(2, "0"));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(620, FOOT_TOP);
    ctx.bezierCurveTo(1000, FOOT_TOP - from, 1250, FOOT_TOP - from - lift, PROMO_W, FOOT_TOP - from - lift * 1.6);
    ctx.lineTo(PROMO_W, FOOT_TOP - to - lift * 1.6);
    ctx.bezierCurveTo(1250, FOOT_TOP - to - lift, 1000, FOOT_TOP - to, 620, FOOT_TOP);
    ctx.closePath();
    ctx.fill();
  };
  band(60, 150, 300, t.title, 0.2);
  band(170, 205, 330, t.badge, 0.35);
  band(215, 330, 360, t.title, 0.1);
  // A soft white glow where the ticket and tagline sit, so they stay crisp.
  const glow = ctx.createRadialGradient(1220, 420, 30, 1220, 420, 420);
  glow.addColorStop(0, "rgba(255,255,255,0.7)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(760, 0, PROMO_W - 760, 860);
}

/** Darken (negative) or lighten (positive) a hex colour by t. */
function shade(hex: string, t: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t));
  return "#" + ch.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}

/** Brand name in heavy italic, with the suffix (XT, SP, MD8) on a slanted badge. */
function wordmark(ctx: Ctx, name: string, t: PromoTheme): number {
  const { base, suffix } = splitBrand(name || "Product name");
  let px = 150;
  const width = (size: number) => {
    ctx.font = font(900, size, "promo", true);
    const b = ctx.measureText(base).width;
    const s = suffix ? ctx.measureText(suffix).width * 0.86 + size * 0.5 : 0;
    return b + (suffix ? size * 0.16 : 0) + s;
  };
  while (px > 64 && width(px) > LEFT_W) px -= 4;
  const baseline = 50 + px * 0.86;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;
  ctx.shadowBlur = 6;
  ctx.fillStyle = t.title;
  ctx.font = font(900, px, "promo", true);
  ctx.fillText(base, X0, baseline);
  ctx.restore();
  if (suffix) {
    ctx.font = font(900, px, "promo", true);
    const bx = X0 + ctx.measureText(base).width + px * 0.16;
    const sPx = Math.round(px * 0.86);
    ctx.font = font(900, sPx, "promo", true);
    const tw = ctx.measureText(suffix).width;
    const bw = tw + px * 0.5;
    const bh = px * 0.92;
    const by = baseline - px * 0.8;
    ctx.save();
    ctx.translate(bx, by);
    ctx.transform(1, 0, -0.16, 1, bh * 0.16, 0);
    const g = ctx.createLinearGradient(0, 0, 0, bh);
    g.addColorStop(0, t.badge);
    g.addColorStop(1, shade(t.badge, -0.22));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(0, 0, bw, bh, bh * 0.16);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = font(900, sPx, "promo", true);
    ctx.fillText(suffix, bx + (bw - tw) / 2 + bh * 0.04, by + bh * 0.8);
  }
  return baseline;
}

type Block = { measure: (s: number) => number; draw: (y: number, s: number) => number };

/** Composition (left) and the dosage form word (right), under the wordmark. */
function compositionBlock(ctx: Ctx, p: ProductFields): Block {
  const formWord = FORM_WORD[p.form] ?? p.form ?? "";
  const run = (y: number, s: number, paint: boolean) => {
    const px = Math.round(35 * s);
    ctx.font = font(500, px, "cond");
    const ls = lines(ctx, p.composition, LEFT_W - (formWord ? 170 : 0), 3);
    let yy = y;
    const drawForm = (at: number) => {
      ctx.textAlign = "right";
      ctx.fillStyle = "#111111";
      ctx.font = font(700, Math.round(44 * s), "cond");
      ctx.fillText(formWord, X0 + LEFT_W, at);
      ctx.textAlign = "left";
    };
    ls.forEach((l, i) => {
      yy += px * 1.2;
      if (!paint) return;
      ctx.fillStyle = INK;
      ctx.font = font(500, px, "cond");
      ctx.fillText(l, X0, yy);
      if (i === ls.length - 1 && formWord) drawForm(yy);
    });
    if (!ls.length && formWord) {
      yy += px * 1.2;
      if (paint) drawForm(yy);
    }
    return yy + 26 * s;
  };
  return { measure: (s) => run(0, s, false), draw: (y, s) => run(y, s, true) };
}

/** Ingredient tags (slanted coloured headers) with their bullets. */
function sectionsBlock(ctx: Ctx, promo: Promo, t: PromoTheme): Block {
  const run = (y: number, s: number, paint: boolean) => {
    let yy = y;
    promo.sections.forEach((sec, i) => {
      const tagH = Math.round(50 * s);
      const tagPx = Math.round(35 * s);
      if (sec.title) {
        ctx.font = font(700, tagPx, "cond");
        const tw = ctx.measureText(sec.title).width;
        if (paint) {
          const col = t.tags[i % t.tags.length];
          ctx.fillStyle = shade(col, -0.35);
          ctx.fillRect(X0 + 10, yy + tagH * 0.22, tagH * 0.56, tagH * 0.56);
          ctx.fillStyle = col;
          const x = X0 + 10 + tagH * 0.72;
          const w = tw + 56 * s;
          ctx.beginPath();
          ctx.moveTo(x, yy);
          ctx.lineTo(x + w + tagH * 0.45, yy);
          ctx.lineTo(x + w, yy + tagH);
          ctx.lineTo(x, yy + tagH);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(sec.title, x + 22 * s, yy + tagH * 0.74);
        }
        yy += tagH + 8 * s;
      }
      const bPx = Math.round(33 * s);
      ctx.font = font(500, bPx, "cond");
      for (const b of sec.bullets) {
        const ls = lines(ctx, b, LEFT_W - 90, 3);
        ls.forEach((l, k) => {
          yy += bPx * 1.18;
          if (!paint) return;
          ctx.fillStyle = INK;
          ctx.font = font(500, bPx, "cond");
          if (k === 0) ctx.fillText("•", X0 + 44, yy);
          ctx.fillText(l, X0 + 66, yy);
        });
      }
      yy += 20 * s;
    });
    return yy;
  };
  return { measure: (s) => run(0, s, false), draw: (y, s) => run(y, s, true) };
}

/** The red "In" cube used for indications. */
function inCube(ctx: Ctx, x: number, y: number, size: number) {
  const d = size * 0.22;
  ctx.fillStyle = "#F15A5A";
  ctx.beginPath();
  ctx.moveTo(x, y + d);
  ctx.lineTo(x + d, y);
  ctx.lineTo(x + size + d, y);
  ctx.lineTo(x + size, y + d);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#9E1A1A";
  ctx.beginPath();
  ctx.moveTo(x + size, y + d);
  ctx.lineTo(x + size + d, y);
  ctx.lineTo(x + size + d, y + size);
  ctx.lineTo(x + size, y + size + d);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(x, y + d, x + size, y + size + d);
  g.addColorStop(0, "#E43A3A");
  g.addColorStop(1, "#B81F24");
  ctx.fillStyle = g;
  ctx.fillRect(x, y + d, size, size);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = font(800, Math.round(size * 0.62), "promo", true);
  ctx.textAlign = "center";
  ctx.fillText("In", x + size / 2, y + d + size * 0.72);
  ctx.textAlign = "left";
}

/** Indications: the "In" cube and the list, with connector lines like the company circulars. */
function indicationsBlock(ctx: Ctx, items: string[], t: PromoTheme): Block {
  const run = (y: number, s: number, paint: boolean) => {
    if (!items.length) return y;
    const cube = Math.round(60 * s);
    const px = Math.round(35 * s);
    const lh = px * 1.38;
    const twoCols = items.length > 5;
    const colW = twoCols ? (LEFT_W - cube - 40) / 2 : LEFT_W - cube - 40;
    if (paint) inCube(ctx, X0 + 10, y, cube);
    let yy = y + 6 * s;
    items.forEach((it, i) => {
      const col = twoCols ? i % 2 : 0;
      if (col === 0) yy += lh;
      if (!paint) return;
      const x = X0 + cube + 46 + col * colW;
      ctx.fillStyle = INK;
      ctx.font = font(600, px, "cond", true);
      const label = lines(ctx, it, colW - (twoCols ? 20 : 120), 1)[0] ?? "";
      ctx.fillText(label, x, yy);
      if (twoCols) return;
      const end = x + ctx.measureText(label).width + 18;
      const stop = Math.min(X0 + LEFT_W - 20, end + 90);
      if (stop <= end + 20) return;
      ctx.strokeStyle = t.badge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(end, yy - px * 0.32);
      ctx.lineTo(stop, yy - px * 0.32);
      ctx.stroke();
      ctx.fillStyle = t.badge;
      ctx.beginPath();
      ctx.arc(stop, yy - px * 0.32, 5 * s, 0, Math.PI * 2);
      ctx.fill();
    });
    return Math.max(yy + 22 * s, y + cube + 30 * s);
  };
  return { measure: (s) => run(0, s, false), draw: (y, s) => run(y, s, true) };
}

/** Numbered study references in small grey type (only when given). */
function referencesBlock(ctx: Ctx, refs: string[]): Block {
  const run = (y: number, s: number, paint: boolean) => {
    if (!refs.length) return y;
    const px = Math.round(17 * s);
    let yy = y;
    ctx.font = font(500, px, "cond");
    refs.forEach((r, i) => {
      for (const l of lines(ctx, `${i + 1}. ${r}`, LEFT_W - 40, 2)) {
        yy += px * 1.25;
        if (!paint) continue;
        ctx.fillStyle = "#4B5563";
        ctx.font = font(500, px, "cond");
        ctx.fillText(l, X0 + 20, yy);
      }
    });
    return yy + 16 * s;
  };
  return { measure: (s) => run(0, s, false), draw: (y, s) => run(y, s, true) };
}

/** The product picture, resting on the bottom of its box, left-aligned. */
function productShot(ctx: Ctx, img: Drawable | null, p: ProductFields, t: PromoTheme, top: number) {
  const bottom = FOOT_TOP - 34;
  const h = Math.max(200, bottom - top);
  const w = 700;
  if (!img) {
    productArt(ctx, null, p, t.title, X0, top, w, h);
    return;
  }
  const [iw, ih] = imageSize(img);
  if (!iw || !ih) return;
  const s = Math.min(w / iw, h / ih);
  ctx.drawImage(img, X0, bottom - ih * s, iw * s, ih * s);
}

/** The ticket: "M.R.P. ₹ : 270.00/-", "Pack Size : 20x15", "Case Size : 540". */
function priceTicket(ctx: Ctx, p: ProductFields, promo: Promo, t: PromoTheme, x: number, y: number) {
  const mrp = mrpText(p.mrp);
  const rows: [string, string][] = [];
  if (mrp !== "—") rows.push(["M.R.P. ₹", mrp.replace("₹ ", "") + "/-"]);
  if (p.packSize) rows.push(["Pack Size", p.packSize]);
  if (promo.caseSize) rows.push(["Case Size", promo.caseSize]);
  if (!rows.length) return;
  const rowH = 50;
  const labW = 205;
  ctx.font = font(700, 34, "cond");
  const valW = Math.max(150, ...rows.map(([, v]) => ctx.measureText(": " + v).width + 34));
  const h = rows.length * rowH + 16;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(x + labW - 12, y + 6, valW + 22, h - 12, 10);
  ctx.fill();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, shade(t.ribbon, 0.12));
  g.addColorStop(1, shade(t.ribbon, -0.12));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x + 14, y);
  ctx.lineTo(x + labW, y);
  ctx.lineTo(x + labW - 16, y + h / 2);
  ctx.lineTo(x + labW, y + h);
  ctx.lineTo(x + 14, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - 14);
  ctx.lineTo(x, y + 14);
  ctx.quadraticCurveTo(x, y, x + 14, y);
  ctx.fill();
  ctx.restore();
  // The folded corner of the ticket.
  ctx.fillStyle = shade(t.ribbon, -0.35);
  ctx.beginPath();
  ctx.moveTo(x + labW + valW + 10, y + 6);
  ctx.lineTo(x + labW + valW + 22, y + 18);
  ctx.lineTo(x + labW + valW + 10, y + 18);
  ctx.fill();
  rows.forEach(([label, value], i) => {
    const base = y + 8 + rowH * (i + 1) - 14;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = font(700, 32, "cond");
    ctx.fillText(label, x + 22, base);
    ctx.fillStyle = "#111111";
    ctx.font = font(700, 34, "cond");
    ctx.fillText(": " + value, x + labW + 6, base);
    if (i === rows.length - 1) return;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + labW + 6, base + 12);
    ctx.lineTo(x + labW + valW - 4, base + 12);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.moveTo(x + 20, base + 12);
    ctx.lineTo(x + labW - 26, base + 12);
    ctx.stroke();
  });
}

/** Headline and the coloured banner under it, centred on the right half. */
function headline(ctx: Ctx, promo: Promo, t: PromoTheme): number {
  const cx = RIGHT_X + RIGHT_W / 2;
  let y = 64;
  if (promo.headline) {
    let px = 80;
    ctx.font = font(800, px, "promo", true);
    let ls = lines(ctx, promo.headline, RIGHT_W, 3);
    while (px > 40 && ls.some((l) => ctx.measureText(l).width > RIGHT_W)) {
      px -= 4;
      ctx.font = font(800, px, "promo", true);
      ls = lines(ctx, promo.headline, RIGHT_W, 3);
    }
    ctx.textAlign = "center";
    ctx.fillStyle = HEAD_INK;
    for (const l of ls) {
      y += px * 1.08;
      ctx.fillText(l, cx, y);
    }
    ctx.textAlign = "left";
    y += 24;
  }
  if (promo.banner) {
    const text = promo.banner.toUpperCase();
    let px = 54;
    ctx.font = font(800, px, "promo", true);
    while (px > 26 && ctx.measureText(text).width > RIGHT_W - 70) {
      px -= 2;
      ctx.font = font(800, px, "promo", true);
    }
    const w = ctx.measureText(text).width + 70;
    const h = px * 1.55;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, shade(t.banner, 0.08));
    g.addColorStop(1, shade(t.banner, -0.2));
    ctx.fillStyle = g;
    ctx.fillRect(cx - w / 2, y, w, h);
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.fillText(text, cx, y + h * 0.7);
    ctx.textAlign = "left";
    y += h;
  }
  return y;
}

function tagline(ctx: Ctx, promo: Promo, t: PromoTheme, hasPhoto: boolean) {
  if (!promo.tagline) return;
  let px = 44;
  ctx.font = font(800, px, "promo", true);
  while (px > 26 && ctx.measureText(promo.tagline).width > RIGHT_W - 40) {
    px -= 2;
    ctx.font = font(800, px, "promo", true);
  }
  const w = ctx.measureText(promo.tagline).width + 56;
  const h = px * 1.6;
  const x = PROMO_W - 40 - w;
  const y = FOOT_TOP - 34 - h;
  ctx.fillStyle = hasPhoto ? "rgba(16,32,80,0.86)" : t.title;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(promo.tagline, x + 28, y + h * 0.7);
}

function footer(ctx: Ctx, c: Company, logo: Drawable | null, t: PromoTheme) {
  const g = ctx.createLinearGradient(0, FOOT_TOP, 0, STRIP_TOP);
  g.addColorStop(0, "#E4E1EE");
  g.addColorStop(1, "#F3F2F7");
  ctx.fillStyle = g;
  ctx.fillRect(0, FOOT_TOP, PROMO_W, STRIP_TOP - FOOT_TOP);
  ctx.fillStyle = "#3B3B3B";
  ctx.fillRect(0, STRIP_TOP, PROMO_W, PROMO_H - STRIP_TOP);

  const name = c.name || "Your company name";
  ctx.font = font(800, 36, "promo");
  const nameW = ctx.measureText(name).width;
  ctx.font = font(500, 22, "cond");
  const addr = c.address || [c.phone, c.email].filter(Boolean).join("  ·  ");
  const addrW = Math.min(900, ctx.measureText(addr).width);
  let logoW = 0;
  let logoDrawW = 0;
  if (logo) {
    const [iw, ih] = imageSize(logo);
    if (iw && ih) {
      logoDrawW = Math.min(160, (iw / ih) * 52);
      logoW = logoDrawW + 14;
    }
  }
  let x = (PROMO_W - (logoW + Math.max(nameW, addrW))) / 2;
  if (logo && logoDrawW) {
    ctx.drawImage(logo, x, FOOT_TOP + 9, logoDrawW, 52);
    x += logoW;
  }
  ctx.fillStyle = t.title;
  ctx.font = font(800, 36, "promo");
  ctx.fillText(name, x, FOOT_TOP + 38);
  if (addr) {
    ctx.fillStyle = "#333333";
    ctx.font = font(500, 22, "cond");
    ctx.fillText(lines(ctx, addr, 900, 1)[0] ?? "", x, FOOT_TOP + 62);
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.font = font(500, 16, "cond");
  ctx.fillText((c.licence ? "DL: " + c.licence + "   ·   " : "") + TRADE_LINE, PROMO_W / 2, STRIP_TOP + 18);
  ctx.textAlign = "left";
}

function scheduleNote(ctx: Ctx, schedule: string) {
  if (!["H", "H1", "X"].includes(schedule)) return;
  const text = `Rx  Schedule ${schedule} drug`;
  ctx.font = font(700, 20, "cond");
  const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = "#B42318";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(PROMO_W - 40 - w, 18, w, 32, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#B42318";
  ctx.fillText(text, PROMO_W - 40 - w + 12, 41);
}

/** The indications to print: the promo's own list, else the product's Uses split at commas. */
export function promoIndications(promo: Promo, uses: string): string[] {
  if (promo.indications.length) return promo.indications;
  return uses
    .split(/[,;]/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .slice(0, 7);
}

const SCALES = [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64];
/** Space kept for the product picture at the bottom left. */
const MIN_SHOT_H = 300;

export function drawPromo(ctx: Ctx, input: PromoInput) {
  const { product: p, promo, company, theme: t, image, logo, photo } = input;
  background(ctx, t, photo);
  const wmBase = wordmark(ctx, p.name, t);
  const blocks = [
    compositionBlock(ctx, p),
    sectionsBlock(ctx, promo, t),
    indicationsBlock(ctx, promoIndications(promo, p.uses), t),
    referencesBlock(ctx, promo.references),
  ];
  const top = wmBase + 14;
  const limit = FOOT_TOP - 34 - MIN_SHOT_H;
  const fits = (s: number) => blocks.reduce((y, b) => y + b.measure(s), top) <= limit;
  const scale = SCALES.find(fits) ?? SCALES[SCALES.length - 1];
  let y = top;
  for (const b of blocks) y = b.draw(y, scale);

  const shotTop = Math.min(y + 8, limit);
  productShot(ctx, image, p, t, shotTop);
  headline(ctx, promo, t);
  priceTicket(ctx, p, promo, t, 850, Math.max(560, Math.min(FOOT_TOP - 300, shotTop + 40)));
  tagline(ctx, promo, t, Boolean(photo));
  if (photo && promo.photoIsAi) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = font(500, 15, "cond");
    ctx.textAlign = "right";
    ctx.fillText("AI-generated image", PROMO_W - 14, FOOT_TOP - 10);
    ctx.textAlign = "left";
  }
  scheduleNote(ctx, p.schedule);
  footer(ctx, company, logo, t);
}
