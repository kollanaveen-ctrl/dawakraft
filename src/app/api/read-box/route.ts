// POST /api/read-box: send up to 4 labelled box photos to the AI provider and get the printed details back,
// with evidence (which photo, exact printed text) for every field.
import { NextResponse } from "next/server";
import { aiProvider } from "@/lib/ai";
import { aiFailure, checkAiAccess, readJsonBody } from "@/lib/ai/access";
import { AiError, BoxReadRequestSchema } from "@/lib/ai/types";

export const maxDuration = 120;

const READS_PER_10_MIN = 20;

const STATUS: Record<AiError["code"], number> = {
  not_configured: 503,
  rate_limited: 429,
  image_rejected: 422,
  invalid_json: 502,
  refused: 422,
  failed: 502,
  out_of_credits: 402,
};

export async function POST(request: Request) {
  const choice = aiProvider();
  if (!choice.ok) return aiFailure(choice.error, STATUS.not_configured);
  const { provider } = choice;

  const read = await readJsonBody(request);
  if (read.tooLarge) return aiFailure("too_large", 413);
  const parsed = BoxReadRequestSchema.safeParse(read.body);
  if (!parsed.success) return aiFailure("bad_request", 400);

  const denied = await checkAiAccess(provider, "read", READS_PER_10_MIN, "read-box");
  if (denied) return denied;

  try {
    const { data, meta } = await provider.readBox(parsed.data);
    return NextResponse.json({ ok: true, data, meta });
  } catch (error) {
    const e = error instanceof AiError ? error : new AiError("failed", String(error));
    console.error("[read-box]", provider.id, e.code, e.message);
    return aiFailure(e.code, STATUS[e.code]);
  }
}
