export const UNSUPPORTED_PHOTO_MESSAGE = "The image you have uploaded doesn't support flyer generation.";

/** Never enlarge a small photo and pretend the missing label detail exists. */
export function sourceHasEnoughPixels(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && Math.min(width, height) >= 400;
}
