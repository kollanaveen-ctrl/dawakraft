import { TRADE_LINE } from "../../constants";
import { mrpText } from "../../format";
import { drawFit, font, imageSize, type Ctx } from "../draw";
import type { PromoInput } from "./render";

/** Word-wrap without dropping ingredient names or strengths. */
function rows(ctx: Ctx, text: string, width: number) {
  const out: string[] = []; let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && ctx.measureText(`${line} ${word}`).width > width) { out.push(line); line = ""; }
    for (const char of (line ? " " : "") + word) {
      if (line && ctx.measureText(line + char).width > width) { out.push(line); line = ""; }
      line += char;
    }
  }
  if (line) out.push(line);
  return out;
}

function block(ctx: Ctx, text: string, x: number, y: number, w: number, h: number, size: number, colour: string, weight = 600) {
  let wrapped: string[];
  do {
    ctx.font = font(weight, size, "cond"); wrapped = rows(ctx, text, w);
    if (wrapped.length * size * 1.22 <= h || size <= 12) break;
    size--;
  } while (true);
  ctx.fillStyle = colour;
  wrapped.forEach((line, i) => ctx.fillText(line, x, y + size + i * size * 1.22));
}

/** 9:16 WhatsApp Story, with space above and below the essential content for app controls. */
export function drawStoryPromo(ctx: Ctx, { product: p, company: c, promo, theme: t, image, photo, logo }: PromoInput) {
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, 1080, 1920);
  if (photo) {
    const [iw, ih] = imageSize(photo), w = 800, h = 1420;
    const scale = Math.max(w / iw, h / ih);
    ctx.save();
    if (promo.layout === "portrait") { ctx.beginPath(); ctx.ellipse(830, 790, 400, 700, 0, 0, Math.PI * 2); ctx.clip(); }
    ctx.drawImage(photo, Math.max(0, iw - w / scale), Math.max(0, (ih - h / scale) / 2), w / scale, h / scale, 280, 70, w, h);
    ctx.restore();
    const fade = ctx.createLinearGradient(180, 0, 830, 0);
    fade.addColorStop(0, "#FFFFFF"); fade.addColorStop(.4, "#FFFFFFE8"); fade.addColorStop(1, "#FFFFFF00");
    ctx.fillStyle = fade; ctx.fillRect(0, 0, 1080, 1490);
    const bottom = ctx.createLinearGradient(0, 1280, 0, 1520);
    bottom.addColorStop(0, "#FFFFFF00"); bottom.addColorStop(1, "#FFFFFF");
    ctx.fillStyle = bottom; ctx.fillRect(0, 1280, 1080, 250);
  }
  ctx.fillStyle = t.ribbon; ctx.fillRect(64, 126, 76, 7);
  block(ctx, p.name, 60, 155, 955, 155, 112, t.title, 800);
  block(ctx, p.composition, 66, 325, 670, 120, 39, "#253342");
  block(ctx, promo.headline, 66, 470, 610, 172, 65, t.title, 800);
  if (promo.banner) {
    ctx.fillStyle = t.title; ctx.fillRect(64, 674, 952, 93);
    ctx.fillStyle = t.ribbon; ctx.fillRect(64, 674, 10, 93);
    block(ctx, promo.banner, 95, 687, 880, 65, 44, "#FFFFFF", 800);
  }
  // The source product is prominent and remains unfiltered: no recolouring or generated artwork.
  if (image) drawFit(ctx, image, 50, 797, 590, 696);
  ctx.fillStyle = t.ribbon; ctx.fillRect(674, 1290, 342, 92);
  block(ctx, `M.R.P. ${mrpText(p.mrp)}`, 695, 1305, 300, 62, 46, "#FFFFFF", 800);
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(674, 1382, 342, 85);
  block(ctx, p.packSize, 695, 1393, 300, 58, 34, t.title, 700);
  ctx.strokeStyle = t.ribbon; ctx.lineWidth = 2; ctx.strokeRect(674, 1382, 342, 85);
  const uses = [...promo.indications, ...(promo.usesCheckedFor === promo.suggestedUses?.join(" | ") ? promo.suggestedUses ?? [] : [])];
  const points = promo.sections.slice(0, 3).map(s => `${s.title}: ${s.bullets.join(" · ")}`);
  const content = [...points, ...(uses.length ? [`Uses: ${[...new Set(uses)].join(" · ")}`] : [])];
  ctx.fillStyle = t.title; ctx.fillRect(64, 1530, 44, 4);
  block(ctx, "FORMULATION OVERVIEW", 126, 1517, 830, 44, 28, t.title, 700);
  block(ctx, content.join("  •  "), 64, 1580, 952, 142, 36, "#253342", 500);
  block(ctx, promo.tagline, 64, 1730, 952, 48, 31, t.title, 700);
  ctx.fillStyle = t.title; ctx.fillRect(0, 1810, 1080, 110);
  if (logo) drawFit(ctx, logo, 64, 1826, 60, 60);
  block(ctx, c.name, logo ? 145 : 64, 1824, logo ? 870 : 950, 46, 35, "#FFFFFF", 800);
  const contact = [c.phone, c.email].filter(Boolean).join(" · ");
  block(ctx, contact || TRADE_LINE, 64, 1871, 950, 28, 19, "#FFFFFF", 500);
  if (promo.photoIsAi) block(ctx, "AI-generated supporting visual", 710, 1780, 306, 23, 17, "#586575", 500);
}
