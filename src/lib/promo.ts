// The promotional circular's own content (headline, ingredient sections, indications, price
// ticket, lifestyle photo), kept on each product. Pure helpers, shared by the browser, the API
// routes and the tests. No zod here so it stays out of the browser bundle.
import { BANNED } from "./constants";

export const PROMO_LIMITS = {
  headline: 70,
  banner: 40,
  tagline: 60,
  sectionTitle: 40,
  bullet: 110,
  indication: 60,
  reference: 140,
  caseSize: 20,
  sections: 3,
  bullets: 3,
  indications: 7,
  references: 3,
} as const;

export type PromoSection = { title: string; bullets: string[] };

export type Promo = {
  /** The big line at the top right, e.g. "Women of today are ACTIVE in all spheres of". */
  headline: string;
  /** Words shown in the coloured band under the headline, e.g. "LIFE EVEN IN PREGNANCY". */
  banner: string;
  /** Closing line at the bottom right, e.g. "For a Specialised Approach". */
  tagline: string;
  /** Ingredient (or benefit) sections with short bullets, at most 3 × 3. */
  sections: PromoSection[];
  /** Indications, as approved, at most 7. */
  indications: string[];
  /** Shown on the price ticket next to MRP and pack size, e.g. "540". */
  caseSize: string;
  /** Study references for the footnote, at most 3. */
  references: string[];
  /** The lifestyle photo for the right half (uploaded or AI-made), in media storage. */
  photoPath: string | null;
  /** True when the photo was made by AI (so the app can say so). */
  photoIsAi: boolean;
  /** Colour theme key; empty means "match the pack". */
  theme: string;
  /** The person ticked "I checked these claims" for exactly this text. */
  claimsCheckedFor: string;
};

export const EMPTY_PROMO: Promo = {
  headline: "",
  banner: "",
  tagline: "",
  sections: [],
  indications: [],
  caseSize: "",
  references: [],
  photoPath: null,
  photoIsAi: false,
  theme: "",
  claimsCheckedFor: "",
};

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, max: number, each: number): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, each)).filter(Boolean).slice(0, max) : [];

/** A safe Promo from anything stored (old rows, demo storage, an AI reply): unknown keys dropped, limits applied. */
export function parsePromo(v: unknown): Promo {
  if (!v || typeof v !== "object") return EMPTY_PROMO;
  const o = v as Record<string, unknown>;
  const sections = Array.isArray(o.sections)
    ? o.sections
        .map((s): PromoSection => {
          const so = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
          return { title: str(so.title, PROMO_LIMITS.sectionTitle), bullets: list(so.bullets, PROMO_LIMITS.bullets, PROMO_LIMITS.bullet) };
        })
        .filter((s) => s.title || s.bullets.length)
        .slice(0, PROMO_LIMITS.sections)
    : [];
  return {
    headline: str(o.headline, PROMO_LIMITS.headline),
    banner: str(o.banner, PROMO_LIMITS.banner),
    tagline: str(o.tagline, PROMO_LIMITS.tagline),
    sections,
    indications: list(o.indications, PROMO_LIMITS.indications, PROMO_LIMITS.indication),
    caseSize: str(o.caseSize, PROMO_LIMITS.caseSize),
    references: list(o.references, PROMO_LIMITS.references, PROMO_LIMITS.reference),
    photoPath: typeof o.photoPath === "string" && o.photoPath ? o.photoPath : null,
    photoIsAi: o.photoIsAi === true,
    theme: str(o.theme, 20),
    claimsCheckedFor: typeof o.claimsCheckedFor === "string" ? o.claimsCheckedFor : "",
  };
}

/** Every word the circular prints from the promo content, for the claim checks. */
export function promoText(p: Promo): string {
  return [p.headline, p.banner, p.tagline, ...p.sections.flatMap((s) => [s.title, ...s.bullets]), ...p.indications].join(" \n ");
}

/** Strong claims: allowed only after the person confirms them (they need evidence and approval). */
export const STRONG_CLAIMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bprevent(s|ed|ing|ion)?\b/i, "prevents"],
  [/\bcomplete(ly)?\b/i, "complete"],
  [/\brapid(ly)?\b/i, "rapid"],
  [/\bfast(er|est)?\b/i, "fast"],
  [/\bquick(er|est|ly)?\b/i, "quick"],
  [/\bFDA\b/, "FDA"],
  [/\b(clinically )?proven\b/i, "proven"],
  [/\bsafe(ty|st|r)?\b/i, "safe"],
  [/\bsuperior\b/i, "superior"],
  [/\bmaximum\b/i, "maximum"],
  [/\bpotent\b/i, "potent"],
  [/\beffective(ly|ness)?\b/i, "effective"],
  [/\bsignificant(ly)?\b/i, "significant"],
  [/\bnew generation\b/i, "new generation"],
];

export type PromoClaims = { banned: string[]; strong: string[] };

/** Banned words (block sharing) and strong claims (need the person's confirmation) in the promo text. */
export function promoClaims(p: Promo): PromoClaims {
  const text = promoText(p);
  return {
    banned: BANNED.filter(([re]) => re.test(text)).map(([, label]) => label),
    strong: STRONG_CLAIMS.filter(([re]) => re.test(text)).map(([, label]) => label),
  };
}

/** True when the person has confirmed exactly the current strong claims (any edit asks again). */
export function claimsConfirmed(p: Promo): boolean {
  return promoClaims(p).strong.length === 0 || p.claimsCheckedFor === promoText(p);
}

/**
 * Split a brand into the wordmark and its suffix badge, like "Doloride" + "SP":
 * "Ventocal XT", "Ondilium-MD8", "Montiride-AB", "Acipox- 400". No suffix for "Acipox".
 */
export function splitBrand(name: string): { base: string; suffix: string } {
  const n = name.trim().replace(/\s+/g, " ");
  const m = /^(.*?[A-Za-z].*?)[\s-]+-?\s*([A-Z0-9][A-Z0-9.+]{0,5})$/.exec(n);
  if (!m || !/[A-Z0-9]/.test(m[2]) || m[2] !== m[2].toUpperCase()) return { base: n, suffix: "" };
  return { base: m[1].replace(/[\s-]+$/, ""), suffix: m[2] };
}
