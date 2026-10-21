"use client";
import { useState, type ReactNode } from "react";
import { aiSummary, mergeAiResult } from "@/lib/ai/box-read";
import { CATEGORIES, FORMS, HIGHLIGHT_MAX, MAX_AI_IMAGES, SCHEDULES, type FieldKey } from "@/lib/constants";
import { aiImage } from "@/lib/image/encode";
import { NEW_LAUNCH_DAYS } from "@/lib/segments";
import type { AiReadResult, DraftFields } from "@/lib/types";

type Low = Partial<Record<FieldKey, true>>;

type Props = {
  fields: DraftFields;
  low: Low;
  files: File[];
  confirmed: boolean;
  isNew: boolean;
  onFields: (f: DraftFields, low: Low) => void;
  onConfirmed: (v: boolean) => void;
  onIsNew: (v: boolean) => void;
};

const AI_ERRORS: Record<string, string> = {
  not_signed_in: "Your sign-in expired. Reload the page and sign in again.",
  not_configured: "AI reading isn't set up yet. Type the details from the carton.",
  rate_limited: "AI is busy right now. Wait a minute, then try again.",
  image_rejected: "One photo couldn't be used. Try a different photo.",
  invalid_json: "The AI reply couldn't be read. Try again.",
};
const AI_FALLBACK = "Couldn't read the box. Try again, or type the details.";

type FieldProps = { k: FieldKey; label: ReactNode; low: Low; full?: boolean; children: ReactNode };

function Field({ k, label, low, full, children }: FieldProps) {
  return (
    <label className={`field${full ? " full" : ""}${low[k] ? " low" : ""}`}>
      <span>
        {label}
        <span className="flag">Check this</span>
      </span>
      {children}
    </label>
  );
}

export function DetailsStep({ fields, low, files, confirmed, isNew, onFields, onConfirmed, onIsNew }: Props) {
  const [status, setStatus] = useState({ text: "", err: false });
  const [reading, setReading] = useState(false);

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

  async function readWithAi() {
    if (!files.length) return setStatus({ text: "Add photos of the box in step 1 first.", err: true });
    setReading(true);
    setStatus({ text: "Reading the box… this can take up to a minute.", err: false });
    try {
      const images = await Promise.all(files.slice(0, MAX_AI_IMAGES).map(aiImage));
      const res = await fetch("/api/read-box", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      const body = (await res.json().catch(() => null)) as { ok: boolean; data?: AiReadResult; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setStatus({ text: AI_ERRORS[body?.error ?? ""] ?? AI_FALLBACK, err: true });
        return;
      }
      const merged = mergeAiResult(fields, body.data);
      onFields(merged.fields, merged.low);
      setStatus({ text: aiSummary(merged), err: false });
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
      <p className={`status${status.err ? " err" : ""}`} aria-live="polite">{status.text}</p>
      <div className="form-grid">
        <Field k="name" label="Brand name" low={low}>{text("name")}</Field>
        <Field k="category" label="Category" low={low}>{select("category", CATEGORIES)}</Field>
        <Field k="composition" low={low} full label={<>Composition <span className="hint">Each active ingredient with its strength, as printed</span></>}>
          {text("composition")}
        </Field>
        <Field k="form" label="Dosage form" low={low}>{select("form", FORMS)}</Field>
        <Field k="packSize" label="Pack size" low={low}>{text("packSize", { placeholder: "10 × 10 tablets" })}</Field>
        <Field k="mrp" label="MRP per pack (₹)" low={low}>
          <input type="number" min={0} step="0.01" inputMode="decimal" value={fields.mrp} onChange={(e) => set("mrp", e.target.value)} />
        </Field>
        <Field k="schedule" label="Schedule" low={low}>{select("schedule", SCHEDULES)}</Field>
        <Field k="manufacturer" label="Manufactured by" low={low}>{text("manufacturer")}</Field>
        <Field k="marketedBy" label="Marketed by" low={low}>{text("marketedBy")}</Field>
        <Field k="storage" label="Storage" low={low}>{text("storage", { placeholder: "Store below 30°C" })}</Field>
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
