// Server-only: who may call a paid AI provider, and how often. Shared by the AI routes.
import { NextResponse } from "next/server";
import { demoAiAllowed } from "../config";
import { allow, claimAiUse, type AiKind } from "../rate-limit";
import { signedIn } from "../supabase/server";
import type { AiErrorCode, AiProvider } from "./types";

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

/**
 * Null when the call may go ahead, otherwise the error response to send.
 * Free providers (the mock) need no sign-in. Paid ones need a signed-in user, or demo mode on
 * your own computer, and stay within the per-user limit.
 */
export async function checkAiAccess(provider: AiProvider, kind: AiKind, limit: number, tag: string): Promise<NextResponse | null> {
  if (!provider.paid) return null;
  const session = await signedIn();
  // Demo mode has no sign-in; it may use AI only when running on your own computer.
  if (!session && !demoAiAllowed()) return aiFailure("not_signed_in", 401);
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
