// Colour helpers used by the circular templates (ported from the prototype).

const DEFAULT_BRAND = "#0B7A63";

export function hexRgb(hex: string | null | undefined): [number, number, number] {
  let h = String(hex || DEFAULT_BRAND).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return hexRgb(DEFAULT_BRAND);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Blend `hex` toward `toward` by t (0..1). */
export function mix(hex: string, toward: string, t: number): string {
  const a = hexRgb(hex);
  const b = hexRgb(toward);
  return (
    "#" +
    a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("")
  );
}

function luminance(hex: string): number {
  const c = hexRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Dark or white text, whichever reads better on `hex`. */
export function textOn(hex: string): string {
  return luminance(hex) > 0.42 ? "#0F1F24" : "#FFFFFF";
}

export function isHexColour(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}
