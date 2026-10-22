// The provider-independent AI contract: request and response shapes shared by the API routes,
// every provider (Claude, the mock, and any future one) and the tests.
// The browser imports only the types from here (`import type`), so zod stays on the server.
import { z } from "zod";
import { AI_CATEGORY_BATCH, CATEGORIES, FORMS, IMAGE_ROLES, MAX_AI_IMAGES, SCHEDULES } from "../constants";

// ---------- Errors ----------

export type AiErrorCode = "not_configured" | "rate_limited" | "image_rejected" | "invalid_json" | "refused" | "failed" | "out_of_credits";

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

export const CategoryRequestSchema = z.object({
  i: z.number().int().min(0).max(10_000),
  name: z.string().min(1).max(200),
  composition: z.string().max(500),
});
export type CategoryRequest = z.infer<typeof CategoryRequestSchema>;

export const CategorizeRequestSchema = z.object({
  items: z.array(CategoryRequestSchema).min(1).max(AI_CATEGORY_BATCH),
});

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

// ---------- Provider interfaces ----------

export type BoxReadOutput = { data: BoxReading; meta: AiMeta };
export type CategorizeOutput = { data: CategoryItem[]; meta: AiMeta };

export interface BoxReader {
  readBox(input: BoxReadInput): Promise<BoxReadOutput>;
}

export interface Categorizer {
  categorize(items: CategoryRequest[]): Promise<CategorizeOutput>;
}

/** A provider reads boxes and sorts categories. Paid providers need sign-in and rate limits. */
export interface AiProvider extends BoxReader, Categorizer {
  readonly id: string;
  /** True when a call costs money: the routes then require sign-in and apply rate limits. */
  readonly paid: boolean;
}
