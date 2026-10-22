// POST /api/auth/start { email }: email a 6-digit sign-in code. Always answers { ok: true } for a
// valid address, so nobody can use it to find out which emails have accounts.
import { randomUUID } from "node:crypto";
import { requestIp } from "@/lib/ai/access";
import { fail, failFromError, ok, parseBody, sameOrigin } from "@/lib/api/respond";
import { CODES_PER_EMAIL, CODES_PER_IP, CODE_TTL_MS, CODE_WINDOW_MS, StartRequestSchema, generateCode, hashCode } from "@/lib/auth/codes";
import { sendCodeEmail } from "@/lib/auth/email";
import { d1 } from "@/lib/cloudflare/d1";
import { authSecret, cloudflareReady } from "@/lib/config";
import { insertCode, recentCodeCounts } from "@/lib/db/auth";
import { allow } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 2_000;

export async function POST(request: Request) {
  const secret = authSecret();
  if (!cloudflareReady() || !secret) return fail("not_configured", 503);
  if (!sameOrigin(request)) return fail("forbidden", 403);

  const ip = await requestIp();
  // Cheap first line of defence before touching the database.
  if (!allow(`auth-start:${ip}`, CODES_PER_IP, CODE_WINDOW_MS)) return fail("rate_limited", 429);

  const body = await parseBody(request, StartRequestSchema, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const { email } = body.data;

  try {
    const db = d1();
    const now = new Date();
    const counts = await recentCodeCounts(db, email, ip, new Date(now.getTime() - CODE_WINDOW_MS).toISOString());
    if (counts.byEmail >= CODES_PER_EMAIL || counts.byIp >= CODES_PER_IP) return fail("rate_limited", 429);

    const code = generateCode();
    await insertCode(db, {
      id: randomUUID(),
      email,
      codeHash: hashCode(secret, email, code),
      ip,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
      now,
    });
    const sent = await sendCodeEmail(email, code);
    if (sent === "failed") return fail("unavailable", 503);
    return ok(null);
  } catch (error) {
    return failFromError(error, "auth/start");
  }
}
