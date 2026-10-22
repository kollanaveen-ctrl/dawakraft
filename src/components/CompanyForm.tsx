"use client";
import { useEffect, useMemo, useState } from "react";
import { isHexColour } from "@/lib/color";
import { BRAND_COLOURS, SAMPLE } from "@/lib/constants";
import * as repo from "@/lib/data/repo";
import { fileToImage, loadImage, logoBlob } from "@/lib/image/encode";
import type { Company } from "@/lib/types";
import { CircularCanvas } from "./CircularCanvas";
import { primeMediaImage, useData, useMediaImage } from "./DataProvider";
import { useToast } from "./Toast";

type TextKey = "name" | "tagline" | "phone" | "email" | "address" | "licence";

const FIELDS: { k: TextKey; label: string; hint?: string; full?: boolean; type?: string; auto?: string }[] = [
  { k: "name", label: "Company name", full: true, auto: "organization" },
  { k: "tagline", label: "Line under the name", hint: "e.g. Pharmaceutical distributor, Hyderabad", full: true },
  { k: "phone", label: "Phone / WhatsApp", type: "tel", auto: "tel" },
  { k: "email", label: "Email", type: "email", auto: "email" },
  { k: "address", label: "Address", full: true, auto: "street-address" },
  { k: "licence", label: "Drug licence numbers", hint: "Shown small in the footer", full: true },
];

/** Logo change waiting for Save: a new file, a removal, or nothing. */
type PendingLogo = { kind: "none" } | { kind: "new"; blob: Blob; img: HTMLImageElement; url: string } | { kind: "removed" };

export function CompanyForm() {
  const { loaded, company, userId, products, setCompany } = useData();
  const toast = useToast();
  const savedLogo = useMediaImage(company.logoPath);
  const [draft, setDraft] = useState<Company>(company);
  const [pending, setPending] = useState<PendingLogo>({ kind: "none" });
  const [status, setStatus] = useState({ text: "", err: false });
  const [saving, setSaving] = useState(false);
  const [syncedFrom, setSyncedFrom] = useState(company);

  // When the saved profile finishes loading, show it in the form.
  if (syncedFrom !== company) {
    setSyncedFrom(company);
    setDraft(company);
  }

  useEffect(() => () => {
    if (pending.kind === "new") URL.revokeObjectURL(pending.url);
  }, [pending]);

  const logo = pending.kind === "new" ? pending.img : pending.kind === "removed" ? null : savedLogo;
  const logoSrc = pending.kind === "new" ? pending.url : logo?.src;
  const sample = useMemo(() => products.find((p) => !p.example && p.name) ?? SAMPLE, [products]);
  const colour = isHexColour(draft.brandColor) ? draft.brandColor : BRAND_COLOURS[0];

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    try {
      const blob = await logoBlob(file);
      const url = URL.createObjectURL(blob);
      setPending({ kind: "new", blob, img: await fileToImage(blob), url });
    } catch {
      toast("That file couldn't be used as a logo");
    }
  }

  async function save() {
    if (!userId) return setStatus({ text: "Your sign-in expired. Reload the page and sign in again.", err: true });
    setSaving(true);
    setStatus({ text: "Saving…", err: false });
    let uploaded: string | null = null;
    // While photo storage isn't switched on, the details still save and the new logo waits.
    let logoSkipped = false;
    try {
      let logoPath = company.logoPath;
      if (pending.kind === "new") {
        try {
          uploaded = await repo.uploadMedia(userId, "logo", pending.blob);
          primeMediaImage(uploaded, await loadImage(URL.createObjectURL(pending.blob)));
          logoPath = uploaded;
        } catch (e) {
          if (!repo.storageOff(e)) throw e;
          logoSkipped = true;
        }
      } else if (pending.kind === "removed") logoPath = null;
      const saved = await repo.saveCompany(userId, { ...draft, brandColor: colour, logoPath });
      if (company.logoPath && company.logoPath !== logoPath) await repo.removeMedia([company.logoPath]);
      setCompany(saved);
      if (logoSkipped) {
        setStatus({ text: "Saved without the logo: photo storage isn't switched on yet. Your other details are saved.", err: false });
      } else {
        setPending({ kind: "none" });
        setStatus({ text: "Saved. New circulars use this branding.", err: false });
      }
    } catch (e) {
      if (uploaded) await repo.removeMedia([uploaded]);
      setStatus({ text: repo.friendlyError(e), err: true });
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="muted">Loading…</p>;

  return (
    <section aria-labelledby="h-company">
      <p className="mono muted">Company profile</p>
      <h1 id="h-company">Branding on every circular</h1>
      <div className="two" style={{ marginTop: 16 }}>
        <div className="card stack">
          <div className="row">
            <div className="logo-prev">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- in-memory logo preview
                <img src={logoSrc} alt="Company logo" />
              ) : (
                <span className="muted mono">Logo</span>
              )}
            </div>
            <label className="btn">
              Upload logo
              <input
                type="file"
                accept="image/*"
                className="vis-hidden"
                onChange={(e) => {
                  pickLogo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <button className="btn ghost" type="button" onClick={() => setPending({ kind: "removed" })}>
              Remove
            </button>
          </div>
          <div className="form-grid">
            {FIELDS.map((f) => (
              <label key={f.k} className={`field${f.full ? " full" : ""}`}>
                <span>
                  {f.label} {f.hint && <span className="hint">{f.hint}</span>}
                </span>
                <input
                  type={f.type ?? "text"}
                  autoComplete={f.auto}
                  value={draft[f.k]}
                  onChange={(e) => setDraft({ ...draft, [f.k]: e.target.value })}
                />
              </label>
            ))}
            <div className="field full">
              <span>Brand colour</span>
              <div className="swatches">
                {BRAND_COLOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="sw"
                    style={{ background: h }}
                    aria-label={`Brand colour ${h}`}
                    aria-pressed={h.toLowerCase() === colour.toLowerCase()}
                    onClick={() => setDraft({ ...draft, brandColor: h })}
                  />
                ))}
                <label className="btn ghost" style={{ minHeight: 0, padding: "4px 8px" }}>
                  Custom
                  <input type="color" value={colour} className="vis-hidden" onChange={(e) => setDraft({ ...draft, brandColor: e.target.value })} />
                </label>
              </div>
            </div>
          </div>
          <div className="row">
            <button className="btn primary" type="button" onClick={save} disabled={saving}>
              Save company
            </button>
            <span className={`status${status.err ? " err" : ""}`} aria-live="polite">{status.text}</span>
          </div>
        </div>
        <div className="preview">
          <CircularCanvas product={sample} company={{ ...draft, brandColor: colour }} template="clean" image={null} logo={logo} label="Preview of a circular with your branding" />
          <p className="muted" style={{ marginTop: 6, fontSize: ".84rem" }}>Preview with a sample product.</p>
        </div>
      </div>
    </section>
  );
}
