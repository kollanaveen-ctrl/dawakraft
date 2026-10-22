import { afterEach, describe, expect, it, vi } from "vitest";
import { failFromError } from "../api/respond";
import { D1Error } from "../cloudflare/d1";

afterEach(() => vi.restoreAllMocks());

describe("API error handling during prerendering", () => {
  it("lets Next.js handle cookie prerender signals without logging an application error", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const signal = Object.assign(new Error("cookies() rejects when the prerender is complete"), {
      digest: "HANGING_PROMISE_REJECTION",
    });
    expect(() => failFromError(signal, "auth/me")).toThrow(signal);
    expect(log).not.toHaveBeenCalled();
  });

  it("preserves database-unavailable responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = failFromError(new D1Error("unavailable", "Database unavailable"), "auth/me");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "unavailable" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("preserves unexpected application-error responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = failFromError(new Error("Application failure"), "auth/me");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "failed" });
  });
});
