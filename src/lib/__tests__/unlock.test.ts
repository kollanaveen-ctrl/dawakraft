// The online demo passcode: cookie signing and checking, passcode comparison and the access decision.
// Pure functions only; nothing here starts Next.js or calls an AI API.
import { describe, expect, it } from "vitest";
import { UNLOCK_TTL_MS, canUseAi, clientIp, demoPasscode, passcodeMatches, signUnlock, verifyUnlock } from "../ai/unlock";

const SECRET = "judges-2026-tablet";
const NOW = 1_800_000_000_000;
const EXPIRY = NOW + UNLOCK_TTL_MS;

describe("signUnlock / verifyUnlock", () => {
  it("accepts a fresh cookie signed with the same secret", () => {
    const value = signUnlock(SECRET, EXPIRY);
    expect(value).toMatch(/^\d+\.[0-9a-f]{64}$/);
    expect(verifyUnlock(SECRET, value, NOW)).toBe(true);
    expect(verifyUnlock(SECRET, value, EXPIRY - 1)).toBe(true);
  });

  it("rejects an expired cookie", () => {
    const value = signUnlock(SECRET, EXPIRY);
    expect(verifyUnlock(SECRET, value, EXPIRY)).toBe(false);
    expect(verifyUnlock(SECRET, value, EXPIRY + 60_000)).toBe(false);
  });

  it("rejects a cookie signed with another secret (passcode changed)", () => {
    expect(verifyUnlock(SECRET, signUnlock("old-passcode", EXPIRY), NOW)).toBe(false);
  });

  it("rejects a tampered expiry or signature", () => {
    const value = signUnlock(SECRET, EXPIRY);
    const [expiry, sig] = value.split(".");
    expect(verifyUnlock(SECRET, `${Number(expiry) + 1000}.${sig}`, NOW)).toBe(false);
    const flipped = (sig[0] === "a" ? "b" : "a") + sig.slice(1);
    expect(verifyUnlock(SECRET, `${expiry}.${flipped}`, NOW)).toBe(false);
  });

  it("rejects a signed lifetime longer than we ever issue", () => {
    const far = NOW + UNLOCK_TTL_MS * 10;
    expect(verifyUnlock(SECRET, signUnlock(SECRET, far), NOW)).toBe(false);
  });

  it.each([undefined, null, "", "abc", "123", "123.", ".abcd", "12.zz", `x${signUnlock(SECRET, EXPIRY)}`, `${EXPIRY}.${"A".repeat(64)}`, `${EXPIRY}.${"a".repeat(63)}`, "9".repeat(200)])(
    "rejects malformed value %s",
    (value) => {
      expect(verifyUnlock(SECRET, value, NOW)).toBe(false);
    },
  );
});

describe("passcodeMatches", () => {
  it("matches the exact passcode, ignoring surrounding spaces", () => {
    expect(passcodeMatches(SECRET, SECRET)).toBe(true);
    expect(passcodeMatches(SECRET, `  ${SECRET} `)).toBe(true);
  });

  it("refuses anything else, including different lengths", () => {
    expect(passcodeMatches(SECRET, "judges-2026-tablets")).toBe(false);
    expect(passcodeMatches(SECRET, "JUDGES-2026-TABLET")).toBe(false);
    expect(passcodeMatches(SECRET, "")).toBe(false);
    expect(passcodeMatches(SECRET, "x".repeat(100))).toBe(false);
  });
});

describe("demoPasscode", () => {
  it("is off when unset, empty or a placeholder", () => {
    expect(demoPasscode(undefined)).toBeNull();
    expect(demoPasscode("")).toBeNull();
    expect(demoPasscode("   ")).toBeNull();
    expect(demoPasscode("your-demo-passcode")).toBeNull();
  });

  it("returns a real value, trimmed", () => {
    expect(demoPasscode(` ${SECRET} `)).toBe(SECRET);
  });
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for entry", () => {
    expect(clientIp("203.0.113.7, 10.0.0.1")).toBe("203.0.113.7");
  });

  it("falls back to unknown", () => {
    expect(clientIp(null)).toBe("unknown");
    expect(clientIp(undefined)).toBe("unknown");
    expect(clientIp(" , ")).toBe("unknown");
  });
});

describe("canUseAi", () => {
  it("prefers a signed-in user", () => {
    expect(canUseAi({ session: true, demoLocal: false, cookieValid: false })).toBe("user");
    expect(canUseAi({ session: true, demoLocal: true, cookieValid: true })).toBe("user");
  });

  it("allows demo mode on your own computer", () => {
    expect(canUseAi({ session: false, demoLocal: true, cookieValid: false })).toBe("demo_local");
  });

  it("allows an anonymous visitor with a valid passcode cookie", () => {
    expect(canUseAi({ session: false, demoLocal: false, cookieValid: true })).toBe("unlocked");
  });

  it("denies everyone else", () => {
    expect(canUseAi({ session: false, demoLocal: false, cookieValid: false })).toBe("denied");
  });
});
