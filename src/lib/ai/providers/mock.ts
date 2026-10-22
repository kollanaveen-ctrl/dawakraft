// The mock provider: fixed sample answers so the app works with no AI key and no cost.
// It never pretends to be live: meta.mock is true, every field is "low" confidence, and the
// UI shows a "Sample reading" warning. The photos are not looked at.
// Copy is clearly marked sample text (the UI says "Sample copy"); there is no sample photo.
import type { Category } from "../../constants";
import { clip, ingredientNames, splitUses } from "../promo-copy";
import {
  COPY_LIMITS,
  type AiMeta,
  type AiProvider,
  type BoxReadOutput,
  type BoxReading,
  type CategorizeOutput,
  type CategoryRequest,
  type PromoCopy,
  type WriteCopyInput,
  type WriteCopyOutput,
} from "../types";

const PROVIDER = "mock";
export const MOCK_DELAY_MS = 600; // feels like a short network call, so loading states can be seen

/** A made-up carton (no real brand) with plausible printed text for every field. */
export const MOCK_READING: BoxReading = {
  name: { value: "Demozith 500", confidence: "low", source: "front", quote: "Demozith 500" },
  composition: {
    value: "Azithromycin IP 500 mg",
    confidence: "low",
    source: "side",
    quote: "Each film coated tablet contains: Azithromycin IP 500 mg",
  },
  form: { value: "Tablet", confidence: "low", source: "front", quote: "Tablets" },
  packSize: { value: "3 tablets", confidence: "low", source: "front", quote: "3 Tablets" },
  mrp: { value: 119.5, confidence: "low", source: "side", quote: "M.R.P. ₹119.50 incl. of all taxes" },
  manufacturer: { value: "Sample Pharma Pvt. Ltd.", confidence: "low", source: "side", quote: "Mfd. by: Sample Pharma Pvt. Ltd." },
  marketedBy: { value: null, confidence: "low", source: null, quote: null },
  schedule: { value: "H", confidence: "low", source: "side", quote: "Schedule H Prescription Drug" },
  storage: { value: "Store below 30°C", confidence: "low", source: "side", quote: "Store below 30°C. Protect from moisture." },
  category: { value: "Antibiotic", confidence: "low", source: "side", quote: "Azithromycin IP 500 mg" },
  strengthOnFront: { value: "500", confidence: "low", source: "front", quote: "500" },
};

// Keyword guesses for the sample categories; anything else becomes Other.
const CATEGORY_HINTS: ReadonlyArray<readonly [RegExp, Category]> = [
  [/paracetamol|ibuprofen|diclofenac|aceclofenac|nimesulide/i, "Analgesic & antipyretic"],
  [/cillin|mycin|floxacin|cef|azithro|doxy|metronidazole/i, "Antibiotic"],
  [/prazole|ranitidine|domperidone|ondansetron|antacid/i, "Gastro"],
  [/olol|pril|sartan|statin|amlodipine|clopidogrel/i, "Cardiac"],
  [/metformin|gliptin|glimepiride|insulin|gliclazide/i, "Diabetes"],
  [/montelukast|salbutamol|cetirizine|levocetirizine|ambroxol|cough/i, "Respiratory"],
  [/vitamin|zinc|calcium|iron|folic|multivit/i, "Vitamins & supplements"],
];

export function mockCategory({ name, composition }: CategoryRequest): Category {
  const text = `${composition} ${name}`;
  return CATEGORY_HINTS.find(([re]) => re.test(text))?.[1] ?? "Other";
}

/** Deterministic sample copy built from the input; every line says it is a sample to replace. */
export function mockCopy(input: WriteCopyInput): PromoCopy {
  const names = ingredientNames(input.composition);
  const titles = names.length ? names : [clip(input.name, COPY_LIMITS.sectionTitle) || "Key ingredient"];
  return {
    headline: clip(`Sample headline for ${input.name}`, COPY_LIMITS.headline),
    banner: "SAMPLE COPY",
    tagline: "Replace with your approved wording",
    sections: titles.map((title) => ({
      title,
      bullets: [clip(`Sample text: describe the role of ${title}`, COPY_LIMITS.bullet)],
    })),
    indications: splitUses(input.uses)
      .map((u) => clip(u, COPY_LIMITS.indication))
      .slice(0, COPY_LIMITS.indications),
  };
}

function mockMeta(started: number): AiMeta {
  return { provider: PROVIDER, model: null, mock: true, latencyMs: Date.now() - started };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Build a mock provider; tests pass delayMs 0. */
export function createMockProvider({ delayMs = MOCK_DELAY_MS }: { delayMs?: number } = {}): AiProvider {
  return {
    id: PROVIDER,
    paid: false,
    async readBox(): Promise<BoxReadOutput> {
      const started = Date.now();
      await wait(delayMs);
      return { data: structuredClone(MOCK_READING), meta: mockMeta(started) };
    },
    async categorize(items): Promise<CategorizeOutput> {
      const started = Date.now();
      await wait(delayMs);
      return { data: items.map((item) => ({ i: item.i, category: mockCategory(item) })), meta: mockMeta(started) };
    },
    async writeCopy(input): Promise<WriteCopyOutput> {
      const started = Date.now();
      await wait(delayMs);
      return { data: mockCopy(input), meta: mockMeta(started) };
    },
    // No makePhoto: the photo route answers photo_unavailable and the UI uses a colour background.
  };
}

export const mockProvider = createMockProvider();
