// Server-only: one-time sign-in codes. Pure (no Next.js, no database), so it is unit-tested directly.
// Only a keyed hash of each code is stored; a leaked database row can't be turned back into a code.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 10 * 60_000;
/** Wrong guesses allowed on one code before it stops working. */
export const MAX_CODE_ATTEMPTS = 5;
/** New codes per email address, and per IP, in CODE_WINDOW_MS. */
export const CODES_PER_EMAIL = 3;
export const CODES_PER_IP = 10;
export const CODE_WINDOW_MS = 10 * 60_000;

/** Trimmed and lower-cased, so "Ravi@Example.com " and "ravi@example.com" are one account. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const EmailSchema = z.string().trim().max(254).pipe(z.email()).transform(normaliseEmail);
export const CodeSchema = z.string().trim().regex(/^\d{6}$/);

export const StartRequestSchema = z.object({ email: EmailSchema });
export const VerifyRequestSchema = z.object({ email: EmailSchema, code: CodeSchema });

/** A uniformly random 6-digit code, leading zeros kept. */
export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/** HMAC-SHA256(secret, email + ":" + code) as hex. Ties the code to the address it was sent to. */
export function hashCode(secret: string, email: string, code: string): string {
  return createHmac("sha256", secret).update(`${normaliseEmail(email)}:${code}`, "utf8").digest("hex");
}

/** Timing-safe comparison of two hex hashes; false for anything malformed. */
export function hashesMatch(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export type StoredCode = { code_hash: string; attempts: number; expires_at: string; used_at: string | null };

export type CodeCheck = "ok" | "wrong" | "expired" | "used" | "locked";

/** Is this code right for the stored row? Checks used, expiry and attempts before comparing. */
export function checkCode(secret: string, email: string, code: string, row: StoredCode, nowMs: number): CodeCheck {
  if (row.used_at) return "used";
  if (Date.parse(row.expires_at) <= nowMs) return "expired";
  if (row.attempts >= MAX_CODE_ATTEMPTS) return "locked";
  return hashesMatch(hashCode(secret, email, code), row.code_hash) ? "ok" : "wrong";
}
