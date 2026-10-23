import { runChecks } from "./compliance";
import { ingredientNames } from "./ai/promo-copy";
import { EMPTY_PROMO, claimsConfirmed, promoClaims, type Promo } from "./promo";
import type { DraftFields } from "./types";

/** Facts-only starting copy: never derive medical claims from an ingredient. */
export function initialFlyer(fields: DraftFields): Promo {
  const ingredients = ingredientNames(fields.composition);
  return { ...EMPTY_PROMO, layout: "editorial", format: "story", headline: fields.category && fields.category !== "Other" ? fields.category : "Composition & pack details", banner: fields.form ? `${fields.form} · ${fields.packSize}`.slice(0, 40) : "", sections: ingredients.length ? [{ title: "FORMULATION", bullets: ingredients }] : [] };
}

export function studioIssues(fields: DraftFields, confirmed: boolean, companyName: string, strengthOnFront = ""): string[] {
  const missing = (["name", "composition", "packSize", "manufacturer"] as const).filter(k => !fields[k].trim());
  const labels = { name: "brand name", composition: "composition", packSize: "pack size", manufacturer: "manufacturer" };
  const issues = missing.map(k => `Add the ${labels[k]}.`);
  if (!Number.isFinite(Number(fields.mrp)) || Number(fields.mrp) <= 0 || Number(fields.mrp) >= 100_000_000) issues.push("Enter a valid MRP in rupees.");
  if (!companyName.trim()) issues.push("Add your company name below.");
  return [...issues, ...runChecks({ fields, confirmed, companyName, strengthOnFront }).filter(c => c.level === "bad").map(c => c.text)];
}

export function flyerIssues(promo: Promo): string[] {
  const claims = promoClaims(promo);
  const bodyLength = [...promo.sections.flatMap(s => [s.title, ...s.bullets]), ...promo.indications, ...(promo.suggestedUses ?? [])].join(" ").length;
  return [
    ...(promo.format === "story" && bodyLength > 600 ? ["Shorten the supporting copy to 600 characters for readable WhatsApp Story text."] : []),
    ...(promo.suggestedUses?.length && promo.usesCheckedFor !== promo.suggestedUses.join(" | ") ? ["Check the AI-suggested combination uses against the product leaflet before sharing."] : []),
    ...(claims.banned.length ? [`Remove unsupported claim words: ${claims.banned.join(", ")}.`] : []),
    ...(!claimsConfirmed(promo) ? ["Check the highlighted claims against your approved product information."] : []),
  ];
}

export const STUDIO_AI_ERRORS: Record<string, string> = {
  not_signed_in: "Sign in to use AI, or enter the product details yourself.",
  not_configured: "AI is not connected. You can enter details and upload a lifestyle photo yourself.",
  out_of_credits: "The AI account needs credits. Your work is still here; use manual entry or upload a photo.",
  rate_limited: "AI has reached its request limit. Wait a moment and retry.",
  photo_unavailable: "Image generation is not connected. Upload a lifestyle photo instead.",
  network: "The connection was interrupted. Your work is still here; retry when connected.",
};
