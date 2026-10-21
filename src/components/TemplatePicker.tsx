"use client";
import { TEMPLATES, type TemplateKey } from "@/lib/constants";

type Props = {
  name: string;
  value: TemplateKey;
  onChange: (t: TemplateKey) => void;
};

export function TemplatePicker({ name, value, onChange }: Props) {
  return (
    <div className="tpls" role="radiogroup" aria-label="Layout">
      {TEMPLATES.map(([key, label]) => (
        <label key={key}>
          <input type="radio" name={name} value={key} checked={key === value} onChange={() => onChange(key)} />
          {label}
        </label>
      ))}
    </div>
  );
}
