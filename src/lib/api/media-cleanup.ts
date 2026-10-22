// Server-only: best-effort removal of photos the user no longer needs. Only keys under the
// user's own folder are ever touched; failures are logged, never shown (the rows are already gone).
import { ownsKey } from "../cloudflare/media-keys";
import { deleteObjects, r2 } from "../cloudflare/r2";

export async function removeOwnedMedia(userId: string, paths: unknown[], tag: string): Promise<void> {
  const cfg = r2();
  const keys = [...new Set(paths.filter((p): p is string => ownsKey(userId, p)))];
  if (!cfg || !keys.length) return;
  const failed = await deleteObjects(cfg, keys);
  if (failed) console.warn(`[${tag}] ${failed} photo(s) could not be removed`);
}
