// POST /api/promo-photo: an AI lifestyle photo for the circular's right half (Gemini only).
// Other providers answer photo_unavailable (HTTP 501) before any access check or cost, and the UI
// falls back to a colour background.
import { NextResponse } from "next/server";
import { aiProvider } from "@/lib/ai";
import { aiFailure, aiStatus, checkAiAccess, readJsonBody } from "@/lib/ai/access";
import { AiError, PromoPhotoRequestSchema } from "@/lib/ai/types";

export const maxDuration = 120;

const PHOTOS_PER_10_MIN = 6;
/** A few short text fields: far below the photo-reading routes' limit. */
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: Request) {
  const choice = aiProvider();
  if (!choice.ok) return aiFailure(choice.error, aiStatus(choice.error));
  const { provider } = choice;
  if (!provider.makePhoto) return aiFailure("photo_unavailable", aiStatus("photo_unavailable"));

  const read = await readJsonBody(request, MAX_BODY_BYTES);
  if (read.tooLarge) return aiFailure("too_large", 413);
  const parsed = PromoPhotoRequestSchema.safeParse(read.body);
  if (!parsed.success) return aiFailure("bad_request", 400);

  const denied = await checkAiAccess(provider, "photo", PHOTOS_PER_10_MIN, "promo-photo");
  if (denied) return denied;

  try {
    const { data, meta } = await provider.makePhoto(parsed.data);
    return NextResponse.json({ ok: true, data, meta });
  } catch (error) {
    const e = error instanceof AiError ? error : new AiError("failed", String(error));
    // Code and provider message only: never the prompt.
    console.error("[promo-photo]", provider.id, e.code, e.message);
    return aiFailure(e.code, aiStatus(e.code));
  }
}
