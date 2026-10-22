// GET /api/auth/me: { ok: true, data: { userId, email } } when signed in, { ok: true, data: null } when not.
import { connection } from "next/server";
import { fail, failFromError, ok } from "@/lib/api/respond";
import { getSession } from "@/lib/auth/server";
import { cloudflareReady } from "@/lib/config";

export async function GET() {
  // Session responses require a live request, including when auth is unconfigured.
  // Keep the prerender boundary outside application error handling.
  await connection();
  if (!cloudflareReady()) return fail("not_configured", 503);
  try {
    return ok(await getSession());
  } catch (error) {
    return failFromError(error, "auth/me");
  }
}
