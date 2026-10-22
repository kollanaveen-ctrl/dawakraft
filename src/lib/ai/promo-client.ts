// Browser-side calls to the promo AI routes. Types only from types.ts, so zod stays on the server.
// Like DetailsStep's /api/read-box call: POST JSON, read the { ok, ... } envelope, and hand back a
// typed result. Mapping codes to words (and "not_signed_in" to the demo passcode form) is the UI's job.
import type {
  AiErrorCode,
  AiMeta,
  PromoPhoto,
  PromoPhotoInput,
  WriteCopyData,
  WriteCopyInput,
} from "./types";

/**
 * Every error a promo call can end with: the provider codes, the access and request codes the routes
 * send ("not_signed_in" 401, "bad_request" 400, "too_large" 413), and "network" when no usable answer came back.
 */
export type PromoAiError = AiErrorCode | "not_signed_in" | "bad_request" | "too_large" | "network";

export type PromoAiFailure = { ok: false; error: PromoAiError; status: number };

/** meta.mock true means sample copy: say "Sample copy" in the UI. */
export type CopyResult = ({ ok: true; meta: AiMeta } & WriteCopyData) | PromoAiFailure;

/** `dataUrl` is ready for an <img src>; `photo` is the raw base64 for upload to media storage. */
export type PhotoResult = { ok: true; photo: PromoPhoto; dataUrl: string; meta: AiMeta } | PromoAiFailure;

const KNOWN_ERRORS: ReadonlySet<string> = new Set<PromoAiError>([
  "not_configured",
  "rate_limited",
  "image_rejected",
  "invalid_json",
  "refused",
  "failed",
  "out_of_credits",
  "photo_unavailable",
  "not_signed_in",
  "bad_request",
  "too_large",
  "network",
]);

/** The shape of WriteCopyResponse / PromoPhotoResponse in types.ts. */
type Envelope<T> = { ok: true; data: T; meta: AiMeta } | { ok: false; error: string };

async function post<T>(url: string, input: unknown, fetchFn: typeof fetch): Promise<{ ok: true; data: T; meta: AiMeta } | PromoAiFailure> {
  let res: Response;
  try {
    res = await fetchFn(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  } catch {
    return { ok: false, error: "network", status: 0 };
  }
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (res.ok && body?.ok === true && body.data && body.meta) return { ok: true, data: body.data, meta: body.meta };
  const code = body && body.ok === false && KNOWN_ERRORS.has(body.error) ? (body.error as PromoAiError) : res.ok ? "invalid_json" : "failed";
  return { ok: false, error: code, status: res.status };
}

/** POST /api/write-copy. Never throws. */
export async function requestCopy(input: WriteCopyInput, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<CopyResult> {
  const out = await post<WriteCopyData>("/api/write-copy", input, fetchFn);
  if (!out.ok) return out;
  return { ok: true, copy: out.data.copy, claims: out.data.claims, meta: out.meta };
}

/** POST /api/promo-photo. Never throws. "photo_unavailable" means: use a colour background. */
export async function requestPhoto(input: PromoPhotoInput, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<PhotoResult> {
  const out = await post<PromoPhoto>("/api/promo-photo", input, fetchFn);
  if (!out.ok) return out;
  return { ok: true, photo: out.data, dataUrl: `data:${out.data.mediaType};base64,${out.data.data}`, meta: out.meta };
}
