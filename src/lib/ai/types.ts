// The provider-independent AI contract: request and response shapes shared by the API routes,
// every provider (Claude, the mock, and any future one) and the tests.
// The browser imports only the types from here (`import type`), so zod stays on the server.
import { z } from "zod";
import { AI_CATEGORY_BATCH, CATEGORIES, FORMS, IMAGE_ROLES, MAX_AI_IMAGES, SCHEDULES } from "../constants";

// ---------- Errors ----------

/**
 * `photo_unavailable`: the active provider cannot make pictures (only Gemini can); the UI falls
 * back to a colour background. Every other code means the same for every route.
 */
export type AiErrorCode =
  | "not_configured"
  | "rate_limited"
  | "image_rejected"
  | "invalid_json"
  | "refused"
  | "failed"
  | "out_of_credits"
  | "photo_unavailable";

export class AiError extends Error {
  constructor(public readonly code: AiErrorCode, message: string) {
    super(message);
  }
}

// ---------- Requests ----------

const MAX_IMAGE_CHARS = 3_000_000; // ~2.2 MB per photo after base64

export const ImageRoleSchema = z.enum(IMAGE_ROLES);

export const BoxImageSchema = z.object({
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().min(100).max(MAX_IMAGE_CHARS).regex(/^[A-Za-z0-9+/=]+$/),
  role: ImageRoleSchema,
});
export type BoxImage = z.infer<typeof BoxImageSchema>;

export const BoxReadRequestSchema = z.object({
  images: z.array(BoxImageSchema).min(1).max(MAX_AI_IMAGES),
});
export type BoxReadInput = z.infer<typeof BoxReadRequestSchema>;

/** Product retouching uses the actual photos, not a text-only invented carton. */
export const ProductShotRequestSchema = z.object({
  images: z.array(BoxImageSchema).min(1).max(MAX_AI_IMAGES),
  name: z.string().trim().min(1).max(200),
  composition: z.string().max(500),
  packSize: z.string().max(120),
  form: z.string().max(60),
});
export type ProductShotInput = z.infer<typeof ProductShotRequestSchema>;

export const CategoryRequestSchema = z.object({
  i: z.number().int().min(0).max(10_000),
  name: z.string().min(1).max(200),
  composition: z.string().max(500),
});
export type CategoryRequest = z.infer<typeof CategoryRequestSchema>;

export const CategorizeRequestSchema = z.object({
  items: z.array(CategoryRequestSchema).min(1).max(AI_CATEGORY_BATCH),
});

/** POST /api/write-copy: the product facts the copywriter may use (and nothing else). */
export const WriteCopyRequestSchema = z.object({
  inferUses: z.boolean().optional(),
  format: z.enum(["story", "landscape"]).optional(),
  name: z.string().trim().min(1).max(120),
  composition: z.string().max(500),
  form: z.string().max(40),
  uses: z.string().max(200),
  category: z.string().max(60),
  schedule: z.string().max(10),
});
export type WriteCopyInput = z.infer<typeof WriteCopyRequestSchema>;

/** POST /api/promo-photo: only picks the scene; none of this text is drawn in the picture. */
export const PromoPhotoRequestSchema = z.object({
  composition: z.string().max(500).optional(),
  visualBrief: z.string().max(400).optional(),
  format: z.enum(["story", "landscape"]).optional(),
  variant: z.number().int().min(0).max(20).optional(),
  name: z.string().max(120),
  uses: z.string().max(200),
  category: z.string().max(60),
  form: z.string().max(40),
});
export type PromoPhotoInput = z.infer<typeof PromoPhotoRequestSchema>;

// ---------- Readings ----------

/**
 * One field as read from the carton: the value, how sure the reader is, and the evidence:
 * which photo it came from and the exact printed text (copied, never paraphrased).
 */
const evidenceField = <T extends z.ZodType>(value: T) =>
  z.object({
    value: value.nullable(),
    confidence: z.enum(["high", "low"]),
    source: ImageRoleSchema.nullable(),
    quote: z.string().nullable(),
  });

export const BoxReadingSchema = z.object({
  /** Zero-based photo mapping for a batch uploaded without labels. Optional for older providers. */
  photoViews: z.array(z.object({
    index: z.number().int().nonnegative(),
    view: z.enum(["front", "side", "top", "back", "pack", "other"]),
    kind: z.enum(["box", "strip", "bottle", "tube", "other"]),
    confidence: z.enum(["high", "low"]),
    usable: z.boolean(),
    rotation: z.enum(["0", "90", "180", "270"]),
  })).optional(),
  mixedProducts: z.boolean().optional(),
  name: evidenceField(z.string()),
  composition: evidenceField(z.string()),
  form: evidenceField(z.enum(FORMS)),
  packSize: evidenceField(z.string()),
  mrp: evidenceField(z.number()),
  manufacturer: evidenceField(z.string()),
  marketedBy: evidenceField(z.string()),
  schedule: evidenceField(z.enum(SCHEDULES)),
  storage: evidenceField(z.string()),
  category: evidenceField(z.enum(CATEGORIES)),
  /** The strength as printed on the front panel, e.g. "500"; checked against the composition. */
  strengthOnFront: evidenceField(z.string()),
});
export type BoxReading = z.infer<typeof BoxReadingSchema>;

export const CategoryItemSchema = z.object({ i: z.number().int(), category: z.enum(CATEGORIES) });
export type CategoryItem = z.infer<typeof CategoryItemSchema>;

export const CategoryListSchema = z.object({ items: z.array(CategoryItemSchema) });

// ---------- Promotional copy ----------

/** Length limits of AI-written copy (tighter than PROMO_LIMITS in promo.ts, so it always fits). */
export const COPY_LIMITS = {
  headline: 60,
  banner: 30,
  tagline: 45,
  sectionTitle: 40,
  bullet: 90,
  indication: 50,
  sections: 3,
  bullets: 3,
  indications: 7,
} as const;

/**
 * What the model is asked to return. No length limits here (structured output support for
 * maxLength varies); the server trims the draft with normalizeCopy() into PromoCopySchema.
 */
export const PromoCopyDraftSchema = z.object({
  suggestedUses: z.array(z.string()).optional(),
  visualBrief: z.string().optional(),
  headline: z.string(),
  banner: z.string(),
  tagline: z.string(),
  sections: z.array(z.object({ title: z.string(), bullets: z.array(z.string()) })),
  indications: z.array(z.string()),
});
export type PromoCopyDraft = z.infer<typeof PromoCopyDraftSchema>;

/** The copy the route returns, every limit enforced. Maps onto Promo (promo.ts) field for field. */
export const PromoCopySchema = z.object({
  suggestedUses: z.array(z.string().max(90)).max(3).optional(),
  visualBrief: z.string().max(400).optional(),
  headline: z.string().max(COPY_LIMITS.headline),
  banner: z.string().max(COPY_LIMITS.banner),
  tagline: z.string().max(COPY_LIMITS.tagline),
  sections: z
    .array(
      z.object({
        title: z.string().max(COPY_LIMITS.sectionTitle),
        bullets: z.array(z.string().min(1).max(COPY_LIMITS.bullet)).min(1).max(COPY_LIMITS.bullets),
      }),
    )
    .min(1)
    .max(COPY_LIMITS.sections),
  indications: z.array(z.string().min(1).max(COPY_LIMITS.indication)).max(COPY_LIMITS.indications),
});
export type PromoCopy = z.infer<typeof PromoCopySchema>;

/** promoClaims() of the copy: banned words (block sharing) and strong claims (need confirming). */
export const CopyClaimsSchema = z.object({ banned: z.array(z.string()), strong: z.array(z.string()) });

/** `data` of a successful /api/write-copy answer. */
export const WriteCopyDataSchema = z.object({ copy: PromoCopySchema, claims: CopyClaimsSchema });
export type WriteCopyData = z.infer<typeof WriteCopyDataSchema>;

export const PHOTO_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** `data` of a successful /api/promo-photo answer: the picture as plain base64 (no data: prefix). */
export const PromoPhotoSchema = z.object({
  mediaType: z.enum(PHOTO_MEDIA_TYPES),
  data: z.string().min(1).regex(/^[A-Za-z0-9+/=]+$/),
});
export type PromoPhoto = z.infer<typeof PromoPhotoSchema>;

// ---------- Metadata and response envelopes ----------

export const AiMetaSchema = z.object({
  provider: z.string(),
  model: z.string().nullable(),
  /** True for sample data that was NOT read from the user's photos. The UI must say so. */
  mock: z.boolean(),
  latencyMs: z.number().nonnegative(),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      estCostUsd: z.number().nonnegative().optional(),
    })
    .optional(),
});
export type AiMeta = z.infer<typeof AiMetaSchema>;

const ErrorEnvelope = z.object({ ok: z.literal(false), error: z.string() });

export const BoxReadResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: BoxReadingSchema, meta: AiMetaSchema }),
  ErrorEnvelope,
]);
export type BoxReadResponse = z.infer<typeof BoxReadResponseSchema>;

export const CategorizeResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: z.array(CategoryItemSchema), meta: AiMetaSchema }),
  ErrorEnvelope,
]);
export type CategorizeResponse = z.infer<typeof CategorizeResponseSchema>;

/** { ok: true, data: { copy, claims }, meta } | { ok: false, error }. meta.mock true means "Sample copy". */
export const WriteCopyResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: WriteCopyDataSchema, meta: AiMetaSchema }),
  ErrorEnvelope,
]);
export type WriteCopyResponse = z.infer<typeof WriteCopyResponseSchema>;

/** { ok: true, data: { mediaType, data }, meta } | { ok: false, error }. */
export const PromoPhotoResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: PromoPhotoSchema, meta: AiMetaSchema }),
  ErrorEnvelope,
]);
export type PromoPhotoResponse = z.infer<typeof PromoPhotoResponseSchema>;

// ---------- Provider interfaces ----------

export type BoxReadOutput = { data: BoxReading; meta: AiMeta };
export type CategorizeOutput = { data: CategoryItem[]; meta: AiMeta };
export type WriteCopyOutput = { data: PromoCopy; meta: AiMeta };
export type PromoPhotoOutput = { data: PromoPhoto; meta: AiMeta };

export interface BoxReader {
  readBox(input: BoxReadInput): Promise<BoxReadOutput>;
}

export interface Categorizer {
  categorize(items: CategoryRequest[]): Promise<CategorizeOutput>;
}

export interface Copywriter {
  /** Trade-only promotional copy built only from the given facts, already trimmed to COPY_LIMITS. */
  writeCopy(input: WriteCopyInput): Promise<WriteCopyOutput>;
}

export interface PhotoMaker {
  /** A landscape 4:3 lifestyle photo, subject on the right. Optional: absent means photo_unavailable. */
  makePhoto?(input: PromoPhotoInput): Promise<PromoPhotoOutput>;
  makeProductShot?(input: ProductShotInput): Promise<PromoPhotoOutput>;
}

/** A provider reads boxes, sorts categories and writes copy; some also make photos. Paid providers need sign-in and rate limits. */
export interface AiProvider extends BoxReader, Categorizer, Copywriter, PhotoMaker {
  readonly id: string;
  /** True when a call costs money: the routes then require sign-in and apply rate limits. */
  readonly paid: boolean;
}
