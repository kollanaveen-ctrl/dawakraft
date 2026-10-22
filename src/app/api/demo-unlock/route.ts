// POST /api/demo-unlock: trade the online demo passcode (DEMO_PASSCODE) for a signed 12-hour cookie
// that lets this browser use the paid AI without sign-in. Off when DEMO_PASSCODE is not set.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody, requestIp } from "@/lib/ai/access";
import { UNLOCK_COOKIE, UNLOCK_TTL_MS, demoPasscode, passcodeMatches, signUnlock } from "@/lib/ai/unlock";
import { allow } from "@/lib/rate-limit";

const ATTEMPTS_PER_WINDOW = 8;
const ATTEMPT_WINDOW_MS = 10 * 60_000;

const UnlockRequestSchema = z.object({ passcode: z.string().min(1).max(100) });

type UnlockError = "wrong_passcode" | "rate_limited" | "not_configured" | "bad_request";

function fail(error: UnlockError, status: number): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const secret = demoPasscode();
  if (!secret) return fail("not_configured", 503);

  const ip = await requestIp();
  if (!allow(`unlock-attempt:${ip}`, ATTEMPTS_PER_WINDOW, ATTEMPT_WINDOW_MS)) return fail("rate_limited", 429);

  const read = await readJsonBody(request);
  if (read.tooLarge) return fail("bad_request", 400);
  const parsed = UnlockRequestSchema.safeParse(read.body);
  if (!parsed.success) return fail("bad_request", 400);

  if (!passcodeMatches(secret, parsed.data.passcode)) return fail("wrong_passcode", 401);

  const expiryMs = Date.now() + UNLOCK_TTL_MS;
  (await cookies()).set(UNLOCK_COOKIE, signUnlock(secret, expiryMs), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: UNLOCK_TTL_MS / 1000,
  });
  return NextResponse.json({ ok: true });
}
