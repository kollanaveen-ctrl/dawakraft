// POST /api/auth/verify { email, code }: check the code, then sign in (creating the account on
// first use) with a 30-day httpOnly session cookie. Any failure answers the same "invalid_code".
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { requestIp } from "@/lib/ai/access";
import { fail, failFromError, ok, parseBody, sameOrigin } from "@/lib/api/respond";
import { CODE_WINDOW_MS, VerifyRequestSchema, checkCode } from "@/lib/auth/codes";
import { SESSION_COOKIE, SESSION_TTL_MS, hashSessionToken, newSessionToken, sessionCookieOptions } from "@/lib/auth/session-token";
import { d1 } from "@/lib/cloudflare/d1";
import { authSecret, cloudflareReady } from "@/lib/config";
import { countWrongAttempt, latestCode, signInUser, consumeCode } from "@/lib/db/auth";
import { allow } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 2_000;
const CHECKS_PER_IP = 30;

export async function POST(request: Request) {
  const secret = authSecret();
  if (!cloudflareReady() || !secret) return fail("not_configured", 503);
  if (!sameOrigin(request)) return fail("forbidden", 403);
  if (!allow(`auth-verify:${await requestIp()}`, CHECKS_PER_IP, CODE_WINDOW_MS)) return fail("rate_limited", 429);

  const body = await parseBody(request, VerifyRequestSchema, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const { email, code } = body.data;

  try {
    const db = d1();
    const now = new Date();
    const row = await latestCode(db, email, now.toISOString());
    if (!row) return fail("invalid_code", 400);

    const result = checkCode(secret, email, code, row, now.getTime());
    if (result === "wrong") await countWrongAttempt(db, row.id);
    if (result !== "ok") return fail("invalid_code", 400);
    if (!(await consumeCode(db, row.id, now.toISOString()))) return fail("invalid_code", 400);

    const token = newSessionToken();
    const user = await signInUser(db, {
      newUserId: randomUUID(),
      email,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
      now,
    });
    if (!user) return fail("failed", 500);

    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
    return ok({ userId: user.userId, email: user.email });
  } catch (error) {
    return failFromError(error, "auth/verify");
  }
}
