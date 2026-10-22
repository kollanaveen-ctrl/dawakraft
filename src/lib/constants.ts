// Lists and copy carried over unchanged from the dawakraft.html prototype.

export const CATEGORIES = [
  "Analgesic & antipyretic",
  "Antibiotic",
  "Gastro",
  "Cardiac",
  "Diabetes",
  "Respiratory",
  "Vitamins & supplements",
  "Dermatology",
  "Neuro & psych",
  "Gynaecology",
  "Orthopaedic",
  "Eye & ENT",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const FORMS = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Suspension",
  "Injection",
  "Ointment",
  "Cream",
  "Gel",
  "Drops",
  "Sachet",
  "Inhaler",
  "Other",
] as const;

export const SCHEDULES = ["None", "H", "H1", "X", "G"] as const;

export const BRAND_COLOURS = ["#0B7A63", "#1F4E8C", "#7A1F4E", "#B4461E", "#4B3A8F", "#0F1F24"];

export const TEMPLATES = [
  ["catalog", "Catalogue card"],
  ["clean", "Clean"],
  ["band", "Side band"],
  ["spotlight", "Spotlight"],
] as const;

export type TemplateKey = (typeof TEMPLATES)[number][0];

export const TRADE_LINE =
  "For the use of registered medical practitioners, hospitals and licensed trade only.";

export const BANNED: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bcures?\b/i, "cure"],
  [/\bguarantee(d|s)?\b/i, "guarantee"],
  [/100\s*%/, "100%"],
  [/\bmiracle\b/i, "miracle"],
  [/\bpermanent(ly)?\b/i, "permanent"],
  [/\bno side[- ]?effects?\b/i, "no side effects"],
  [/\binstant relief\b/i, "instant relief"],
  [/\bbest\b/i, "best"],
  [/\bsafest\b/i, "safest"],
  [/\bno\.?\s?1\b/i, "No. 1"],
  [/#1\b/, "#1"],
  [/\brisk[- ]free\b/i, "risk-free"],
];

/** Fields the wizard edits, in form order. */
export const FIELD_KEYS = [
  "name",
  "category",
  "composition",
  "uses",
  "form",
  "packSize",
  "mrp",
  "schedule",
  "manufacturer",
  "marketedBy",
  "storage",
  "scheme",
  "highlight",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

/** Fields the AI reads from the box (same JSON keys as the prototype). */
export const AI_FIELD_KEYS = [
  "name",
  "composition",
  "form",
  "packSize",
  "mrp",
  "manufacturer",
  "marketedBy",
  "schedule",
  "storage",
  "category",
] as const;

export type AiFieldKey = (typeof AI_FIELD_KEYS)[number];

/** Which face of the carton a photo shows, as sent to the AI ("other" = not labelled). */
export const IMAGE_ROLES = ["front", "side", "top", "other"] as const;

export type ImageRole = (typeof IMAGE_ROLES)[number];

/** Sample product for the Company preview and the "Add an example" button. */
export const SAMPLE = {
  name: "Exampol 650",
  composition: "Paracetamol IP 650 mg",
  uses: "Fever, Headache, Body ache",
  form: "Tablet",
  packSize: "10 × 15 tablets",
  mrp: 32.5,
  category: "Analgesic & antipyretic",
  schedule: "None",
  manufacturer: "Example Pharma Pvt. Ltd.",
  marketedBy: "",
  storage: "",
  highlight: "New launch",
  scheme: "10+1 free",
};

export const MAX_AI_IMAGES = 4;
export const HIGHLIGHT_MAX = 28;
/** Same limit as the products.uses column. */
export const USES_MAX = 140;
export const IMPORT_MAX_ROWS = 500;
export const AI_CATEGORY_BATCH = 150;
