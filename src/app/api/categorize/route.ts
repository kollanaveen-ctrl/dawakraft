// POST /api/categorize: sort imported products into categories with Claude.
import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, categorize } from "@/lib/ai/claude";
import { AI_CATEGORY_BATCH } from "@/lib/constants";
import { demoAiAllowed } from "@/lib/config";
import { allow, claimAiUse } from "@/lib/rate-limit";
import { signedIn } from "@/lib/supabase/server";

export const maxDuration = 120;

const SORTS_PER_10_MIN = 10;
const WINDOW_MS = 10 * 60_000;

const Body = z.object({
  items: z
    .array(
      z.object({
        i: z.number().int().min(0).max(10_000),
        name: z.string().min(1).max(200),
        composition: z.string().max(500),
      }),
    )
    .min(1)
    .max(AI_CATEGORY_BATCH),
});

export async function POST(request: Request) {
  const session = await signedIn();
  // Demo mode has no sign-in; it may use AI only when running on your own computer.
  if (!session && !demoAiAllowed()) return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  try {
    const withinLimit =
      allow(`sort:${session?.user.id ?? "demo"}`, SORTS_PER_10_MIN, WINDOW_MS) &&
      (!session || (await claimAiUse(session.supabase, "sort", SORTS_PER_10_MIN, WINDOW_MS)));
    if (!withinLimit) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  } catch (error) {
    console.error("[categorize] usage check failed", error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 503 });
  }

  try {
    const data = await categorize(parsed.data.items);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const e = error instanceof AiError ? error : new AiError("failed", String(error));
    console.error("[categorize]", e.code, e.message);
    const status = e.code === "rate_limited" ? 429 : e.code === "not_configured" ? 503 : 502;
    return NextResponse.json({ ok: false, error: e.code }, { status });
  }
}
