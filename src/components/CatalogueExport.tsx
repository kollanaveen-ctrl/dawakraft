"use client";
// The catalogue PDF: every product as a Catalogue card, four to a page, laid out like the
// company's printed catalogue, previewed here and downloaded or shared as one PDF.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { type CataloguePage, type GroupBy, financialYear, paginate } from "@/lib/catalog/pages";
import { PAGE_H, PAGE_W, type PageOptions, cataloguePdf, drawCataloguePage } from "@/lib/catalog/draw";
import { fontsReady } from "@/lib/circular/draw";
import { plural } from "@/lib/format";
import { isNewLaunch } from "@/lib/segments";
import { downloadBlob, shareImage } from "@/lib/share";
import { mediaImage, useData, useMediaImage } from "./DataProvider";

type Launch = "all" | "new" | "existing";
const PREVIEW_W = 300;
const SETTINGS_KEY = "dk_catalogue_settings";

type Settings = { title: string; division: string };

function loadSettings(): Partial<Settings> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<Settings>;
  } catch {
    return {};
  }
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // A convenience only: the form still works without storage.
  }
}

function PagePreview({ page, options }: { page: CataloguePage; options: PageOptions | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current && options) drawCataloguePage(ref.current, page, options);
  }, [page, options]);
  return (
    <canvas
      ref={ref}
      width={PREVIEW_W * 2}
      height={Math.round((PREVIEW_W * 2 * PAGE_H) / PAGE_W)}
      className="cat-page"
      aria-label={`Page ${page.number}: ${page.section}, ${page.products.map((p) => p.name).join(", ")}`}
    />
  );
}

export function CatalogueExport() {
  const { loaded, products, company } = useData();
  const logo = useMediaImage(company.logoPath);
  const [title, setTitle] = useState(() => `Product Catalogue ${financialYear(new Date())}`);
  const [division, setDivision] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("form");
  const [launch, setLaunch] = useState<Launch>("all");
  const [images, setImages] = useState<Map<string, HTMLImageElement | null> | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ text: "", err: false });

  useEffect(() => {
    const saved = loadSettings();
    // Restored after the first render so the server and browser render the same page.
    Promise.resolve().then(() => {
      if (saved.title) setTitle(saved.title);
      if (saved.division) setDivision(saved.division);
    });
    fontsReady().then(() => setFontsLoaded(true));
  }, []);

  useEffect(() => saveSettings({ title, division }), [title, division]);

  const chosen = useMemo(
    () => products.filter((p) => launch === "all" || isNewLaunch(p) === (launch === "new")),
    [products, launch],
  );
  const pages = useMemo(() => paginate(chosen, groupBy), [chosen, groupBy]);

  // Load every product picture once (cached), so pages draw complete.
  useEffect(() => {
    if (!loaded) return;
    let live = true;
    Promise.all(products.map(async (p) => [p.id, p.imagePath ? await mediaImage(p.imagePath) : null] as const)).then(
      (pairs) => live && setImages(new Map(pairs)),
    );
    return () => {
      live = false;
    };
  }, [loaded, products]);

  const options = useMemo<PageOptions | null>(
    () => (images && fontsLoaded ? { company, logo, title: title.trim() || "Product Catalogue", division, images } : null),
    [images, fontsLoaded, company, logo, title, division],
  );
  const fileName = `${(company.name || "Product").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}-catalogue.pdf`;

  async function makePdf(): Promise<Blob | null> {
    if (!options || !pages.length) return null;
    setBusy(true);
    setStatus({ text: `Making ${plural(pages.length, "page")}…`, err: false });
    await new Promise((r) => setTimeout(r, 30));
    try {
      return await cataloguePdf(pages, options);
    } catch (e) {
      console.error("Catalogue PDF failed", e);
      setStatus({ text: "The PDF couldn't be made. Try again, or with fewer products.", err: true });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    const pdf = await makePdf();
    if (!pdf) return;
    downloadBlob(pdf, fileName);
    setStatus({ text: `Downloaded ${fileName} (${plural(pages.length, "page")}).`, err: false });
  }

  async function share() {
    const pdf = await makePdf();
    if (!pdf) return;
    const text = `${title.trim()}${company.name ? " · " + company.name : ""}`;
    const res = await shareImage(pdf, fileName, text);
    if (res === "unsupported") {
      downloadBlob(pdf, fileName);
      setStatus({ text: "Sharing files isn't available here, so the PDF was downloaded instead.", err: false });
    } else setStatus({ text: res === "shared" ? "Shared." : "", err: false });
  }

  if (loaded && !products.length) {
    return (
      <section aria-labelledby="h-export" className="stack">
        <h1 id="h-export">Catalogue PDF</h1>
        <div className="card stack">
          <p>No products yet. Add a few, and they appear here as catalogue pages.</p>
          <div className="row">
            <Link className="btn primary" href="/new">
              New product
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const ready = Boolean(options);
  return (
    <section aria-labelledby="h-export" className="stack">
      <div>
        <p className="mono muted">{ready ? `${plural(chosen.length, "product")} · ${plural(pages.length, "page")}` : "Preparing…"}</p>
        <h1 id="h-export">Catalogue PDF</h1>
        <p className="muted">Four products to a page, in the style of your printed catalogue. Each section starts on a new page.</p>
      </div>
      <div className="card stack">
        <div className="cat-form">
          <label className="field">
            <span>Title</span>
            <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>
              Division <span className="hint">Optional, e.g. Ultima Division. Your company name is used if empty.</span>
            </span>
            <input value={division} maxLength={40} placeholder={company.name || "Division name"} onChange={(e) => setDivision(e.target.value)} />
          </label>
          <label className="field">
            <span>Pages grouped by</span>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
              <option value="form">Dosage form (Tablets, Capsules, Liquid…)</option>
              <option value="category">Therapy category</option>
            </select>
          </label>
          <label className="field">
            <span>Products</span>
            <select value={launch} onChange={(e) => setLaunch(e.target.value as Launch)}>
              <option value="all">All products</option>
              <option value="new">New launches only</option>
              <option value="existing">Existing only</option>
            </select>
          </label>
        </div>
        <div className="row">
          <button className="btn primary" type="button" disabled={!ready || busy || !pages.length} onClick={download}>
            Download PDF
          </button>
          <button className="btn" type="button" disabled={!ready || busy || !pages.length} onClick={share}>
            Share PDF
          </button>
        </div>
        <p className={`status${status.err ? " err" : ""}`} role="status">
          {status.text}
        </p>
      </div>
      {ready && !pages.length && <p className="muted">No products match. Choose All products.</p>}
      <div className="cat-pages">
        {pages.map((page) => (
          <PagePreview key={`${groupBy}-${page.number}-${page.section}`} page={page} options={options} />
        ))}
      </div>
    </section>
  );
}
