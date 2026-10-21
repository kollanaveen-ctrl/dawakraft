// Prompt and result handling for "Read box with AI". Safe to import in the browser.
import { AI_FIELD_KEYS, CATEGORIES, FORMS, SCHEDULES, type AiFieldKey } from "../constants";
import { parseMrp } from "../format";
import type { AiReadResult, DraftFields } from "../types";

/** Same instructions as the prototype; the JSON shape is now enforced by structured output. */
export function boxReadPrompt(imageCount: number): string {
  return `These ${imageCount} photos show the sides of ONE Indian pharmaceutical product carton. Read only text that is printed and visible. Never guess.
Fill in every key; each value is {"value": ..., "confidence": "high" or "low"}:
name: the brand name.
composition: each active ingredient with its strength per unit as printed, e.g. "Paracetamol IP 650 mg".
form: one of ${FORMS.join(", ")}.
packSize: as printed, e.g. "10 x 10 tablets".
mrp: the MRP of the pack in rupees as a number, no symbol.
manufacturer: the "Manufactured by" company.
marketedBy: the "Marketed by" company, if printed.
schedule: one of "H", "H1", "X", "G", "None". Use "H" or "H1" or "X" only if that schedule warning or an Rx mark is printed. Use "None" only if clearly over-the-counter. Otherwise null.
storage: storage instructions as printed, shortened.
category: one of ${CATEGORIES.join(", ")}, judged from the composition.
If a field is not visible, value null and confidence "low". Mark confidence "low" whenever text is blurred, cut off, or you are unsure.`;
}

export type MergeOutcome = {
  fields: DraftFields;
  low: Partial<Record<AiFieldKey, true>>;
  filled: number;
};

function normalise(key: AiFieldKey, raw: string | number): string | null {
  const v = String(raw).trim();
  if (!v) return null;
  if (key === "mrp") {
    const n = parseMrp(v);
    return n == null ? null : String(n);
  }
  if (key === "form") return (FORMS as readonly string[]).includes(v) ? v : "Other";
  if (key === "category") return (CATEGORIES as readonly string[]).includes(v) ? v : "Other";
  if (key === "schedule") return (SCHEDULES as readonly string[]).includes(v) ? v : null;
  return v;
}

/** Merge an AI reading into the form, flagging every field that wasn't read with high confidence. */
export function mergeAiResult(current: DraftFields, result: AiReadResult | null | undefined): MergeOutcome {
  const fields: DraftFields = { ...current };
  const low: MergeOutcome["low"] = {};
  let filled = 0;
  for (const key of AI_FIELD_KEYS) {
    const r = result?.[key];
    if (!r || typeof r !== "object" || r.value == null) continue;
    const v = normalise(key, r.value);
    if (v == null) continue;
    fields[key] = v;
    filled++;
    if (r.confidence !== "high") low[key] = true;
  }
  return { fields, low, filled };
}

/** Status line shown under the AI button after a reading. */
export function aiSummary({ filled, low }: Pick<MergeOutcome, "filled" | "low">): string {
  if (!filled) return "Couldn't read the box clearly. Type the details, or try sharper photos.";
  const flagged = Object.keys(low).length ? ", especially the ones marked Check this" : "";
  return `Filled ${filled} field${filled === 1 ? "" : "s"}. Check every field against the carton${flagged}.`;
}
