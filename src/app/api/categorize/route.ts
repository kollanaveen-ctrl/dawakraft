// POST /api/categorize: sort imported products into categories with the AI provider.
import { NextResponse } from "next/server";
import { aiProvider } from "@/lib/ai";
import { aiFailure, checkAiAccess, readJsonBody } from "@/lib/ai/access";
import { AiError, CategorizeRequestSchema } from "@/lib/ai/types";

export const maxDuration = 120;

const SORTS_PER_10_MIN = 10;

function statusOf(code: AiError["code"]): number {
  if (code === "rate_limited") return 429;
  if (code === "out_of_credits") return 402;
  if (code === "not_configured") return 503;
  return 502;
}

export async function POST(request: Request) {
  const choice = aiProvider();
  if (!choice.ok) return aiFailure(choice.error, statusOf(choice.error));
  const { provider } = choice;

  const read = await readJsonBody(request);
  if (read.tooLarge) return aiFailure("too_large", 413);
  const parsed = CategorizeRequestSchema.safeParse(read.body);
  if (!parsed.success) return aiFailure("bad_request", 400);

  const denied = await checkAiAccess(provider, "sort", SORTS_PER_10_MIN, "categorize");
  if (denied) return denied;

  try {
    const { data, meta } = await provider.categorize(parsed.data.items);
    return NextResponse.json({ ok: true, data, meta });
  } catch (error) {
    const e = error instanceof AiError ? error : new AiError("failed", String(error));
    console.error("[categorize]", provider.id, e.code, e.message);
    return aiFailure(e.code, statusOf(e.code));
  }
}
