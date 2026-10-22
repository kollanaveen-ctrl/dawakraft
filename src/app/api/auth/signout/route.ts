// POST /api/auth/signout: end this session (database row and cookie). Safe to call when signed out.
import { cookies } from "next/headers";
import { fail, ok, sameOrigin } from "@/lib/api/respond";
import { SESSION_COOKIE, hashSessionToken, isWellFormedToken, sessionCookieOptions } from "@/lib/auth/session-token";
import { d1 } from "@/lib/cloudflare/d1";
import { cloudflareReady } from "@/lib/config";
import { deleteSession } from "@/lib/db/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("forbidden", 403);
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (cloudflareReady() && isWellFormedToken(token)) {
    try {
      await deleteSession(d1(), hashSessionToken(token));
    } catch (error) {
      // The cookie is cleared anyway; the row expires on its own.
      console.error("[auth/signout] could not delete the session", error instanceof Error ? error.message : error);
    }
  }
  store.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return ok(null);
}
