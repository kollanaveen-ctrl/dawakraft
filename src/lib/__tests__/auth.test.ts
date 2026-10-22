import { describe, expect, it, vi } from "vitest";
import {
  CODE_TTL_MS,
  MAX_CODE_ATTEMPTS,
  StartRequestSchema,
  VerifyRequestSchema,
  checkCode,
  generateCode,
  hashCode,
  hashesMatch,
  normaliseEmail,
} from "../auth/codes";
import { codeEmail, sendCodeEmail } from "../auth/email";
import { SESSION_TTL_MS, hashSessionToken, isWellFormedToken, newSessionToken, sessionCookieOptions } from "../auth/session-token";

const SECRET = "s".repeat(40);
const NOW = Date.parse("2026-10-22T10:00:00.000Z");

const row = (over: Partial<{ code_hash: string; attempts: number; expires_at: string; used_at: string | null }> = {}) => ({
  code_hash: hashCode(SECRET, "ravi@example.com", "123456"),
  attempts: 0,
  expires_at: new Date(NOW + CODE_TTL_MS).toISOString(),
  used_at: null,
  ...over,
});

describe("sign-in codes", () => {
  it("are six digits, leading zeros kept", () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it("hash with HMAC-SHA256 bound to the normalised email", () => {
    const h = hashCode(SECRET, "Ravi@Example.com ", "123456");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashCode(SECRET, "ravi@example.com", "123456"));
    expect(h).not.toBe(hashCode(SECRET, "other@example.com", "123456"));
    expect(h).not.toBe(hashCode("t".repeat(40), "ravi@example.com", "123456"));
    expect(h).not.toContain("123456");
  });

  it("accept the right code before expiry", () => {
    expect(checkCode(SECRET, "ravi@example.com", "123456", row(), NOW)).toBe("ok");
  });

  it("reject a wrong code, an expired code, a used code and a locked code", () => {
    expect(checkCode(SECRET, "ravi@example.com", "654321", row(), NOW)).toBe("wrong");
    expect(checkCode(SECRET, "ravi@example.com", "123456", row(), NOW + CODE_TTL_MS)).toBe("expired");
    expect(checkCode(SECRET, "ravi@example.com", "123456", row({ used_at: new Date(NOW).toISOString() }), NOW)).toBe("used");
    expect(checkCode(SECRET, "ravi@example.com", "123456", row({ attempts: MAX_CODE_ATTEMPTS }), NOW)).toBe("locked");
    expect(checkCode(SECRET, "ravi@example.com", "123456", row({ attempts: MAX_CODE_ATTEMPTS - 1 }), NOW)).toBe("ok");
  });

  it("reject the code for a different address", () => {
    expect(checkCode(SECRET, "someone@example.com", "123456", row(), NOW)).toBe("wrong");
  });

  it("compare hashes timing-safely and refuse malformed input", () => {
    const h = hashCode(SECRET, "a@b.co", "000000");
    expect(hashesMatch(h, h)).toBe(true);
    expect(hashesMatch(h, h.replace(/.$/, (c) => (c === "0" ? "1" : "0")))).toBe(false);
    expect(hashesMatch(h, "abc")).toBe(false);
    expect(hashesMatch("zz".repeat(32), h)).toBe(false);
  });

  it("validate requests with zod", () => {
    expect(StartRequestSchema.parse({ email: " Ravi@Example.COM " })).toEqual({ email: "ravi@example.com" });
    expect(StartRequestSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(StartRequestSchema.safeParse({ email: `${"a".repeat(250)}@b.co` }).success).toBe(false);
    expect(VerifyRequestSchema.safeParse({ email: "a@b.co", code: "12345" }).success).toBe(false);
    expect(VerifyRequestSchema.safeParse({ email: "a@b.co", code: "12a456" }).success).toBe(false);
    expect(VerifyRequestSchema.parse({ email: "a@b.co", code: " 012345 " })).toEqual({ email: "a@b.co", code: "012345" });
  });

  it("normalise email", () => {
    expect(normaliseEmail("  A@B.Co ")).toBe("a@b.co");
  });
});

describe("session tokens", () => {
  it("are 32 random bytes in base64url", () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
    expect(a).not.toBe(b);
    expect(isWellFormedToken(a)).toBe(true);
  });

  it("are stored only as their SHA-256", () => {
    const t = newSessionToken();
    const h = hashSessionToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashSessionToken(t));
    expect(h).not.toContain(t);
  });

  it("refuse junk cookies before any lookup", () => {
    expect(isWellFormedToken(undefined)).toBe(false);
    expect(isWellFormedToken("")).toBe(false);
    expect(isWellFormedToken("short")).toBe(false);
    expect(isWellFormedToken(`${"a".repeat(42)}=`)).toBe(false);
  });

  it("use an httpOnly, lax, 30-day cookie on /", () => {
    expect(sessionCookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_TTL_MS / 1000 });
    expect(sessionCookieOptions(0).maxAge).toBe(0);
  });
});

describe("code email", () => {
  it("posts to Resend with the key, sender and recipient", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "e1" }), { status: 200 }));
    const out = await sendCodeEmail("ravi@example.com", "123456", { RESEND_API_KEY: "re_live_key", AUTH_EMAIL_FROM: "Dawakraft <hi@dawakraft.in>" }, fetchMock as unknown as typeof fetch);
    expect(out).toBe("sent");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_live_key");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ from: "Dawakraft <hi@dawakraft.in>", to: ["ravi@example.com"] });
    expect(body.subject).toContain("123456");
    expect(body.text).toContain("123456");
  });

  it("reports a refused send as failed", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 422 }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await sendCodeEmail("a@b.co", "111111", { RESEND_API_KEY: "re_key" }, fetchMock as unknown as typeof fetch)).toBe("failed");
    expect(spy.mock.calls.flat().join(" ")).not.toContain("a@b.co");
    spy.mockRestore();
  });

  it("prints the code only in development when there is no key", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetchMock = vi.fn();
    expect(await sendCodeEmail("a@b.co", "222222", { NODE_ENV: "development" }, fetchMock as unknown as typeof fetch)).toBe("logged");
    expect(spy.mock.calls.flat().join(" ")).toContain("222222");
    spy.mockClear();
    expect(await sendCodeEmail("a@b.co", "333333", { NODE_ENV: "production", RESEND_API_KEY: "your-key" }, fetchMock as unknown as typeof fetch)).toBe("failed");
    expect(spy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("builds a plain message with the code", () => {
    expect(codeEmail("045678").subject).toBe("045678 is your Dawakraft sign-in code");
  });
});
