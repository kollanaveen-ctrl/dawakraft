// POST /api/auth/passcode { passcode }: trade the shared demo passcode (DEMO_PASSCODE) for a normal
// 30-day session cookie, signed in as the shared demo account. Off when DEMO_PASSCODE is not set.
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { requestIp } from "@/lib/ai/access";
import { demoPasscode } from "@/lib/ai/unlock";
import { fail, failFromError, ok, parseBody, sameOrigin } from "@/lib/api/respond";
import { DEMO_USER_EMAIL, checkPasscodeAttempt } from "@/lib/auth/passcode";
import { SESSION_COOKIE, SESSION_TTL_MS, hashSessionToken, newSessionToken, sessionCookieOptions } from "@/lib/auth/session-token";
import { d1 } from "@/lib/cloudflare/d1";
import { cloudflareReady } from "@/lib/config";
import { signInUser } from "@/lib/db/auth";
import { allow } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 2_000;
const ATTEMPTS_PER_WINDOW = 8;
const ATTEMPT_WINDOW_MS = 10 * 60_000;

const PasscodeRequestSchema = z.object({ passcode: z.string().min(1).max(100) });

export async function POST(request: Request) {
  const secret = demoPasscode();
  if (!cloudflareReady() || !secret) return fail("not_configured", 503);
  if (!sameOrigin(request)) return fail("forbidden", 403);
  if (!allow(`auth-passcode:${await requestIp()}`, ATTEMPTS_PER_WINDOW, ATTEMPT_WINDOW_MS)) return fail("rate_limited", 429);

  const body = await parseBody(request, PasscodeRequestSchema, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  if (checkPasscodeAttempt(secret, body.data.passcode) !== "ok") return fail("invalid_code", 401);

  try {
    const now = new Date();
    const token = newSessionToken();
    const user = await signInUser(d1(), {
      newUserId: randomUUID(),
      email: DEMO_USER_EMAIL,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
      now,
    });
    if (!user) return fail("failed", 500);

    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
    return ok({ userId: user.userId });
  } catch (error) {
    return failFromError(error, "auth/passcode");
  }
}
