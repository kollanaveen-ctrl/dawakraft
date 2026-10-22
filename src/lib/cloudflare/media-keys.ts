// Server-only: photo keys in R2 and who owns them. Pure, so it is unit-tested directly.
// Every photo lives under "<user id>/…"; a user may only reach keys under their own prefix.
// This replaces Supabase's storage policies.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const UPLOAD_TYPES = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" } as const;
export type UploadType = keyof typeof UPLOAD_TYPES;
const MAX_KEY_CHARS = 300;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;

/** A safe name part: letters, digits, "-", "_" and "/" folders (e.g. "products/abc"), no "..". */
export function safeName(name: string): string {
  const cleaned = name
    .replace(/[^A-Za-z0-9/_-]+/g, "-")
    .split("/")
    .map((part) => part.replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join("/")
    .slice(0, 80);
  return cleaned || "photo";
}

/** "<userId>/<safe name>-<random>.<ext>" */
export function mediaKey(userId: string, name: string, type: UploadType, random: string): string {
  return `${userId}/${safeName(name)}-${random}.${UPLOAD_TYPES[type]}`;
}

/** True only for a well-formed key under this user's own folder. */
export function ownsKey(userId: string, key: unknown): key is string {
  if (typeof key !== "string" || !userId || key.length > MAX_KEY_CHARS) return false;
  if (!KEY_PATTERN.test(key) || key.includes("..") || key.includes("//")) return false;
  return key.startsWith(`${userId}/`) && key.length > userId.length + 1;
}

/** A stored path (image, logo, promo photo) is fine when empty or owned by this user. */
export function pathAllowed(userId: string, path: string | null | undefined): boolean {
  return path == null || path === "" || ownsKey(userId, path);
}
