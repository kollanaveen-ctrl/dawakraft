// /api/media — the signed-in user's own photos in R2.
//   GET    ?path=<key>  redirect (302) to a 10-minute signed download link
//   DELETE { paths }    remove photos
// Only keys under "<user id>/" are allowed; anything else is refused.
import { NextResponse } from "next/server";
import { fail, ok, parseBody, withUser } from "@/lib/api/respond";
import { removeOwnedMedia } from "@/lib/api/media-cleanup";
import { ownsKey } from "@/lib/cloudflare/media-keys";
import { presignGet, r2 } from "@/lib/cloudflare/r2";
import { DeleteMediaSchema } from "@/lib/db/schemas";

const MAX_DELETE_BYTES = 32 * 1024;

export const GET = withUser("media", async (request, user) => {
  const cfg = r2();
  if (!cfg) return fail("storage_not_configured", 503);
  const path = new URL(request.url).searchParams.get("path");
  if (!ownsKey(user.userId, path)) return fail("forbidden", 403);
  const res = NextResponse.redirect(await presignGet(cfg, path), 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
});

export const DELETE = withUser("media", async (request, user) => {
  if (!r2()) return fail("storage_not_configured", 503);
  const body = await parseBody(request, DeleteMediaSchema, MAX_DELETE_BYTES);
  if (!body.ok) return body.response;
  if (!body.data.paths.every((p) => ownsKey(user.userId, p))) return fail("forbidden", 403);
  await removeOwnedMedia(user.userId, body.data.paths, "media");
  return ok(null);
});
