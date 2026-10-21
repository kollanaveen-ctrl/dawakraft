// POST /api/read-box: send up to 4 box photos to Claude and get the printed details back.
import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, readBox } from "@/lib/ai/claude";
import { MAX_AI_IMAGES } from "@/lib/constants";
import { demoAiAllowed } from "@/lib/config";
import { allow, claimAiUse } from "@/lib/rate-limit";
import { signedIn } from "@/lib/supabase/server";

export const maxDuration = 120;

const MAX_IMAGE_CHARS = 3_000_000; // ~2.2 MB per photo after base64
const READS_PER_10_MIN = 20;
const WINDOW_MS = 10 * 60_000;

const Body = z.object({
  images: z
    .array(
      z.object({
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        data: z.string().min(100).max(MAX_IMAGE_CHARS).regex(/^[A-Za-z0-9+/=]+$/),
      }),
    )
    .min(1)
    .max(MAX_AI_IMAGES),
});

const STATUS: Record<AiError["code"], number> = {
  not_configured: 503,
  rate_limited: 429,
  image_rejected: 422,
  invalid_json: 502,
  refused: 422,
  failed: 502,
};

export async function POST(request: Request) {
  const session = await signedIn();
  // Demo mode has no sign-in; it may use AI only when running on your own computer.
  if (!session && !demoAiAllowed()) return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  try {
    const withinLimit =
      allow(`read:${session?.user.id ?? "demo"}`, READS_PER_10_MIN, WINDOW_MS) &&
      (!session || (await claimAiUse(session.supabase, "read", READS_PER_10_MIN, WINDOW_MS)));
    if (!withinLimit) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  } catch (error) {
    console.error("[read-box] usage check failed", error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 503 });
  }

  try {
    const data = await readBox(parsed.data.images);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const e = error instanceof AiError ? error : new AiError("failed", String(error));
    console.error("[read-box]", e.code, e.message);
    return NextResponse.json({ ok: false, error: e.code }, { status: STATUS[e.code] });
  }
}
