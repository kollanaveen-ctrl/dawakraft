import { compositionChecks } from "./composition";
import { BANNED } from "./constants";
import type { Check, DraftFields } from "./types";

type CheckInput = {
  fields: Pick<
    DraftFields,
    "name" | "composition" | "uses" | "packSize" | "mrp" | "manufacturer" | "highlight" | "scheme" | "schedule"
  >;
  confirmed: boolean;
  companyName: string;
  /** The strength as printed on the front panel (optional); checked against the composition. */
  strengthOnFront?: string;
};

const REQUIRED: ReadonlyArray<readonly [keyof CheckInput["fields"], string]> = [
  ["name", "Brand name"],
  ["composition", "Composition"],
  ["packSize", "Pack size"],
  ["mrp", "MRP"],
  ["manufacturer", "Manufacturer"],
];

/** Claim words found in the free-text fields, by their display label. */
export function bannedWords(text: string): string[] {
  return BANNED.filter(([re]) => re.test(text)).map(([, label]) => label);
}

/** The compliance checklist shown in step 4. Rules and copy match the prototype. */
export function runChecks({ fields: f, confirmed, companyName, strengthOnFront }: CheckInput): Check[] {
  const out: Check[] = [];

  const missing = REQUIRED.filter(([k]) => {
    const v = f[k];
    if (k === "mrp") return !(Number(v) > 0);
    return v == null || String(v).trim() === "";
  }).map(([, label]) => label);
  out.push(
    missing.length
      ? { level: "warn", text: `Missing: ${missing.join(", ")}. Buyers expect these on a launch circular.` }
      : { level: "good", text: "Brand, composition, pack, MRP and manufacturer are filled in." },
  );

  out.push(
    confirmed
      ? { level: "good", text: "Details were checked against the printed carton." }
      : { level: "bad", text: "Go back to Details and confirm you checked them against the carton." },
  );

  const hits = bannedWords([f.name, f.highlight, f.scheme, f.composition, f.uses ?? ""].join(" "));
  out.push(
    hits.length
      ? {
          level: "bad",
          text: `Remove claim words: ${hits.join(", ")}. Circulars state facts only, never cures or guarantees.`,
        }
      : { level: "good", text: "No cure, guarantee or superlative claims found." },
  );

  // Strength safety: unit-less numbers, letters read as digits, front vs composition mismatch.
  out.push(...compositionChecks({ composition: f.composition, strengthOnFront }));

  if (["H", "H1", "X"].includes(f.schedule)) {
    out.push({
      level: "warn",
      text: `Schedule ${f.schedule} product: share only with doctors, chemists and the licensed trade. Don't post it publicly, such as on an open Instagram page.`,
    });
  }

  out.push({ level: "good", text: "Trade-only line is printed in the footer of every circular." });

  if (!companyName) {
    out.push({ level: "warn", text: "Your company name is missing. Add it on the Company page." });
  }
  return out;
}

export function hasBlockingIssue(checks: Check[]): boolean {
  return checks.some((c) => c.level === "bad");
}
