"use client";
import { TEMPLATES, type TemplateKey } from "@/lib/constants";

type Props = {
  name: string;
  value: TemplateKey;
  onChange: (t: TemplateKey) => void;
  /** Layouts not offered here (e.g. the Promo circular, which has its own editor). */
  exclude?: readonly TemplateKey[];
};

export function TemplatePicker({ name, value, onChange, exclude = [] }: Props) {
  return (
    <div className="tpls" role="radiogroup" aria-label="Layout">
      {TEMPLATES.filter(([key]) => !exclude.includes(key)).map(([key, label]) => (
        <label key={key}>
          <input type="radio" name={name} value={key} checked={key === value} onChange={() => onChange(key)} />
          {label}
        </label>
      ))}
    </div>
  );
}
