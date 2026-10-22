// Server-only: the online demo passcode. A correct passcode earns a signed cookie that lets an
// anonymous visitor use the paid AI for 12 hours, until real sign-in exists.
// Everything here is pure (no Next.js runtime), so it is unit-tested directly.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isRealValue } from "../config";

export const UNLOCK_COOKIE = "dk_ai_unlock";
export const UNLOCK_LABEL = "dawakraft-ai-unlock-v1";
export const UNLOCK_TTL_MS = 12 * 60 * 60_000;

/** Small allowance for clock differences between server instances. */
const CLOCK_SKEW_MS = 60_000;
const COOKIE_PATTERN = /^(\d{1,16})\.([0-9a-f]{64})$/;
const MAX_COOKIE_CHARS = 100;

/** The passcode from DEMO_PASSCODE, or null when the feature is off. Never log the result. */
export function demoPasscode(env: string | undefined = process.env.DEMO_PASSCODE): string | null {
  return isRealValue(env) ? env.trim() : null;
}

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** Timing-safe: both sides are hashed to the same length before comparing. */
export function passcodeMatches(secret: string, attempt: string): boolean {
  return timingSafeEqual(sha256(secret), sha256(attempt.trim()));
}

function mac(secret: string, expiryMs: number): Buffer {
  return createHmac("sha256", secret).update(`${UNLOCK_LABEL}.${expiryMs}`, "utf8").digest();
}

/** Cookie value: "<expiryMs>.<hexHmac>". Changing the secret invalidates every earlier value. */
export function signUnlock(secret: string, expiryMs: number): string {
  return `${expiryMs}.${mac(secret, expiryMs).toString("hex")}`;
}

/** True only for a well-formed, unexpired value signed with this secret. */
export function verifyUnlock(secret: string, cookieValue: string | undefined | null, nowMs: number): boolean {
  if (!cookieValue || cookieValue.length > MAX_COOKIE_CHARS) return false;
  const match = COOKIE_PATTERN.exec(cookieValue);
  if (!match) return false;
  const expiryMs = Number(match[1]);
  if (!Number.isSafeInteger(expiryMs) || expiryMs <= nowMs) return false;
  // A value can only be made with the secret, but refuse lifetimes we would never issue.
  if (expiryMs > nowMs + UNLOCK_TTL_MS + CLOCK_SKEW_MS) return false;
  return timingSafeEqual(Buffer.from(match[2], "hex"), mac(secret, expiryMs));
}

/** The caller's IP for in-memory limits: first x-forwarded-for entry, else "unknown". */
export function clientIp(forwardedFor: string | null | undefined): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first ? first.slice(0, 64) : "unknown";
}

export type AiAccessMode = "user" | "demo_local" | "unlocked" | "denied";

/** Who may use a paid provider: a signed-in user, demo mode on your own computer, or a passcode unlock. */
export function canUseAi({ session, demoLocal, cookieValid }: { session: boolean; demoLocal: boolean; cookieValid: boolean }): AiAccessMode {
  if (session) return "user";
  if (demoLocal) return "demo_local";
  if (cookieValid) return "unlocked";
  return "denied";
}
