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
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  wrapped.forEach((line, i) => ctx.fillText(line, x, y + size + i * size * 1.22));
  ctx.restore();
}

/** 9:16 WhatsApp Story, with space above and below the essential content for app controls. */
export function drawStoryPromo(ctx: Ctx, { product: p, company: c, promo, theme: t, image, photo, logo }: PromoInput) {
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, 1080, 1920);
  // One continuous scene, not a photo tile. New backgrounds reserve the right third
  // for the person and the left for readable copy and the original product cutout.
  if (photo) {
    const [iw, ih] = imageSize(photo), scale = Math.max(1080 / iw, 1920 / ih);
    const sw = 1080 / scale, sh = 1920 / scale;
    ctx.drawImage(photo, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, 1080, 1920);
  } else { ctx.fillStyle = t.wash; ctx.fillRect(0, 0, 1080, 1920); }
  const veil = ctx.createLinearGradient(0, 0, 840, 0);
  veil.addColorStop(0, "#FFFFFFF5"); veil.addColorStop(.66, "#FFFFFFFA");
  veil.addColorStop(.76, "#FFFFFFD9"); veil.addColorStop(1, "#FFFFFF00");
  ctx.fillStyle = veil; ctx.fillRect(0, 0, 1080, 1920);
  const top = ctx.createLinearGradient(0, 0, 0, 720);
  top.addColorStop(0, "#FFFFFFF5"); top.addColorStop(.58, "#FFFFFFEB"); top.addColorStop(1, "#FFFFFF00");
  ctx.fillStyle = top; ctx.fillRect(0, 0, 1080, 720);
  const ground = ctx.createLinearGradient(0, 1430, 0, 1810);
  ground.addColorStop(0, "#FFFFFF00"); ground.addColorStop(1, "#FFFFFFE8");
  ctx.fillStyle = ground; ctx.fillRect(0, 1430, 1080, 490);
  ctx.fillStyle = t.ribbon; ctx.fillRect(64, 126, 76, 7);
  block(ctx, p.name, 60, 155, 955, 155, 112, t.title, 800);
  block(ctx, p.composition, 66, 325, 950, 120, 39, "#253342");
  block(ctx, promo.headline, 66, 470, 506, 172, 65, t.title, 800);
  if (promo.banner) {
    ctx.fillStyle = t.title; ctx.fillRect(64, 674, 508, 93);
    ctx.fillStyle = t.ribbon; ctx.fillRect(64, 674, 10, 93);
    block(ctx, promo.banner, 87, 684, 462, 73, 38, "#FFFFFF", 800);
  }
  const uses = [...promo.indications, ...(promo.usesCheckedFor === promo.suggestedUses?.join(" | ") ? promo.suggestedUses ?? [] : [])];
  const points = promo.sections.slice(0, 3).map(s => `${s.title}: ${s.bullets.join(" · ")}`);
  const content = [...points, ...(uses.length ? [`Uses: ${[...new Set(uses)].join(" · ")}`] : [])];
  ctx.fillStyle = t.title; ctx.fillRect(64, 807, 36, 4);
  block(ctx, "FORMULATION OVERVIEW", 116, 793, 450, 44, 27, t.title, 700);
  block(ctx, content.join("  •  "), 64, 850, 508, 190, 34, "#253342", 500);
  // Only a contact shadow is added. The actual uploaded packaging is never relit,
  // recoloured or generated. Bottom alignment makes boxes and bottles share the ground.
  if (image) {
    const [iw, ih] = imageSize(image), scale = Math.min(508 / iw, 610 / ih);
    const w = iw * scale, h = ih * scale, x = 64 + (508 - w) / 2, y = 1650 - h;
    ctx.save(); ctx.shadowColor = "#1E302B40"; ctx.shadowBlur = 24;
    ctx.fillStyle = "#29433A10"; ctx.beginPath(); ctx.ellipse(318, 1654, w * .44, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.drawImage(image, x, y, w, h);
  }
  ctx.fillStyle = t.ribbon; ctx.fillRect(64, 1680, 508, 62);
  block(ctx, `M.R.P. ${mrpText(p.mrp)}`, 82, 1687, 472, 47, 36, "#FFFFFF", 800);
  ctx.fillStyle = "#FFFFFFD9"; ctx.fillRect(64, 1742, 508, 51);
  block(ctx, `Pack: ${p.packSize}`, 82, 1746, 472, 40, 29, t.title, 700);
  block(ctx, promo.tagline, 624, 1660, 392, 107, 34, t.title, 700);
  ctx.fillStyle = t.title; ctx.fillRect(0, 1810, 1080, 110);
  if (logo) drawFit(ctx, logo, 64, 1826, 60, 60);
  block(ctx, c.name, logo ? 145 : 64, 1824, logo ? 870 : 950, 46, 35, "#FFFFFF", 800);
  const contact = [c.phone, c.email].filter(Boolean).join(" · ");
  block(ctx, contact || TRADE_LINE, 64, 1871, 950, 28, 19, "#FFFFFF", 500);
  if (promo.photoIsAi) block(ctx, "AI-generated supporting visual", 650, 1780, 366, 23, 17, "#586575", 500);
}
