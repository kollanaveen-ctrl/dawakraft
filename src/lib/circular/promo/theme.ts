// Colour themes for the Promo circular, taken from the company's own circulars, and picking the
// one that matches the pack: the strongest colour on the product picture decides. The colour maths
// is pure (tested); themeFromImage only reads pixels.
import type { Drawable } from "../draw";
import { imageSize } from "../draw";

export type PromoTheme = {
  key: string;
  label: string;
  /** Wordmark and headline colour. */
  title: string;
  /** Behind the brand suffix (XT, SP, MD8). */
  badge: string;
  /** Behind the headline's banner words. */
  banner: string;
  /** The price ticket. */
  ribbon: string;
  /** Ingredient tag headers, used in turn. */
  tags: readonly string[];
  /** Tint for the background when there is no photo. */
  wash: string;
};

export const PROMO_THEMES: readonly PromoTheme[] = [
  { key: "navy", label: "Navy & red", title: "#10357A", badge: "#E01E2B", banner: "#10357A", ribbon: "#159C99", tags: ["#10357A", "#E01E2B"], wash: "#DCE6F7" },
  { key: "purple", label: "Purple & orange", title: "#2B2F8F", badge: "#8E1E8F", banner: "#C0161F", ribbon: "#F28C28", tags: ["#2B2F8F", "#8E1E8F"], wash: "#EEE3F3" },
  { key: "magenta", label: "Magenta", title: "#7A1E7E", badge: "#9B2B9B", banner: "#7A1E7E", ribbon: "#8E2A8E", tags: ["#7A1E7E", "#B0306F"], wash: "#F4E4F1" },
  { key: "orange", label: "Orange & blue", title: "#0D3B8C", badge: "#F37021", banner: "#C81E28", ribbon: "#F37021", tags: ["#0D3B8C", "#E2531B"], wash: "#FBE9DC" },
  { key: "green", label: "Green & gold", title: "#0F6E52", badge: "#0F6E52", banner: "#0F6E52", ribbon: "#C9A227", tags: ["#D62828", "#2E9E4F"], wash: "#DDEFE6" },
  { key: "blue", label: "Blue & red", title: "#133C8B", badge: "#133C8B", banner: "#C21F2B", ribbon: "#D7262E", tags: ["#2E9E4F", "#D7262E", "#8E2A8E"], wash: "#E1EAF6" },
];

export const DEFAULT_THEME = PROMO_THEMES[0];

export function themeByKey(key: string): PromoTheme | null {
  return PROMO_THEMES.find((t) => t.key === key) ?? null;
}

/** The theme for a hue in degrees (0–360), as the circulars pair pack colours with themes. */
export function themeForHue(hue: number | null): PromoTheme {
  if (hue == null) return DEFAULT_THEME;
  const h = ((hue % 360) + 360) % 360;
  const key =
    h < 12 || h >= 345 ? "orange" : // red packs pair with the orange/blue look
    h < 50 ? "orange" :
    h < 75 ? "green" : // yellow-gold
    h < 170 ? "green" :
    h < 205 ? "blue" : // teal and cyan
    h < 250 ? "navy" :
    h < 290 ? "purple" :
    "magenta";
  return themeByKey(key) ?? DEFAULT_THEME;
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max / 255];
}

const HUE_BINS = 24;

/**
 * The pack's strongest colour: a weighted vote over clearly coloured, opaque pixels (white card,
 * black text, greys and the transparent background don't vote). Null when nothing is coloured.
 */
export function dominantHue(data: Uint8ClampedArray, step = 4): number | null {
  const bins = new Float64Array(HUE_BINS);
  let voted = 0;
  for (let i = 0; i < data.length; i += 4 * step) {
    if (data[i + 3] < 200) continue;
    const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    if (s < 0.35 || v < 0.25) continue;
    bins[Math.floor(h / (360 / HUE_BINS)) % HUE_BINS] += s * v;
    voted++;
  }
  if (voted < 20) return null;
  let best = 0;
  for (let k = 1; k < HUE_BINS; k++) if (bins[k] > bins[best]) best = k;
  return (best + 0.5) * (360 / HUE_BINS);
}

/** The theme that matches the product picture (navy when there is none or it has no clear colour). */
export function themeFromImage(img: Drawable | null): PromoTheme {
  if (!img) return DEFAULT_THEME;
  const [w, h] = imageSize(img);
  if (!w || !h) return DEFAULT_THEME;
  const s = Math.min(1, 160 / Math.max(w, h));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w * s));
  cv.height = Math.max(1, Math.round(h * s));
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return DEFAULT_THEME;
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  return themeForHue(dominantHue(ctx.getImageData(0, 0, cv.width, cv.height).data, 1));
}
