// Passcode sign-in decision: pure, so it is tested without Next.js or the database.
import { describe, expect, it } from "vitest";
import { DEMO_USER_EMAIL, checkPasscodeAttempt } from "../auth/passcode";

describe("checkPasscodeAttempt", () => {
  it("reports not_configured when no passcode is set", () => {
    expect(checkPasscodeAttempt(null, "anything")).toBe("not_configured");
  });

  it("rejects a wrong passcode", () => {
    expect(checkPasscodeAttempt("judges-2026", "nope")).toBe("wrong_passcode");
  });

  it("accepts the right passcode, ignoring surrounding spaces", () => {
    expect(checkPasscodeAttempt("judges-2026", "judges-2026")).toBe("ok");
    expect(checkPasscodeAttempt("judges-2026", "  judges-2026 ")).toBe("ok");
  });

  it("uses a fixed, valid shared demo email", () => {
    expect(DEMO_USER_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});
