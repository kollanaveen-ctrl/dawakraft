"use client";
import type { TemplateKey } from "@/lib/constants";
import type { Promo } from "@/lib/promo";
import type { Company, ProductFields } from "@/lib/types";
import { CircularCanvas } from "../CircularCanvas";
import { TemplatePicker } from "../TemplatePicker";

/** The Promo circular needs its own editor, so the wizard doesn't offer it. */
const WIZARD_EXCLUDED: readonly TemplateKey[] = ["promo"];

type Props = {
  fields: ProductFields;
  company: Company;
  image: HTMLCanvasElement | HTMLImageElement | null;
  logo: HTMLImageElement | null;
  template: TemplateKey;
  /** The saved promo content and photo, for a product already on the Promo circular. */
  promo?: Promo;
  photo?: HTMLImageElement | null;
  saving: boolean;
  status: { text: string; err: boolean };
  onTemplate: (t: TemplateKey) => void;
  onSave: () => void;
};

export function CircularStep({ fields, company, image, logo, template, promo, photo, saving, status, onTemplate, onSave }: Props) {
  return (
    <div className="two">
      <div className={`preview${template === "promo" ? " wide" : ""}`}>
        <CircularCanvas product={fields} company={company} template={template} image={image} logo={logo} promo={promo} photo={photo} label="Circular preview" />
      </div>
      <div className="card stack">
        <h2>Pick a layout</h2>
        <TemplatePicker name="wtpl" value={template} onChange={onTemplate} exclude={WIZARD_EXCLUDED} />
        {template === "promo" && <p className="muted">This product uses the Promo circular. Edit its words and photo from the product page.</p>}
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
