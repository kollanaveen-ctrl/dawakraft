import { TRADE_LINE } from "../../constants";
import { mrpText } from "../../format";
import { drawFit, font, imageSize, type Ctx, type Family } from "../draw";
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

function block(ctx: Ctx, text: string, x: number, y: number, w: number, h: number, size: number, colour: string, weight = 600, family: Family = "cond", italic = false) {
  let wrapped: string[];
  do {
    ctx.font = font(weight, size, family, italic); wrapped = rows(ctx, text, w);
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
  const veil = ctx.createLinearGradient(0, 0, 750, 0);
  veil.addColorStop(0, "#FFFFFFDE"); veil.addColorStop(.57, "#FFFFFFD9");
  veil.addColorStop(.8, "#FFFFFF80"); veil.addColorStop(1, "#FFFFFF00");
  ctx.fillStyle = veil; ctx.fillRect(0, 0, 1080, 1920);
  const top = ctx.createLinearGradient(0, 0, 0, 430);
  top.addColorStop(0, "#FFFFFFBF"); top.addColorStop(1, "#FFFFFF00");
  ctx.fillStyle = top; ctx.fillRect(0, 0, 1080, 430);
  const ground = ctx.createLinearGradient(0, 1570, 0, 1810);
  ground.addColorStop(0, "#FFFFFF00"); ground.addColorStop(1, "#FFFFFFE8");
  ctx.fillStyle = ground; ctx.fillRect(0, 1570, 1080, 350);
  ctx.fillStyle = t.ribbon; ctx.fillRect(64, 136, 8, 105);
  block(ctx, p.name, 94, 125, 922, 145, 102, t.title, 800, "promo", true);
  block(ctx, p.composition, 66, 292, 850, 104, 37, "#253342");
  block(ctx, promo.headline, 66, 451, 506, 172, 58, t.title, 700, "promo", true);
  if (promo.banner) {
    ctx.fillStyle = t.title; ctx.fillRect(64, 650, 508, 93);
    ctx.fillStyle = t.ribbon; ctx.fillRect(64, 650, 10, 93);
    block(ctx, promo.banner, 87, 660, 462, 73, 38, "#FFFFFF", 800);
  }
  const uses = [...promo.indications, ...(promo.usesCheckedFor === promo.suggestedUses?.join(" | ") ? promo.suggestedUses ?? [] : [])];
  const points = promo.sections.slice(0, 3).map(s => `${s.title}: ${s.bullets.join(" · ")}`);
  const content = [...points, ...(uses.length ? [`Uses: ${[...new Set(uses)].join(" · ")}`] : [])];
  ctx.fillStyle = t.ribbon; ctx.fillRect(64, 791, 36, 4);
  block(ctx, "FORMULATION", 116, 776, 450, 40, 27, t.title, 700);
  block(ctx, content.join("  •  "), 64, 832, 508, 168, 33, "#253342", 500);
  // Only a contact shadow is added. The actual uploaded packaging is never relit,
  // recoloured or generated. Bottom alignment makes boxes and bottles share the ground.
  if (image) {
    const [iw, ih] = imageSize(image), scale = Math.min(508 / iw, 610 / ih);
    const w = iw * scale, h = ih * scale, x = 64 + (508 - w) / 2, y = 1620 - h;
    ctx.save(); ctx.shadowColor = "#1E302B40"; ctx.shadowBlur = 24;
    ctx.fillStyle = "#29433A10"; ctx.beginPath(); ctx.ellipse(324, 1624, w * .44, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.drawImage(image, x, y, w, h);
  }
  ctx.fillStyle = t.ribbon; ctx.fillRect(64, 1650, 508, 52);
  block(ctx, `M.R.P. ${mrpText(p.mrp)}`, 82, 1654, 472, 44, 34, "#FFFFFF", 800);
  ctx.fillStyle = "#FFFFFFD9"; ctx.fillRect(64, 1702, 508, 43);
  block(ctx, `Pack: ${p.packSize}`, 82, 1705, 472, 36, 27, t.title, 700);
  block(ctx, promo.tagline, 64, 1761, 952, 43, 29, t.title, 700, "promo", true);
  ctx.fillStyle = "#FFFFFFE8"; ctx.fillRect(0, 1810, 1080, 110);
  ctx.fillStyle = t.title; ctx.fillRect(64, 1810, 952, 2);
  if (logo) drawFit(ctx, logo, 64, 1824, 54, 54);
  block(ctx, c.name, logo ? 136 : 64, 1820, logo ? 880 : 950, 40, 32, t.title, 800, "promo");
  const contact = [c.phone, c.email].filter(Boolean).join(" · ");
  block(ctx, contact || TRADE_LINE, 64, 1866, 950, 25, 18, "#253342", 500);
  if (promo.photoIsAi) block(ctx, "AI-generated supporting visual", 650, 1896, 366, 19, 14, "#586575", 500);
}
