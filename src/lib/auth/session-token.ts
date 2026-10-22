// Server-only: session tokens. Pure, so it is unit-tested directly.
// The cookie holds 32 random bytes; the database keeps only their SHA-256, so a leaked
// sessions table can't be used to sign in.
import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "dk_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** A new random token (base64url, 43 characters). */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Only well-formed tokens are looked up, so junk cookies never reach the database. */
export function isWellFormedToken(v: string | undefined | null): v is string {
  return typeof v === "string" && TOKEN_PATTERN.test(v);
}

/** Cookie settings: not readable by scripts, HTTPS-only in production, sent on normal navigation. */
export function sessionCookieOptions(maxAgeSeconds = SESSION_TTL_MS / 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
