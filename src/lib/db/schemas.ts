// Server-only: what the data API accepts, with the same limits as the database
// (cloudflare/migrations/0001_init.sql). Unknown keys such as an owner id are dropped:
// the owner always comes from the session, never from the request body.
import { z } from "zod";
import { SCHEDULES, TEMPLATES } from "../constants";
import { parsePromo } from "../promo";

const TEMPLATE_KEYS = TEMPLATES.map(([k]) => k) as [string, ...string[]];
/** Product ids are made in the browser (crypto.randomUUID); anything URL-safe and short is accepted. */
export const IdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const text = (max: number) => z.string().max(max);
const isoTime = z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), "not a time");
const mediaPath = z.string().max(300).nullable();
/** The promo stored as JSON text must stay under the database's 16 KB check. */
const MAX_PROMO_CHARS = 16_000;

export const ProductInputSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(200),
  composition: text(500),
  uses: text(140).default(""),
  form: text(60),
  packSize: text(120),
  mrp: z.number().positive().lt(100_000_000).nullable(),
  schedule: z.enum(["", ...SCHEDULES]),
  manufacturer: text(200),
  marketedBy: text(200),
  storage: text(200),
  category: text(60),
  scheme: text(120),
  highlight: text(60),
  template: z.enum(TEMPLATE_KEYS),
  promo: z
    .unknown()
    .transform((v) => parsePromo(v))
    .refine((p) => JSON.stringify(p).length < MAX_PROMO_CHARS, "promo too large"),
  imagePath: mediaPath,
  example: z.boolean(),
  launchedAt: isoTime.nullable(),
  createdAt: isoTime,
  updatedAt: isoTime,
});
export type ProductInput = z.infer<typeof ProductInputSchema>;

export const MAX_BULK_PRODUCTS = 200;
export const BulkProductsSchema = z.object({ products: z.array(ProductInputSchema).min(1).max(MAX_BULK_PRODUCTS) });

export const MAX_DELETE_IDS = 500;
export const DeleteProductsSchema = z.object({ ids: z.array(IdSchema).min(1).max(MAX_DELETE_IDS) });

export const TemplatePatchSchema = z.object({ template: z.enum(TEMPLATE_KEYS) });

export const CompanyInputSchema = z.object({
  name: text(120),
  tagline: text(160),
  phone: text(40),
  email: text(160),
  address: text(300),
  licence: text(200),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  logoPath: mediaPath,
});

export const MAX_MEDIA_PATHS = 50;
export const UploadUrlSchema = z.object({
  name: z.string().min(1).max(120),
  contentType: z.enum(["image/webp", "image/png", "image/jpeg"]),
  size: z.number().int().positive(),
});
export const DeleteMediaSchema = z.object({ paths: z.array(z.string().max(300)).min(1).max(MAX_MEDIA_PATHS) });
