/** A studio source must have a nearly white, neutral border before background removal.
 * This rejects the warehouse/table fallback that originally reached the flyer. */
export function hasStudioBackground(pixels: Uint8ClampedArray, width: number, height: number): boolean {
  if (width < 2 || height < 2 || pixels.length !== width * height * 4) return false;
  let clean = 0, total = 0;
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    total++;
    if (pixels[i + 3] < 10 || (Math.min(...rgb) >= 236 && Math.max(...rgb) - Math.min(...rgb) <= 14)) clean++;
  };
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 100))) { sample(x, 0); sample(x, height - 1); }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 100))) { sample(0, y); sample(width - 1, y); }
  return total > 0 && clean / total >= 0.96;
}
