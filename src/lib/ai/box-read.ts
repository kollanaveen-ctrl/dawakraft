// Prompt and result handling for "Read box with AI". Safe to import in the browser.
import { AI_FIELD_KEYS, CATEGORIES, FORMS, SCHEDULES, type AiFieldKey, type ImageRole } from "../constants";
import { parseMrp } from "../format";
import type { AiReadResult, DraftFields } from "../types";

const ROLE_LABEL: Record<ImageRole, string> = {
  front: "the FRONT face of the carton",
  side: "a SIDE panel of the carton",
  top: "the TOP flap of the carton",
  other: "another face of the carton (not labelled)",
};

/** "Image 1 is the FRONT face of the carton." and so on, one line per photo, in the order sent. */
export function imageLabels(roles: readonly ImageRole[]): string {
  return roles.map((role, i) => `Image ${i + 1} is ${ROLE_LABEL[role]}.`).join("\n");
}

/** Instructions for any reader. The JSON shape itself is enforced by the provider's structured output. */
export function boxReadPrompt(roles: readonly ImageRole[]): string {
  return `These ${roles.length} photos show the sides of ONE Indian pharmaceutical product carton.
${imageLabels(roles)}
Read only text that is printed and visible. Never guess, never fill in from memory of similar products, never correct spelling.
Fill in every key; each value is {"value": ..., "confidence": "high" or "low", "source": ..., "quote": ...}:
- source: which photo the text was read from: "front", "side", "top" or "other" (use the label of the image above), or null if not found.
- quote: the exact printed text you read the value from, copied character for character. Never paraphrase, translate or expand it. null if not found.
name: the brand name.
composition: copy it exactly as printed: every active ingredient with its salt, standard (IP, BP, USP) and strength with unit, e.g. "Paracetamol IP 650 mg". Do not convert units, reorder, round or summarise.
form: one of ${FORMS.join(", ")}.
packSize: as printed, e.g. "10 x 10 tablets".
mrp: the MRP of the pack in rupees as a number, no symbol.
manufacturer: the "Manufactured by" company.
marketedBy: the "Marketed by" company, if printed.
schedule: one of "H", "H1", "X", "G", "None". Use "H" or "H1" or "X" only if that schedule warning or an Rx mark is printed. Use "None" only if clearly over-the-counter. Otherwise null.
storage: storage instructions as printed, shortened.
category: one of ${CATEGORIES.join(", ")}, judged from the composition. For category, quote the composition text you judged from.
strengthOnFront: the strength exactly as printed on the FRONT face, e.g. "500" or "250 mg", read from the front image only. null if there is no front image or no strength on it.
If a field is not visible, value null, confidence "low", source null and quote null. Mark confidence "low" whenever text is blurred, cut off, or you are unsure.`;
}

export type Evidence = { source: ImageRole | null; quote: string | null };

export type MergeOutcome = {
  fields: DraftFields;
  low: Partial<Record<AiFieldKey, true>>;
  filled: number;
  /** Where each filled field was read from, for the "Read from side panel" lines. */
  evidence: Partial<Record<AiFieldKey, Evidence>>;
  /** The strength printed on the front panel, or null when not read. */
  strengthOnFront: string | null;
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

/** Evidence for one field, or null when the reader gave neither a source nor a quote. */
function evidenceOf(r: { source?: ImageRole | null; quote?: string | null }): Evidence | null {
  const quote = typeof r.quote === "string" && r.quote.trim() ? r.quote.trim() : null;
  const source = r.source ?? null;
  return quote || source ? { source, quote } : null;
}

function readStrength(result: AiReadResult | null | undefined): string | null {
  const v = result?.strengthOnFront?.value;
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/** Merge an AI reading into the form, flagging every field that wasn't read with high confidence. */
export function mergeAiResult(current: DraftFields, result: AiReadResult | null | undefined): MergeOutcome {
  const fields: DraftFields = { ...current };
  const low: MergeOutcome["low"] = {};
  const evidence: MergeOutcome["evidence"] = {};
  let filled = 0;
  for (const key of AI_FIELD_KEYS) {
    const r = result?.[key];
    if (!r || typeof r !== "object" || r.value == null) continue;
    const v = normalise(key, r.value);
    if (v == null) continue;
    fields[key] = v;
    filled++;
    if (r.confidence !== "high") low[key] = true;
    const ev = evidenceOf(r);
    if (ev) evidence[key] = ev;
  }
  return { fields, low, filled, evidence, strengthOnFront: readStrength(result) };
}

/** Status line shown under the AI button after a reading. */
export function aiSummary({ filled, low }: Pick<MergeOutcome, "filled" | "low">): string {
  if (!filled) return "Couldn't read the box clearly. Type the details, or try sharper photos.";
  const flagged = Object.keys(low).length ? ", especially the ones marked Check this" : "";
  return `Filled ${filled} field${filled === 1 ? "" : "s"}. Check every field against the carton${flagged}.`;
}

/** Shown as a warning instead of aiSummary when the reading came from the mock provider. */
export const MOCK_READING_MESSAGE =
  "Sample reading: these are demo values, not read from your photos. Replace every field with the carton's real details.";

const PANEL_NAME: Record<ImageRole, string> = {
  front: "front panel",
  side: "side panel",
  top: "top flap",
  other: "another photo",
};

/** The small line under a field, e.g. `Read from side panel: "Azithromycin IP 500 mg"`. Null when there's nothing to show. */
export function evidenceLine(ev: Evidence | undefined, mock = false): string | null {
  if (!ev?.quote) return null;
  if (mock) return `Demo value, not from your photos: "${ev.quote}"`;
  const where = ev.source ? PANEL_NAME[ev.source] : "the photos";
  return `Read from ${where}: "${ev.quote}"`;
}
