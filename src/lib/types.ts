import type { AiFieldKey, ImageRole, TemplateKey } from "./constants";
import type { Promo } from "./promo";

export type Product = {
  id: string;
  name: string;
  composition: string;
  /** Indications as in the approved leaflet, e.g. "Hypertension, Angina". Optional. */
  uses: string;
  form: string;
  packSize: string;
  mrp: number | null;
  schedule: string;
  manufacturer: string;
  marketedBy: string;
  storage: string;
  category: string;
  scheme: string;
  highlight: string;
  template: TemplateKey;
  /** Content for the Promo circular (headline, ingredient sections, photo…). */
  promo: Promo;
  imagePath: string | null;
  example: boolean;
  /** When the product launched (ISO time); null for an existing product. */
  launchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** What a circular needs to draw a product: everything except bookkeeping. */
export type ProductFields = Omit<
  Product,
  "id" | "template" | "promo" | "imagePath" | "example" | "launchedAt" | "createdAt" | "updatedAt"
>;

/** Form state in the wizard: MRP is kept as typed text until saved. */
export type DraftFields = Omit<ProductFields, "mrp"> & { mrp: string };

export type Company = {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  licence: string;
  brandColor: string;
  logoPath: string | null;
};

export type CheckLevel = "good" | "warn" | "bad";
export type Check = { level: CheckLevel; text: string };

export type Confidence = "high" | "low";
/** One field of an AI reading. source and quote are the evidence: which photo, and the exact printed text. */
export type AiField = {
  value: string | number | null;
  confidence: Confidence;
  source?: ImageRole | null;
  quote?: string | null;
};
export type AiReadResult = Partial<Record<AiFieldKey | "strengthOnFront", AiField>>;
