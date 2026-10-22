// Converting between database rows (snake_case), app objects, and wizard form state.
import { isHexColour } from "../color";
import { BRAND_COLOURS, TEMPLATES, type TemplateKey } from "../constants";
import { parseMrp } from "../format";
import { parsePromo, type Promo } from "../promo";
import type { Company, DraftFields, Product } from "../types";

export type ProductRow = {
  id: string;
  name: string;
  composition: string;
  uses: string;
  form: string;
  pack_size: string;
  mrp: number | string | null;
  schedule: string;
  manufacturer: string;
  marketed_by: string;
  storage: string;
  category: string;
  scheme: string;
  highlight: string;
  template: string;
  promo?: Promo | null;
  image_path: string | null;
  example: boolean;
  launched_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyRow = {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  licence: string;
  brand_color: string;
  logo_path: string | null;
};

const TEMPLATE_KEYS = TEMPLATES.map(([k]) => k) as readonly string[];

export function asTemplate(v: unknown): TemplateKey {
  return TEMPLATE_KEYS.includes(String(v)) ? (v as TemplateKey) : "clean";
}

export function toProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name ?? "",
    composition: r.composition ?? "",
    uses: r.uses ?? "",
    form: r.form ?? "",
    packSize: r.pack_size ?? "",
    mrp: parseMrp(r.mrp),
    schedule: r.schedule ?? "",
    manufacturer: r.manufacturer ?? "",
    marketedBy: r.marketed_by ?? "",
    storage: r.storage ?? "",
    category: r.category || "Other",
    scheme: r.scheme ?? "",
    highlight: r.highlight ?? "",
    template: asTemplate(r.template),
    promo: parsePromo(r.promo),
    imagePath: r.image_path,
    example: Boolean(r.example),
    launchedAt: r.launched_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** A product read back from demo storage, which may predate newer fields (promo, uses): defaults filled in. */
export function normalizeStoredProduct(p: Product): Product {
  return {
    ...p,
    uses: p.uses ?? "",
    highlight: p.highlight ?? "",
    template: asTemplate(p.template),
    promo: parsePromo(p.promo),
  };
}

export function toProductRow(p: Product): ProductRow {
  return {
    id: p.id,
    name: p.name.trim(),
    composition: p.composition.trim(),
    uses: (p.uses ?? "").trim(),
    form: p.form,
    pack_size: p.packSize.trim(),
    mrp: p.mrp,
    schedule: p.schedule,
    manufacturer: p.manufacturer.trim(),
    marketed_by: p.marketedBy.trim(),
    storage: p.storage.trim(),
    category: p.category || "Other",
    scheme: p.scheme.trim(),
    highlight: p.highlight.trim(),
    template: p.template,
    promo: parsePromo(p.promo),
    image_path: p.imagePath,
    example: p.example,
    launched_at: p.launchedAt,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export const EMPTY_COMPANY: Company = {
  name: "",
  tagline: "",
  phone: "",
  email: "",
  address: "",
  licence: "",
  brandColor: BRAND_COLOURS[0],
  logoPath: null,
};

export function toCompany(r: CompanyRow | null): Company {
  if (!r) return EMPTY_COMPANY;
  return {
    name: r.name ?? "",
    tagline: r.tagline ?? "",
    phone: r.phone ?? "",
    email: r.email ?? "",
    address: r.address ?? "",
    licence: r.licence ?? "",
    brandColor: isHexColour(r.brand_color) ? r.brand_color : BRAND_COLOURS[0],
    logoPath: r.logo_path,
  };
}

export function toCompanyRow(c: Company): CompanyRow {
  return {
    name: c.name.trim(),
    tagline: c.tagline.trim(),
    phone: c.phone.trim(),
    email: c.email.trim(),
    address: c.address.trim(),
    licence: c.licence.trim(),
    brand_color: isHexColour(c.brandColor) ? c.brandColor : BRAND_COLOURS[0],
    logo_path: c.logoPath,
  };
}

export const EMPTY_DRAFT: DraftFields = {
  name: "",
  category: "",
  composition: "",
  uses: "",
  form: "",
  packSize: "",
  mrp: "",
  schedule: "",
  manufacturer: "",
  marketedBy: "",
  storage: "",
  scheme: "",
  highlight: "New launch",
};

export function productToDraft(p: Product): DraftFields {
  return {
    name: p.name,
    category: p.category,
    composition: p.composition,
    uses: p.uses ?? "",
    form: p.form,
    packSize: p.packSize,
    mrp: p.mrp == null ? "" : String(p.mrp),
    schedule: p.schedule,
    manufacturer: p.manufacturer,
    marketedBy: p.marketedBy,
    storage: p.storage,
    scheme: p.scheme,
    highlight: p.highlight,
  };
}

/** Wizard values as the fields a circular draws (MRP parsed to a number). */
export function draftToFields(d: DraftFields) {
  return { ...d, mrp: parseMrp(d.mrp), category: d.category || "Other" };
}
