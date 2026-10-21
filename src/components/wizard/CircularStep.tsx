"use client";
import type { TemplateKey } from "@/lib/constants";
import type { Company, ProductFields } from "@/lib/types";
import { CircularCanvas } from "../CircularCanvas";
import { TemplatePicker } from "../TemplatePicker";

type Props = {
  fields: ProductFields;
  company: Company;
  image: HTMLCanvasElement | HTMLImageElement | null;
  logo: HTMLImageElement | null;
  template: TemplateKey;
  saving: boolean;
  status: { text: string; err: boolean };
  onTemplate: (t: TemplateKey) => void;
  onSave: () => void;
};

export function CircularStep({ fields, company, image, logo, template, saving, status, onTemplate, onSave }: Props) {
  return (
    <div className="two">
      <div className="preview">
        <CircularCanvas product={fields} company={company} template={template} image={image} logo={logo} label="Circular preview" />
      </div>
      <div className="card stack">
        <h2>Pick a layout</h2>
        <TemplatePicker name="wtpl" value={template} onChange={onTemplate} />
        <p className="muted">Your brand colour and logo come from the Company page.</p>
        <div className="row">
          <button className="btn primary" type="button" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save to catalog"}
          </button>
        </div>
        <p className={`status${status.err ? " err" : ""}`} aria-live="polite">{status.text}</p>
      </div>
    </div>
  );
}
