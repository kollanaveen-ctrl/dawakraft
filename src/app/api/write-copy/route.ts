// POST /api/write-copy: trade-only promotional copy for the circular, written by the AI provider from
// the product's own composition, form and uses. The answer carries the claim checks of the copy.
import { NextResponse } from "next/server";
import { aiProvider } from "@/lib/ai";
import { aiFailure, aiStatus, checkAiAccess, readJsonBody } from "@/lib/ai/access";
import { copyClaims } from "@/lib/ai/promo-copy";
import { AiError, WriteCopyRequestSchema, type WriteCopyData } from "@/lib/ai/types";

export const maxDuration = 120;

const COPIES_PER_10_MIN = 20;
/** A few short text fields: far below the photo-reading routes' limit. */
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: Request) {
  const choice = aiProvider();
  if (!choice.ok) return aiFailure(choice.error, aiStatus(choice.error));
  const { provider } = choice;

  const read = await readJsonBody(request, MAX_BODY_BYTES);
  if (read.tooLarge) return aiFailure("too_large", 413);
  const parsed = WriteCopyRequestSchema.safeParse(read.body);
  if (!parsed.success) return aiFailure("bad_request", 400);

  const denied = await checkAiAccess(provider, "copy", COPIES_PER_10_MIN, "write-copy");
  if (denied) return denied;

  try {
    const { data: copy, meta } = await provider.writeCopy(parsed.data);
    const data: WriteCopyData = { copy, claims: copyClaims(copy) };
    return NextResponse.json({ ok: true, data, meta });
  } catch (error) {
    const e = error instanceof AiError ? error : new AiError("failed", String(error));
    // Code and provider message only: never the prompt or the product text.
    console.error("[write-copy]", provider.id, e.code, e.message);
    return aiFailure(e.code, aiStatus(e.code));
  }
}
