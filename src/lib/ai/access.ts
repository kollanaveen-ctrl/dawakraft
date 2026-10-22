// Server-only: who may call a paid AI provider, and how often. Shared by the AI routes.
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { demoAiAllowed } from "../config";
import { allow, claimAiUse, type AiKind } from "../rate-limit";
import { signedIn } from "../supabase/server";
import type { AiErrorCode, AiProvider } from "./types";
import { UNLOCK_COOKIE, canUseAi, clientIp, demoPasscode, verifyUnlock } from "./unlock";

export const AI_WINDOW_MS = 10 * 60_000;

/** The `{ ok: false, error }` envelope with an HTTP status. */
export function aiFailure(error: AiErrorCode | "not_signed_in" | "bad_request" | "too_large", status: number): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

/** Four photos at the schema's size cap, plus JSON overhead. Bigger bodies are refused before parsing. */
const MAX_BODY_BYTES = 13 * 1024 * 1024;

/** Read the JSON body, refusing oversized requests up front. `body` is null when it isn't valid JSON. */
export async function readJsonBody(request: Request): Promise<{ tooLarge: true } | { tooLarge: false; body: unknown }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return { tooLarge: true };
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) return { tooLarge: true };
  try {
    return { tooLarge: false, body: JSON.parse(text) };
  } catch {
    return { tooLarge: false, body: null };
  }
}

/** Tighter limits for anonymous visitors who unlocked the online demo with the passcode, per IP. */
const UNLOCKED_LIMITS: Record<AiKind, number> = { read: 15, sort: 6 };

/** The caller's IP from x-forwarded-for (set by Vercel), for in-memory limits. */
export async function requestIp(): Promise<string> {
  return clientIp((await headers()).get("x-forwarded-for"));
}

/** Does this request carry a valid demo-passcode cookie? False when DEMO_PASSCODE is not set. */
async function hasValidUnlock(): Promise<boolean> {
  const secret = demoPasscode();
  if (!secret) return false;
  return verifyUnlock(secret, (await cookies()).get(UNLOCK_COOKIE)?.value, Date.now());
}

/**
 * Null when the call may go ahead, otherwise the error response to send.
 * Free providers (the mock) need no sign-in. Paid ones need a signed-in user, demo mode on
 * your own computer, or the online demo passcode cookie, and stay within the limits.
 */
export async function checkAiAccess(provider: AiProvider, kind: AiKind, limit: number, tag: string): Promise<NextResponse | null> {
  if (!provider.paid) return null;
  const session = await signedIn();
  const demoLocal = !session && demoAiAllowed();
  const cookieValid = !session && !demoLocal && (await hasValidUnlock());
  const mode = canUseAi({ session: Boolean(session), demoLocal, cookieValid });
  if (mode === "denied") return aiFailure("not_signed_in", 401);
  if (mode === "unlocked") {
    const ip = await requestIp();
    return allow(`unlock:${kind}:${ip}`, UNLOCKED_LIMITS[kind], AI_WINDOW_MS) ? null : aiFailure("rate_limited", 429);
  }
  try {
    const withinLimit =
      allow(`${kind}:${session?.user.id ?? "demo"}`, limit, AI_WINDOW_MS) &&
      (!session || (await claimAiUse(session.supabase, kind, limit, AI_WINDOW_MS)));
    return withinLimit ? null : aiFailure("rate_limited", 429);
  } catch (error) {
    console.error(`[${tag}] usage check failed`, error);
    return aiFailure("failed", 503);
  }
}
