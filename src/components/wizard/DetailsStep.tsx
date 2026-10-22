"use client";
import { useState, type ReactNode } from "react";
import { MOCK_READING_MESSAGE, aiSummary, evidenceLine, mergeAiResult, type MergeOutcome } from "@/lib/ai/box-read";
import type { BoxReadResponse } from "@/lib/ai/types";
import {
  CATEGORIES,
  FORMS,
  HIGHLIGHT_MAX,
  IMAGE_ROLES,
  MAX_AI_IMAGES,
  SCHEDULES,
  type FieldKey,
  type ImageRole,
} from "@/lib/constants";
import { demoMode } from "@/lib/config";
import { aiImage } from "@/lib/image/encode";
import { NEW_LAUNCH_DAYS } from "@/lib/segments";
import type { AiReadResult, DraftFields } from "@/lib/types";
import "@/styles/ai.css";

type Low = Partial<Record<FieldKey, true>>;

export type DetailsPhoto = { file: File; role: ImageRole };

type Props = {
  fields: DraftFields;
  low: Low;
  photos: DetailsPhoto[];
  strengthOnFront: string;
  confirmed: boolean;
  isNew: boolean;
  onFields: (f: DraftFields, low: Low) => void;
  onStrengthOnFront: (v: string) => void;
  onConfirmed: (v: boolean) => void;
  onIsNew: (v: boolean) => void;
};

const AI_ERRORS: Record<string, string> = {
  not_signed_in: "Your sign-in expired. Reload the page and sign in again.",
  demo_online: "AI reading is switched off on the online demo until sign-in is added. Type the details from the carton.",
  not_configured: "AI reading isn't set up yet. Type the details from the carton.",
  rate_limited: "AI is busy right now. Wait a minute, then try again.",
  image_rejected: "One photo couldn't be used. Try a different photo.",
  invalid_json: "The AI reply couldn't be read. Try again.",
  out_of_credits:
    "The AI credits have run out. Type the details from the carton, and ask the organisers for more credits.",
};
const AI_FALLBACK = "Couldn't read the box. Try again, or type the details.";

/** The last reading's evidence, kept so each field can say where it was read from. */
type Reading = { evidence: MergeOutcome["evidence"]; mock: boolean };
const NO_READING: Reading = { evidence: {}, mock: false };

type FieldProps = { k: FieldKey; label: ReactNode; low: Low; full?: boolean; evidence?: string | null; children: ReactNode };

function Field({ k, label, low, full, evidence, children }: FieldProps) {
  return (
    <label className={`field${full ? " full" : ""}${low[k] ? " low" : ""}`}>
      <span>
        {label}
        <span className="flag">Check this</span>
      </span>
      {children}
      {evidence && <span className="ai-evidence">{evidence}</span>}
    </label>
  );
}

/** Labelled photos first (front, side, top), then the rest, up to the AI's limit. */
function photosForAi(photos: DetailsPhoto[]): DetailsPhoto[] {
  const rank = (role: ImageRole) => IMAGE_ROLES.indexOf(role);
  return [...photos].sort((a, b) => rank(a.role) - rank(b.role)).slice(0, MAX_AI_IMAGES);
}

async function requestReading(photos: DetailsPhoto[]): Promise<{ res: Response; body: BoxReadResponse | null }> {
  const images = await Promise.all(
    photosForAi(photos).map(async ({ file, role }) => ({ ...(await aiImage(file)), role })),
  );
  const res = await fetch("/api/read-box", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });
  const body = (await res.json().catch(() => null)) as BoxReadResponse | null;
  return { res, body };
}

export function DetailsStep({
  fields,
  low,
  photos,
  strengthOnFront,
  confirmed,
  isNew,
  onFields,
  onStrengthOnFront,
  onConfirmed,
  onIsNew,
}: Props) {
  const [status, setStatus] = useState({ text: "", err: false });
  const [reading, setReading] = useState(false);
  const [last, setLast] = useState<Reading>(NO_READING);

  function set(k: FieldKey, v: string) {
    const nextLow = { ...low };
    delete nextLow[k];
    onFields({ ...fields, [k]: v }, nextLow);
  }

  const text = (k: FieldKey, extra: Record<string, string | number> = {}) => (
    <input type="text" autoComplete="off" value={fields[k]} onChange={(e) => set(k, e.target.value)} {...extra} />
  );
  const select = (k: FieldKey, opts: readonly string[]) => (
    <select value={fields[k]} onChange={(e) => set(k, e.target.value)}>
      <option value="">Choose…</option>
      {opts.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
  const ev = (k: FieldKey) => (k === "scheme" || k === "highlight" ? null : evidenceLine(last.evidence[k], last.mock));

  function applyReading(data: AiReadResult, mock: boolean) {
    const merged = mergeAiResult(fields, data);
    // Composition is always flagged: a misread strength is the most dangerous mistake on a circular.
    const nextLow: Low = merged.fields.composition ? { ...merged.low, composition: true } : merged.low;
    onFields(merged.fields, nextLow);
    if (merged.strengthOnFront) onStrengthOnFront(merged.strengthOnFront);
    setLast({ evidence: merged.evidence, mock });
    setStatus({ text: mock ? "" : aiSummary(merged), err: false });
  }

  async function readWithAi() {
    if (!photos.length) return setStatus({ text: "Add photos of the box in step 1 first.", err: true });
    setReading(true);
    setLast(NO_READING);
    setStatus({ text: "Reading the box… this can take up to a minute.", err: false });
    try {
      const { res, body } = await requestReading(photos);
      if (!res.ok || !body?.ok) {
        const error = body && !body.ok ? body.error : "";
        const code = demoMode && error === "not_signed_in" ? "demo_online" : error;
        setStatus({ text: AI_ERRORS[code] ?? AI_FALLBACK, err: true });
        return;
      }
      applyReading(body.data, body.meta.mock);
    } catch {
      setStatus({ text: AI_FALLBACK, err: true });
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="card stack">
      <div className="spread">
        <div>
          <h2>Product details</h2>
          <p className="muted">Read the box with AI, then check every field against the carton.</p>
        </div>
        <button className="btn primary" type="button" onClick={readWithAi} disabled={reading}>
          Read box with AI
        </button>
      </div>
      {last.mock && (
        <div className="notice warn ai-mock" role="alert">
          <span className="dot warn" aria-hidden="true" />
          <p>{MOCK_READING_MESSAGE}</p>
        </div>
      )}
      <p className={`status${status.err ? " err" : ""}`} aria-live="polite">{status.text}</p>
      <div className="form-grid">
        <Field k="name" label="Brand name" low={low} evidence={ev("name")}>{text("name")}</Field>
        <Field k="category" label="Category" low={low} evidence={ev("category")}>{select("category", CATEGORIES)}</Field>
        <Field k="composition" low={low} full evidence={ev("composition")} label={<>Composition <span className="hint">Each active ingredient with its strength, as printed</span></>}>
          {text("composition")}
        </Field>
        <label className="field full ai-strength">
          <span>
            Strength printed on the front <span className="hint">As printed, e.g. 500</span>
          </span>
          <input type="text" autoComplete="off" inputMode="text" value={strengthOnFront} onChange={(e) => onStrengthOnFront(e.target.value)} />
        </label>
        <Field k="form" label="Dosage form" low={low} evidence={ev("form")}>{select("form", FORMS)}</Field>
        <Field k="packSize" label="Pack size" low={low} evidence={ev("packSize")}>{text("packSize", { placeholder: "10 × 10 tablets" })}</Field>
        <Field k="mrp" label="MRP per pack (₹)" low={low} evidence={ev("mrp")}>
          <input type="number" min={0} step="0.01" inputMode="decimal" value={fields.mrp} onChange={(e) => set("mrp", e.target.value)} />
        </Field>
        <Field k="schedule" label="Schedule" low={low} evidence={ev("schedule")}>{select("schedule", SCHEDULES)}</Field>
        <Field k="manufacturer" label="Manufactured by" low={low} evidence={ev("manufacturer")}>{text("manufacturer")}</Field>
        <Field k="marketedBy" label="Marketed by" low={low} evidence={ev("marketedBy")}>{text("marketedBy")}</Field>
        <Field k="storage" label="Storage" low={low} evidence={ev("storage")}>{text("storage", { placeholder: "Store below 30°C" })}</Field>
        <Field k="scheme" low={low} label={<>Trade scheme <span className="hint">Optional, e.g. 10+1 free</span></>}>{text("scheme")}</Field>
        <Field k="highlight" low={low} full label={<>Highlight line <span className="hint">Short and factual, e.g. New launch</span></>}>
          {text("highlight", { maxLength: HIGHLIGHT_MAX })}
        </Field>
      </div>
      <label className="confirm">
        <input type="checkbox" checked={isNew} onChange={(e) => onIsNew(e.target.checked)} />
        <span>
          This is a new launch
          <br />
          <span className="muted">
            Shown under New launches in the catalog for {NEW_LAUNCH_DAYS} days, then moved to Existing automatically.
          </span>
        </span>
      </label>
      <label className="confirm">
        <input type="checkbox" checked={confirmed} onChange={(e) => onConfirmed(e.target.checked)} />
        <span>I checked these details against the printed carton.</span>
      </label>
    </div>
  );
}
