// Server-only: the shared shape of the data, media and auth routes.
// Every answer is { ok: true, data } or { ok: false, error } with a short error code;
// the browser turns codes into plain English (friendlyError in src/lib/data/repo.ts).
import { NextResponse } from "next/server";
import type { z } from "zod";
import { readJsonBody } from "../ai/access";
import { getSession, type SessionUser } from "../auth/server";
import { D1Error } from "../cloudflare/d1";
import { cloudflareReady } from "../config";

export type ApiErrorCode =
  | "not_configured"
  | "storage_not_configured"
  | "not_signed_in"
  | "bad_request"
  | "too_large"
  | "invalid"
  | "not_found"
  | "forbidden"
  | "rate_limited"
  | "invalid_code"
  | "unavailable"
  | "failed";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(error: ApiErrorCode, status: number): NextResponse {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Writes from another site are refused (the session cookie is SameSite=Lax as well). */
export function sameOrigin(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  } catch {
    return false;
  }
}

/** Parse a JSON body with a size cap and a zod schema. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes: number,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: NextResponse }> {
  const read = await readJsonBody(request, maxBytes);
  if (read.tooLarge) return { ok: false, response: fail("too_large", 413) };
  const parsed = schema.safeParse(read.body);
  if (!parsed.success) return { ok: false, response: fail("bad_request", 400) };
  return { ok: true, data: parsed.data };
}

/** Map a thrown error to a response; detail goes to the server log only. */
export function failFromError(error: unknown, tag: string): NextResponse {
  if (error instanceof D1Error) {
    if (error.kind === "constraint") return fail("invalid", 400);
    console.error(`[${tag}] D1 ${error.kind}: ${error.message}`);
    return fail("unavailable", 503);
  }
  console.error(`[${tag}] failed`, error instanceof Error ? error.message : error);
  return fail("failed", 500);
}

type Handler<C> = (request: Request, user: SessionUser, context: C) => Promise<NextResponse>;

/**
 * Wrap a route that needs a signed-in user. The user always comes from the session cookie,
 * never from the request, and every query below is scoped to that user's id.
 */
export function withUser<C = unknown>(tag: string, handler: Handler<C>) {
  return async (request: Request, context: C): Promise<NextResponse> => {
    if (!cloudflareReady()) return fail("not_configured", 503);
    if (!sameOrigin(request)) return fail("forbidden", 403);
    try {
      const user = await getSession();
      if (!user) return fail("not_signed_in", 401);
      return await handler(request, user, context);
    } catch (error) {
      return failFromError(error, tag);
    }
  };
}
