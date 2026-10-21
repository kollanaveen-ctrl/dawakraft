"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { circularBlob } from "@/lib/circular/render";
import { effectiveHighlight, isNewLaunch } from "@/lib/segments";
import type { TemplateKey } from "@/lib/constants";
import * as repo from "@/lib/data/repo";
import { mrpText, shareText, slug } from "@/lib/format";
import { copyText, downloadBlob, isIOS, shareImage, whatsappLink } from "@/lib/share";
import type { Product } from "@/lib/types";
import { fontsReady } from "@/lib/circular/draw";
import { CircularCanvas } from "./CircularCanvas";
import { useData, useMediaImage } from "./DataProvider";
import { TemplatePicker } from "./TemplatePicker";
import { useToast } from "./Toast";

function specRows(p: Product): [string, string][] {
  const rows: [string, string][] = [
    ["Dosage form", p.form],
    ["Pack size", p.packSize],
    ["MRP", p.mrp ? mrpText(p.mrp) : ""],
    ["Schedule", p.schedule],
    ["Manufactured by", p.manufacturer],
    ["Marketed by", p.marketedBy],
    ["Storage", p.storage],
    ["Trade scheme", p.scheme],
    ["Segment", isNewLaunch(p) ? "New launch" : "Existing"],
  ];
  return rows.filter(([, v]) => v);
}

export function ProductView({ id }: { id: string }) {
  const { loaded, products, company, putProduct, dropProducts } = useData();
  const router = useRouter();
  const toast = useToast();
  const product = products.find((p) => p.id === id);
  const image = useMediaImage(product?.imagePath);
  const logo = useMediaImage(company.logoPath);
  const [template, setTemplate] = useState<TemplateKey | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [shownUrl, setShownUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const tpl = template ?? product?.template ?? "clean";
  // What the circular prints today: "New launch" drops off by itself once the product is no longer new.
  const shown = useMemo(() => (product ? { ...product, highlight: effectiveHighlight(product) } : null), [product]);

  // Keep a ready-made image so sharing starts instantly (share sheets need a fresh tap).
  useEffect(() => {
    if (!shown) return;
    let live = true;
    Promise.resolve().then(() => {
      if (live) setBlob(null); // never hand out the previous layout while the new one renders
    });
    fontsReady()
      .then(() => circularBlob({ product: shown, company, template: tpl, image, logo }))
      .then((b) => {
        if (live) setBlob(b);
      });
    return () => {
      live = false;
    };
  }, [shown, company, tpl, image, logo]);

  useEffect(() => () => {
    if (shownUrl) URL.revokeObjectURL(shownUrl);
  }, [shownUrl]);

  if (!loaded) return <p className="muted">Loading…</p>;
  if (!product || !shown) {
    return (
      <div className="empty">
        <h2>Product not found</h2>
        <Link className="btn" href="/">
          Back to catalog
        </Link>
      </div>
    );
  }

  const p = product;
  const message = shareText(shown, company);
  const filename = slug(p.name) + "-circular.png";

  async function changeTemplate(t: TemplateKey) {
    setTemplate(t);
    try {
      putProduct(await repo.updateTemplate(p, t));
    } catch (e) {
      setTemplate(null);
      toast(repo.friendlyError(e));
    }
  }

  function showImage(b: Blob) {
    setShownUrl(URL.createObjectURL(b));
  }

  function handleDownload() {
    if (!blob) return toast("Couldn't create the image");
    if (isIOS()) return showImage(blob);
    downloadBlob(blob, filename);
    toast("Image saved");
  }

  async function handleShare() {
    if (blob) {
      const outcome = await shareImage(blob, filename, message);
      if (outcome !== "unsupported") return;
    }
    window.open(whatsappLink(message), "_blank", "noopener");
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await repo.deleteProducts([p]);
      dropProducts([p.id]);
      toast("Deleted");
      router.replace("/");
    } catch (e) {
      toast(repo.friendlyError(e));
      setBusy(false);
    }
  }

  const specs = specRows(p);

  return (
    <section aria-labelledby="h-product">
      <Link className="btn ghost" href="/" style={{ paddingLeft: 0 }}>
        ← Catalog
      </Link>
      <div className="two" style={{ marginTop: 8 }}>
        <div className="preview">
          {shownUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, not an optimisable asset */}
              <img src={shownUrl} alt="Product circular image" className="shown-img" />
              <p className="muted" style={{ marginTop: 6 }}>Press and hold the image to save it.</p>
            </>
          ) : (
            <CircularCanvas product={shown} company={company} template={tpl} image={image} logo={logo} label="Product circular" />
          )}
        </div>
        <div className="stack">
          <div>
            <p className="mono muted">{(p.example ? "Example · " : "") + (p.category || "Other")}</p>
            <h1 id="h-product">{p.name || "Untitled"}</h1>
            <p className="muted">{p.composition}</p>
          </div>
          <TemplatePicker name="ptpl" value={tpl} onChange={changeTemplate} />
          <div className="row">
            <button className="btn primary" type="button" onClick={handleDownload} disabled={!blob}>
              {isIOSSafe() ? "Show image to save" : "Download image"}
            </button>
            <button className="btn" type="button" onClick={handleShare}>
              Share on WhatsApp
            </button>
            <button className="btn" type="button" onClick={async () => toast((await copyText(message)) ? "Copied" : "Select the text and copy it manually")}>
              Copy message
            </button>
          </div>
          <p className="muted" style={{ fontSize: ".84rem" }}>
            On a phone, Share sends the circular image with the message: pick WhatsApp, then a chat, group or status. On a computer, WhatsApp opens with the message filled in; attach the downloaded image.
          </p>
          <div className="card">
            <dl className="specs">
              {specs.length ? (
                specs.map(([k, v]) => (
                  <div key={k} style={{ display: "contents" }}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))
              ) : (
                <>
                  <dt>Details</dt>
                  <dd>None added yet</dd>
                </>
              )}
            </dl>
          </div>
          <div className="row">
            <Link className="btn" href={`/product/${p.id}/edit`}>
              Edit details
            </Link>
            <button className="btn danger" type="button" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          </div>
          {confirmDelete && (
            <div className="inline-confirm">
              <span>Delete this product from the catalog?</span>
              <button className="btn danger" type="button" onClick={handleDelete} disabled={busy}>
                Delete
              </button>
              <button className="btn" type="button" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** isIOS() needs the browser; during the first server render assume a normal download. */
function isIOSSafe(): boolean {
  return typeof navigator !== "undefined" && isIOS();
}
