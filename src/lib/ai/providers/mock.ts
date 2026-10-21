// The mock provider: fixed sample answers so the app works with no AI key and no cost.
// It never pretends to be live: meta.mock is true, every field is "low" confidence, and the
// UI shows a "Sample reading" warning. The photos are not looked at.
import type { Category } from "../../constants";
import type { AiProvider, BoxReading, CategorizeOutput, CategoryRequest, AiMeta, BoxReadOutput } from "../types";

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
  };
}

export const mockProvider = createMockProvider();
