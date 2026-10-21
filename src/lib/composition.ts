// Safety checks on the composition line (pure; no React, no network).
// A wrong strength on a medicine circular is dangerous, so these look for the usual misreads:
// numbers with no unit, letters that look like digits, and a front-panel strength that the
// composition doesn't contain.
import type { Check } from "./types";

export type CompositionInput = { composition: string; strengthOnFront?: string | null };

// A unit right after a number: mg, mcg, µg/μg, g, IU (or I.U.), ml, and % (which covers % w/v and % w/w).
const UNIT_AFTER = /^\s*(?:mcg|mg|µg|μg|g|i\.?u\.?|ml|%)(?![a-z])/i;
// A number that stands on its own: not part of a word like "B12" or "Omega-3".
const NUMBER = /(?<![A-Za-z0-9.]|[A-Za-z]-)\d+(?:\.\d+)?(?![\d.])/g;
// A range or ratio such as "250-500 mg" or "5/10 mg": the first number shares the unit of the next one.
const SHARED_UNIT_AFTER = /^\s*[-–/]\s*\d/;
// Digits with the letter O/o or l mixed in, e.g. "5O0" or "1l0", optionally followed straight by a unit.
const MISREAD = /(?<![A-Za-z0-9])\d[\dOol]*[Ool][\dOol]*(?=$|[^A-Za-z]|(?:mcg|mg|ml|g|IU|iu)(?![A-Za-z]))/g;

/** Tokens like "5O0" where a letter has probably been read in place of a digit. */
export function misreadTokens(text: string): string[] {
  return [...text.matchAll(MISREAD)].map((m) => m[0]);
}

/** The composition with misread letters turned back into digits ("5O0" → "500"). */
function repaired(text: string): string {
  return text.replace(MISREAD, (t) => t.replace(/[Oo]/g, "0").replace(/l/g, "1"));
}

/** Numbers in the text that have no unit after them (misread tokens are left to their own check). */
export function unitlessNumbers(text: string): string[] {
  const cleaned = text.replace(MISREAD, (t) => " ".repeat(t.length));
  return [...cleaned.matchAll(NUMBER)]
    .filter((m) => {
      const rest = cleaned.slice((m.index ?? 0) + m[0].length);
      return !UNIT_AFTER.test(rest) && !SHARED_UNIT_AFTER.test(rest);
    })
    .map((m) => m[0]);
}

const numbersIn = (text: string): number[] => [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

/** Strengths printed in the composition with their units, e.g. ["500 mg"], for the mismatch message. */
function strengthsIn(text: string): string[] {
  return [...text.matchAll(/\d+(?:\.\d+)?\s*(?:mcg|mg|µg|μg|g|i\.?u\.?|ml|%(?:\s*w\/[vw])?)(?![a-z])/gi)].map((m) => m[0]);
}

function frontMismatch(composition: string, strengthOnFront: string): Check | null {
  const front = numbersIn(strengthOnFront);
  if (!front.length) return null;
  const fixed = repaired(composition);
  const inComposition = new Set(numbersIn(fixed));
  if (front.every((n) => inComposition.has(n))) return null;
  const printed = strengthsIn(fixed);
  // Combination packs often print the total on the front, e.g. "625" for 500 mg + 125 mg.
  const total = printed.reduce((sum, s) => sum + numbersIn(s)[0], 0);
  if (front.length === 1 && printed.length > 1 && Math.abs(front[0] - total) < 1e-9) return null;
  const says = printed.length ? `composition says ${printed.join(", ")}` : "composition has no strength";
  return { level: "bad", text: `Front says ${strengthOnFront.trim()}, ${says}. Check the carton.` };
}

/** Checks on the composition and the front-panel strength. Empty when there is nothing to flag. */
export function compositionChecks({ composition, strengthOnFront }: CompositionInput): Check[] {
  const text = composition.trim();
  if (!text) return []; // a missing composition is already flagged by the required-fields check
  const out: Check[] = [];

  for (const token of misreadTokens(text)) {
    out.push({ level: "bad", text: `Strength may be misread: check '${token}'` });
  }

  const unitless = unitlessNumbers(text);
  if (unitless.length) {
    out.push({
      level: "warn",
      text: `Composition has a number with no unit: ${unitless.join(", ")}. Add the unit as printed, e.g. mg.`,
    });
  }

  const mismatch = strengthOnFront ? frontMismatch(text, strengthOnFront) : null;
  if (mismatch) out.push(mismatch);
  return out;
}
