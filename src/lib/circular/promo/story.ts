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
  ctx.fillStyle = t.wash; ctx.fillRect(0, 0, 1080, 1130);
  if (photo) {
    const [iw, ih] = imageSize(photo), w = 800, h = 1050;
    const scale = Math.max(w / iw, h / ih);
    ctx.save();
    if (promo.layout === "portrait") { ctx.beginPath(); ctx.ellipse(780, 600, 390, 540, 0, 0, Math.PI * 2); ctx.clip(); }
    ctx.drawImage(photo, Math.max(0, iw - w / scale), 0, w / scale, h / scale, 280, 60, w, h);
    ctx.restore();
    const fade = ctx.createLinearGradient(0, 0, 900, 0);
    fade.addColorStop(0, "#FFFFFF"); fade.addColorStop(.35, "#FFFFFFF2"); fade.addColorStop(1, "#FFFFFF00");
    ctx.fillStyle = fade; ctx.fillRect(0, 0, 1080, 1130);
    const bottom = ctx.createLinearGradient(0, 850, 0, 1140);
    bottom.addColorStop(0, "#FFFFFF00"); bottom.addColorStop(1, "#FFFFFF");
    ctx.fillStyle = bottom; ctx.fillRect(0, 850, 1080, 300);
  }
  ctx.fillStyle = t.badge; ctx.fillRect(64, 142, 62, 7);
  block(ctx, p.name, 64, 172, 950, 170, 88, t.title, 800);
  block(ctx, p.composition, 68, 355, 650, 145, 35, "#253342");
  block(ctx, promo.headline, 68, 520, 570, 175, 58, t.title, 800);
  if (promo.banner) {
    ctx.fillStyle = t.banner; ctx.fillRect(64, 724, 675, 95);
    block(ctx, promo.banner, 88, 736, 625, 70, 41, "#FFFFFF", 800);
  }
  // Only the prepared original-photo pixels are placed here. No tint or image filters.
  if (image) drawFit(ctx, image, 60, 855, 680, 435);
  ctx.fillStyle = t.ribbon; ctx.fillRect(756, 1080, 260, 170);
  block(ctx, "M.R.P. ₹", 780, 1095, 210, 38, 28, "#FFFFFF");
  block(ctx, mrpText(p.mrp), 780, 1140, 210, 75, 45, "#FFFFFF", 800);
  block(ctx, `Pack: ${p.packSize}`, 68, 1300, 950, 48, 31, t.title, 700);
  const uses = [...promo.indications, ...(promo.usesCheckedFor === promo.suggestedUses?.join(" | ") ? promo.suggestedUses ?? [] : [])];
  const sections = promo.sections.slice(0, 3);
  const points = sections.map(s => `${s.title}: ${s.bullets.join(" · ")}`);
  const content = [...points, ...(uses.length ? [`Uses: ${[...new Set(uses)].join(" · ")}`] : [])];
  ctx.fillStyle = t.wash; ctx.fillRect(64, 1372, 952, 286);
  block(ctx, content.join("  •  "), 88, 1388, 904, 232, 32, "#253342", 500);
  block(ctx, promo.tagline, 68, 1677, 944, 50, 36, t.title, 700);
  ctx.fillStyle = t.title; ctx.fillRect(0, 1750, 1080, 170);
  if (logo) drawFit(ctx, logo, 64, 1770, 72, 72);
  block(ctx, c.name, logo ? 158 : 64, 1770, logo ? 850 : 950, 48, 38, "#FFFFFF", 800);
  block(ctx, [c.phone, c.email].filter(Boolean).join(" · "), 64, 1820, 950, 35, 24, "#FFFFFF", 500);
  block(ctx, TRADE_LINE, 64, 1863, 950, 30, 20, "#FFFFFF", 500);
  if (promo.photoIsAi) block(ctx, "AI-generated supporting visual", 710, 1708, 300, 24, 17, "#586575", 500);
}
