// POST /api/media/upload-url { name, contentType, size }: a 5-minute signed link to upload one photo
// straight to R2, under the user's own folder. Answers 503 storage_not_configured until R2 is set up.
import { randomBytes } from "node:crypto";
import { fail, ok, parseBody, withUser } from "@/lib/api/respond";
import { MAX_UPLOAD_BYTES, mediaKey } from "@/lib/cloudflare/media-keys";
import { presignPut, r2 } from "@/lib/cloudflare/r2";
import { UploadUrlSchema } from "@/lib/db/schemas";
import { allow } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 1_000;
const UPLOADS_PER_WINDOW = 60;
const UPLOAD_WINDOW_MS = 10 * 60_000;

export const POST = withUser("media/upload-url", async (request, user) => {
  const cfg = r2();
  if (!cfg) return fail("storage_not_configured", 503);
  const body = await parseBody(request, UploadUrlSchema, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  if (body.data.size > MAX_UPLOAD_BYTES) return fail("too_large", 413);
  if (!allow(`upload:${user.userId}`, UPLOADS_PER_WINDOW, UPLOAD_WINDOW_MS)) return fail("rate_limited", 429);
  const path = mediaKey(user.userId, body.data.name, body.data.contentType, randomBytes(6).toString("hex"));
  return ok({ path, url: await presignPut(cfg, path, body.data.contentType) });
});
