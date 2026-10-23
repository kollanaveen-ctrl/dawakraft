import { TRADE_LINE } from "../../constants";
import { mrpText } from "../../format";
import { drawFit, fitText, font, imageSize, type Ctx, type Drawable } from "../draw";
import type { PromoInput } from "./render";
import { drawPromo } from "./render";

/** Wrap every character, including long salt/brand names; never silently ellipsize facts. */
function wrap(ctx: Ctx, value: string, width: number): string[] {
  const output: string[] = [];
  for (const paragraph of value.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && ctx.measureText(`${line} ${word}`).width > width) { output.push(line); line = ""; }
      for (const char of (line ? " " : "") + word) {
        if (ctx.measureText(line + char).width > width && line) { output.push(line); line = ""; }
        line += char;
      }
    }
    if (line) output.push(line);
  }
  return output;
}

function paragraph(ctx: Ctx, text: string, x: number, y: number, w: number, h: number, px: number, color: string, weight = 500, italic = false) {
  let rows: string[] = [];
  do {
    ctx.font = font(weight, px, "cond", italic);
    rows = wrap(ctx, text, w);
    if (rows.length * px * 1.22 <= h || px <= 12) break;
    px--;
  } while (true);
  ctx.fillStyle = color;
  rows.forEach((row, i) => ctx.fillText(row, x, y + px + i * px * 1.22));
  return rows.length * px * 1.22;
}

function cover(ctx: Ctx, image: Drawable, x: number, y: number, w: number, h: number) {
  const [iw, ih] = imageSize(image);
  const scale = Math.max(w / iw, h / ih);
  // AI scenes put the subject on the right; use that part instead of cropping the face away.
  ctx.drawImage(image, Math.max(0, iw - w / scale), Math.max(0, (ih - h / scale) / 2), w / scale, h / scale, x, y, w, h);
}

/** A measured pharma visual aid: exact text and original packaging remain separate from the scene. */
export function drawStudioPromo(ctx: Ctx, input: PromoInput) {
  const { product: p, promo, company: c, theme: t, image, logo, photo } = input;
  // Signature follows the supplied visual-aid references: ingredient tags, suffix badge,
  // folded price ticket, real pack and a photo fading into the copy area.
  if (promo.layout === "editorial" && photo) { drawPromo(ctx, input); return; }
  const portrait = promo.layout === "portrait";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, 1600, 1228);
  ctx.fillStyle = t.wash;
  ctx.fillRect(850, 0, 750, 1120);
  if (photo) {
    ctx.save();
    if (portrait) {
      ctx.beginPath(); ctx.ellipse(1210, 650, 365, 440, 0, 0, Math.PI * 2); ctx.clip();
      cover(ctx, photo, 845, 210, 730, 880);
    } else {
      cover(ctx, photo, 720, 0, 880, 1120);
      const fade = ctx.createLinearGradient(720, 0, 1040, 0);
      fade.addColorStop(0, "#FFFFFF"); fade.addColorStop(1, "#FFFFFF00");
      ctx.fillStyle = fade; ctx.fillRect(720, 0, 320, 1120);
    }
    ctx.restore();
  }
  if (portrait && photo) {
    ctx.strokeStyle = t.title; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.ellipse(1210, 650, 365, 440, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (!photo) {
    // A preview without photography is visibly unfinished; never draw an empty portrait ring.
    paragraph(ctx, "Add a lifestyle photo to finish your flyer", 940, 450, 560, 150, 43, t.title, 700);
  }
  // A white headline zone keeps contrast independent of the uploaded photograph.
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillRect(850, 0, 750, 230);
  ctx.fillStyle = t.badge; ctx.fillRect(64, 56, 54, 5);
  ctx.fillStyle = t.title;
  paragraph(ctx, p.name || "Your product", 64, 86, 750, 160, 116, t.title, 900, true);
  paragraph(ctx, p.composition, 68, 255, 710, 110, 33, "#25323D");
  const sections = promo.sections.filter(s => s.title || s.bullets.some(Boolean)).map(s => ({ title: s.title, body: s.bullets.filter(Boolean).map(b => `• ${b}`).join("\n") }));
  const indications = promo.indications.filter(Boolean).join(" • ") || p.uses;
  if (indications) sections.push({ title: "INDICATIONS", body: indications });
  if (!sections.length) sections.push({ title: "PRODUCT DETAILS", body: [p.form, p.storage, `Manufactured by ${p.manufacturer}`].filter(Boolean).join("\n") });
  let contentPx = 31;
  const heightAt = (px: number) => {
    ctx.font = font(500, px, "cond");
    return sections.reduce((height, s) => height + (s.title ? px * 1.65 : 0) + wrap(ctx, s.body, 680).length * px * 1.22 + 12, 0);
  };
  while (heightAt(contentPx) > 290 && contentPx > 14) contentPx--;
  let cy = 385;
  for (const [i, section] of sections.entries()) {
    if (section.title) {
      ctx.fillStyle = t.tags[i % t.tags.length];
      ctx.fillRect(68, cy, 710, contentPx * 1.35);
      ctx.fillStyle = "#FFFFFF";
      fitText(ctx, section.title.toUpperCase(), 82, cy + contentPx, 680, 700, contentPx, "cond", 14);
      cy += contentPx * 1.65;
    }
    cy += paragraph(ctx, section.body, 82, cy, 680, 290, contentPx, "#25323D") + 12;
  }
  // Product occupies a guaranteed area; long copy cannot push it off the page.
  const shotY = Math.max(600, cy + 25);
  if (image) drawFit(ctx, image, 65, shotY, 725, Math.max(250, 1040 - shotY));
  paragraph(ctx, promo.headline, 905, 42, 630, 105, 52, t.title, 700, true);
  if (promo.banner) {
    ctx.fillStyle = t.banner; ctx.fillRect(905, 162, 630, 57);
    ctx.fillStyle = "#FFFFFF";
    fitText(ctx, promo.banner, 927, 203, 586, 800, 34, "cond", 19);
  }
  // Price panel sits on a solid ground, never on a face or pack.
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(944, 901, 560, 150);
  ctx.fillStyle = t.title; ctx.fillRect(944, 901, 180, 150);
  const specs = [["M.R.P.", mrpText(p.mrp)], ["Pack size", p.packSize], ...(promo.caseSize ? [["Case size", promo.caseSize]] : [])];
  const rh = 150 / specs.length;
  specs.forEach(([label, value], i) => {
    ctx.fillStyle = "#FFFFFF"; ctx.font = font(700, 27, "cond"); ctx.fillText(label, 963, 901 + i * rh + rh * 0.64);
    paragraph(ctx, value, 1142, 907 + i * rh, 340, rh - 12, 32, "#182C3B", 700);
  });
  if (promo.tagline) paragraph(ctx, promo.tagline, 900, 1063, 640, 45, 29, t.title, 700, true);
  if (promo.references.length) paragraph(ctx, promo.references.map((r, i) => `${i + 1}. ${r}`).join("  "), 68, 1055, 720, 48, 17, "#4B5563");
  if (photo && promo.photoIsAi) {
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(1320, 865, 250, 27);
    ctx.fillStyle = "#334155"; ctx.font = font(500, 17, "cond"); ctx.fillText("AI-generated lifestyle image", 1330, 885);
  }
  ctx.fillStyle = t.title; ctx.fillRect(0, 1120, 1600, 4);
  ctx.fillStyle = "#F5F7F8"; ctx.fillRect(0, 1124, 1600, 104);
  if (logo) drawFit(ctx, logo, 65, 1140, 65, 65);
  const fx = logo ? 150 : 68;
  ctx.fillStyle = t.title; fitText(ctx, c.name || "Your company", fx, 1162, 960, 800, 31, "display", 18);
  paragraph(ctx, [c.address, c.phone].filter(Boolean).join(" · "), fx, 1172, 1000, 32, 19, "#465464");
  const note = [p.schedule && p.schedule !== "None" ? `Schedule ${p.schedule}` : "", TRADE_LINE].filter(Boolean).join(" · ");
  paragraph(ctx, note, 1200, 1144, 335, 60, 19, "#465464");
}
