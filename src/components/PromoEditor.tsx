"use client";
// The Promo circular editor: headline, banner, ingredient sections, indications, price ticket,
// colour theme and lifestyle photo, with a live preview and the claim checks. Saved on the product.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ComponentType } from "react";
import type { PromoCopy } from "@/lib/ai/types";
import { PROMO_THEMES } from "@/lib/circular/promo/theme";
import * as repo from "@/lib/data/repo";
import { fileToImage, photoBlob } from "@/lib/image/encode";
import { PROMO_LIMITS, type Promo, type PromoSection, claimsConfirmed, parsePromo, promoClaims, promoText } from "@/lib/promo";
import { effectiveHighlight } from "@/lib/segments";
import type { Product } from "@/lib/types";
import { CircularCanvas } from "./CircularCanvas";
import { primeMediaImage, useData, useMediaImage } from "./DataProvider";
import { useToast } from "./Toast";

type Props = {
  product: Product;
  /** AI helpers (copywriter, photo), shown above the fields when available. */
  aiTools?: ComponentType<{
    product: Product;
    /** Applies the AI's words onto the latest draft. */
    onCopy: (copy: PromoCopy) => void;
    onPhoto: (blob: Blob, isAi: boolean) => Promise<void>;
  }>;
};

const linesOf = (text: string, max: number, each: number) =>
  text
    .split("\n")
    .map((l) => l.trim().slice(0, each))
    .filter(Boolean)
    .slice(0, max);

export function PromoEditor({ product, aiTools: AiTools }: Props) {
  const { userId, company, putProduct } = useData();
  const router = useRouter();
  const toast = useToast();
  const image = useMediaImage(product.imagePath);
  const logo = useMediaImage(company.logoPath);
  const [draft, setDraft] = useState<Promo>(product.promo);
  const [indText, setIndText] = useState(product.promo.indications.join("\n"));
  const [refText, setRefText] = useState(product.promo.references.join("\n"));
  const [localPhoto, setLocalPhoto] = useState<HTMLImageElement | null>(null);
  const savedPhoto = useMediaImage(draft.photoPath);
  const photo = localPhoto ?? savedPhoto;
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ text: "", err: false });
  // Photos uploaded in this visit but not saved yet; the ones not kept are removed on the next upload or on save.
  const unsavedUploads = useRef<string[]>([]);
  const photoSeq = useRef(0);

  const shown = useMemo(() => ({ ...product, highlight: effectiveHighlight(product) }), [product]);
  const claims = promoClaims(draft);
  const confirmed = claimsConfirmed(draft);

  const set = (patch: Partial<Promo>) => setDraft((d) => ({ ...d, ...patch }));
  const setSections = (sections: PromoSection[]) => set({ sections });
  const setSection = (i: number, patch: Partial<PromoSection>) =>
    setSections(draft.sections.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  /**
   * The AI copywriter's words onto the latest draft (the person may have typed during the request).
   * Indications the person typed stay when the AI suggests none; the indications box follows the draft.
   */
  function applyCopy(copy: PromoCopy) {
    const indications = parsePromo({ indications: copy.indications }).indications;
    setDraft((d) => parsePromo({ ...d, ...copy, indications: indications.length ? indications : d.indications, claimsCheckedFor: "" }));
    if (indications.length) setIndText(indications.join("\n"));
  }

  async function setPhoto(blob: Blob, isAi: boolean) {
    if (!userId) return setStatus({ text: "Your sign-in expired. Reload the page and sign in again.", err: true });
    setStatus({ text: "Adding the photo…", err: false });
    const seq = ++photoSeq.current;
    try {
      const small = await photoBlob(blob);
      const path = await repo.uploadMedia(userId, `promo/${product.id}`, small);
      unsavedUploads.current = [...unsavedUploads.current, path];
      // Loaded from an object URL that is released at once; the image stays drawable.
      const img = await fileToImage(small);
      // A photo chosen after this one wins; this upload is then removed with the others.
      if (seq !== photoSeq.current) return;
      primeMediaImage(path, img);
      setLocalPhoto(img);
      set({ photoPath: path, photoIsAi: isAi });
      // Earlier unsaved uploads from this visit are replaced by this one: remove them.
      const replaced = unsavedUploads.current.filter((p) => p !== path);
      unsavedUploads.current = [path];
      void repo.removeMedia(replaced).catch(() => undefined);
      setStatus({ text: isAi ? "AI photo added. It's labelled “AI-generated image” on the circular." : "Photo added.", err: false });
    } catch (e) {
      setStatus({ text: repo.friendlyError(e), err: true });
    }
  }

  async function save() {
    if (claims.banned.length) {
      setStatus({ text: `Remove these words first: ${claims.banned.join(", ")}.`, err: true });
      return;
    }
    setSaving(true);
    // Tidy the text (empty points dropped, limits applied); a confirmation carries over to the tidy text.
    const tidy = parsePromo(draft);
    const promo = confirmed ? { ...tidy, claimsCheckedFor: promoClaims(tidy).strong.length ? promoText(tidy) : "" } : tidy;
    try {
      const saved = await repo.saveProduct({ ...product, template: "promo", promo, updatedAt: new Date().toISOString() });
      putProduct(saved);
      // The replaced or removed saved photo and any unsaved uploads not kept; never the photo just saved.
      const unused = [product.promo.photoPath, ...unsavedUploads.current].filter((p) => p && p !== promo.photoPath && p !== saved.promo.photoPath);
      unsavedUploads.current = [];
      void repo.removeMedia(unused).catch(() => undefined);
      toast("Promo circular saved");
      router.push(`/product/${product.id}`);
    } catch (e) {
      setStatus({ text: repo.friendlyError(e), err: true });
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="h-promo" className="stack">
      <Link className="btn ghost" href={`/product/${product.id}`} style={{ paddingLeft: 0, alignSelf: "flex-start" }}>
        ← {product.name || "Product"}
      </Link>
      <div>
        <p className="mono muted">Promo circular</p>
        <h1 id="h-promo">{product.name || "Promo circular"}</h1>
        <p className="muted">A landscape visual aid like your printed circulars. Changes show in the preview as you type.</p>
      </div>

      <div className="promo-preview">
        <CircularCanvas
          product={shown}
          company={company}
          template="promo"
          image={image}
          logo={logo}
          promo={draft}
          photo={photo}
          width={1600}
          label="Promo circular preview"
        />
      </div>

      {AiTools && <AiTools product={product} onCopy={applyCopy} onPhoto={setPhoto} />}

      <div className="card stack">
        <h2>Headline</h2>
        <div className="promo-grid">
          <label className="field">
            <span>
              Headline <span className="hint">Top right, e.g. “Women of today are active in all spheres of”</span>
            </span>
            <input value={draft.headline} maxLength={PROMO_LIMITS.headline} onChange={(e) => set({ headline: e.target.value })} />
          </label>
          <label className="field">
            <span>
              Banner words <span className="hint">In the coloured band, e.g. “Life even in pregnancy”</span>
            </span>
            <input value={draft.banner} maxLength={PROMO_LIMITS.banner} onChange={(e) => set({ banner: e.target.value })} />
          </label>
          <label className="field">
            <span>
              Closing line <span className="hint">Bottom right, e.g. “For a specialised approach”</span>
            </span>
            <input value={draft.tagline} maxLength={PROMO_LIMITS.tagline} onChange={(e) => set({ tagline: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="card stack">
        <h2>Ingredient sections</h2>
        <p className="muted">One coloured tag per ingredient, with up to {PROMO_LIMITS.bullets} short points each.</p>
        {draft.sections.map((sec, i) => (
          <div key={i} className="promo-section">
            <label className="field">
              <span>Tag {i + 1}</span>
              <input value={sec.title} maxLength={PROMO_LIMITS.sectionTitle} placeholder="e.g. Calcium Carbonate" onChange={(e) => setSection(i, { title: e.target.value })} />
            </label>
            {Array.from({ length: PROMO_LIMITS.bullets }, (_, k) => (
              <label key={k} className="field">
                <span className="vis-hidden">
                  Tag {i + 1}, point {k + 1}
                </span>
                <input
                  value={sec.bullets[k] ?? ""}
                  maxLength={PROMO_LIMITS.bullet}
                  placeholder={`Point ${k + 1}`}
                  onChange={(e) => {
                    const bullets = Array.from({ length: Math.max(sec.bullets.length, k + 1) }, (_, j) => sec.bullets[j] ?? "");
                    bullets[k] = e.target.value;
                    setSection(i, { bullets });
                  }}
                />
              </label>
            ))}
            <button className="btn ghost" type="button" onClick={() => setSections(draft.sections.filter((_, k) => k !== i))}>
              Remove tag {i + 1}
            </button>
          </div>
        ))}
        {draft.sections.length < PROMO_LIMITS.sections && (
          <div className="row">
            <button className="btn" type="button" onClick={() => setSections([...draft.sections, { title: "", bullets: [] }])}>
              Add a tag
            </button>
          </div>
        )}
      </div>

      <div className="card stack">
        <h2>Indications and price ticket</h2>
        <div className="promo-grid">
          <label className="field">
            <span>
              Indications <span className="hint">One per line, as approved. Empty uses the product&apos;s Uses.</span>
            </span>
            <textarea
              rows={5}
              value={indText}
              onChange={(e) => {
                setIndText(e.target.value);
                set({ indications: linesOf(e.target.value, PROMO_LIMITS.indications, PROMO_LIMITS.indication) });
              }}
            />
          </label>
          <label className="field">
            <span>
              Case size <span className="hint">Shown under MRP and pack size, e.g. 540</span>
            </span>
            <input value={draft.caseSize} maxLength={PROMO_LIMITS.caseSize} onChange={(e) => set({ caseSize: e.target.value })} />
          </label>
          <label className="field">
            <span>
              Study references <span className="hint">Optional, one per line, printed small</span>
            </span>
            <textarea
              rows={3}
              value={refText}
              onChange={(e) => {
                setRefText(e.target.value);
                set({ references: linesOf(e.target.value, PROMO_LIMITS.references, PROMO_LIMITS.reference) });
              }}
            />
          </label>
        </div>
      </div>

      <div className="card stack">
        <h2>Look</h2>
        <div className="promo-grid">
          <label className="field">
            <span>Colours</span>
            <select value={draft.theme} onChange={(e) => set({ theme: e.target.value })}>
              <option value="">Match the pack</option>
              {PROMO_THEMES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>
              Photo <span className="hint">A person or scene for the right half. Use photos you have the rights to.</span>
            </span>
            <div className="row">
              <label className="btn">
                Upload a photo
                <input
                  type="file"
                  accept="image/*"
                  className="vis-hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void setPhoto(f, false);
                  }}
                />
              </label>
              {draft.photoPath && (
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    setLocalPhoto(null);
                    set({ photoPath: null, photoIsAi: false });
                  }}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card stack">
        <h2>Claims check</h2>
        {claims.banned.length > 0 && (
          <div className="notice warn">
            <span className="dot warn" />
            <p>
              <b>Remove these words:</b> {claims.banned.join(", ")}. Circulars state facts only, never cures or guarantees.
            </p>
          </div>
        )}
        {claims.strong.length > 0 ? (
          <label className="confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => set({ claimsCheckedFor: e.target.checked ? promoText(draft) : "" })}
            />
            <span>
              I checked these claims against the approved prescribing information: <b>{claims.strong.join(", ")}</b>
              <br />
              <span className="muted">Strong claims need evidence. Any later change to the text asks again.</span>
            </span>
          </label>
        ) : (
          !claims.banned.length && <p className="muted">No banned words or strong claims found.</p>
        )}
      </div>

      <div className="row">
        <button className="btn primary" type="button" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save promo circular"}
        </button>
        <Link className="btn" href={`/product/${product.id}`}>
          Cancel
        </Link>
      </div>
      <p className={`status${status.err ? " err" : ""}`} role="status">
        {status.text}
      </p>
    </section>
  );
}
