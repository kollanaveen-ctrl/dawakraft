// Turning photos and canvases into compact files for upload or for the AI.

const PRODUCT_MAX_SIDE = 1080;
const LOGO_MAX_SIDE = 240;
const PHOTO_MAX_SIDE = 1600;
const AI_MAX_SIDE = 1280;
const AI_QUALITY = 0.82;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image could not be loaded"));
    img.src = src;
  });
}

/** Load a File as an image. The object URL is released once decoded. */
export async function fileToImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    // No img.decode() here: the image is drawable once loaded, and decode() can hang forever
    // in some browsers (background tabs, power saving), which froze the wizard.
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function scaled(src: CanvasImageSource & { width: number; height: number }, maxSide: number): HTMLCanvasElement {
  const s = Math.min(1, maxSide / Math.max(src.width, src.height));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(src.width * s));
  out.height = Math.max(1, Math.round(src.height * s));
  out.getContext("2d")?.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

function toBlob(cv: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image"))), type, quality),
  );
}

/** The cut-out product photo, kept transparent (WebP, or PNG where WebP isn't supported). */
export async function productImageBlob(cv: HTMLCanvasElement): Promise<Blob> {
  const out = scaled(cv, PRODUCT_MAX_SIDE);
  const webp = await toBlob(out, "image/webp", 0.85);
  return webp.type === "image/webp" ? webp : toBlob(out, "image/png");
}

/** A lifestyle photo for the Promo circular: at most 1600 px on its long side, as a JPEG. */
export async function photoBlob(src: Blob): Promise<Blob> {
  const img = await fileToImage(src);
  // Drawn straight at the target size (no full-size canvas for a large camera photo).
  const s = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight, 1));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(img.naturalWidth * s));
  cv.height = Math.max(1, Math.round(img.naturalHeight * s));
  const x = cv.getContext("2d");
  if (x) {
    // JPEG has no transparency: a transparent PNG would turn black without a white backing.
    x.fillStyle = "#FFFFFF";
    x.fillRect(0, 0, cv.width, cv.height);
    x.drawImage(img, 0, 0, cv.width, cv.height);
  }
  return toBlob(cv, "image/jpeg", 0.86);
}

export async function logoBlob(file: File): Promise<Blob> {
  const img = await fileToImage(file);
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  cv.getContext("2d")?.drawImage(img, 0, 0);
  return toBlob(scaled(cv, LOGO_MAX_SIDE), "image/png");
}

export type AiImage = { mediaType: "image/jpeg"; data: string };

/** Shrink a box photo to a JPEG the AI can read quickly (base64, no data: prefix). */
export async function aiImage(file: File): Promise<AiImage> {
  const img = await fileToImage(file);
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  cv.getContext("2d")?.drawImage(img, 0, 0);
  const url = scaled(cv, AI_MAX_SIDE).toDataURL("image/jpeg", AI_QUALITY);
  return { mediaType: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}
