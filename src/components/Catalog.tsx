"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { CATEGORIES, SAMPLE } from "@/lib/constants";
import * as repo from "@/lib/data/repo";
import { catalogText, mrpText, plural } from "@/lib/format";
import { companyGroups, effectiveHighlight, isNewLaunch, matchesSegment, type LaunchFilter } from "@/lib/segments";
import { copyText } from "@/lib/share";
import type { Product } from "@/lib/types";
import { CircularCanvas } from "./CircularCanvas";
import { useData, useMediaImage } from "./DataProvider";
import { useToast } from "./Toast";
import { EMPTY_PROMO } from "@/lib/promo";

const CARD_CANVAS_W = 324;

const LAUNCH_CHIPS: [LaunchFilter, string][] = [
  ["all", "All"],
  ["new", "New launches"],
  ["existing", "Existing"],
];

function ProductCard({ product: p, logo }: { product: Product; logo: HTMLImageElement | null }) {
  const { company } = useData();
  const image = useMediaImage(p.imagePath);
  const isPromo = p.template === "promo";
  const photo = useMediaImage(isPromo ? p.promo.photoPath : null);
  const fields = useMemo(() => ({ ...p, highlight: effectiveHighlight(p) }), [p]);
  const priceLine = [p.packSize, p.mrp ? mrpText(p.mrp) : ""].filter(Boolean).join(" · ");
  const fresh = isNewLaunch(p);
  return (
    <Link className="pcard" href={`/product/${p.id}`}>
      {isPromo ? (
        // Landscape: centred in the same portrait slot so the grid rows stay even.
        <span className="pcard-wide">
          <CircularCanvas product={fields} company={company} template="promo" image={image} logo={logo} promo={p.promo} photo={photo} width={CARD_CANVAS_W} decorative />
        </span>
      ) : (
        <CircularCanvas product={fields} company={company} template={p.template} image={image} logo={logo} width={CARD_CANVAS_W} decorative />
      )}
      <span className="meta">
        {(p.example || fresh) && (
          <span className="tags">
            {p.example && <span className="tag">Example</span>}
            {fresh && <span className="tag new">New launch</span>}
          </span>
        )}
        <strong>{p.name || "Untitled"}</strong>
        <span>{p.composition}</span>
        <span>{priceLine}</span>
      </span>
    </Link>
  );
}

export function Catalog() {
  const { loaded, loadError, products, company, userId, putProduct, dropProducts } = useData();
  const toast = useToast();
  const router = useRouter();
  const logo = useMediaImage(company.logoPath);
  const [cat, setCat] = useState("All");
  const [companyFilter, setCompanyFilter] = useState("All");
  const [launch, setLaunch] = useState<LaunchFilter>("all");
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    products.forEach((p) => {
      const c = p.category || "Other";
      out[c] = (out[c] || 0) + 1;
    });
    return out;
  }, [products]);
  const companies = useMemo(() => companyGroups(products), [products]);
  const launchCounts = useMemo(() => {
    const fresh = products.filter((p) => isNewLaunch(p)).length;
    return { all: products.length, new: fresh, existing: products.length - fresh };
  }, [products]);
  const cats = ["All", ...CATEGORIES.filter((c) => counts[c])];
  const activeCat = cats.includes(cat) ? cat : "All";
  const activeCompany = companies.some((c) => c.key === companyFilter) ? companyFilter : "All";
  const list = useMemo(
    () => products.filter((p) => matchesSegment(p, { category: activeCat, company: activeCompany, launch, query: q })),
    [products, activeCat, activeCompany, launch, q],
  );
  const hasExamples = products.some((p) => p.example);
  const filtered = activeCat !== "All" || activeCompany !== "All" || launch !== "all" || Boolean(q);

  async function copyCatalog() {
    if (!list.length) return toast("No products to copy");
    toast((await copyText(catalogText(list, company))) ? "Copied" : "Select the text and copy it manually");
  }

  async function removeExamples() {
    const ex = products.filter((p) => p.example);
    setBusy(true);
    try {
      await repo.deleteProducts(ex);
      dropProducts(ex.map((p) => p.id));
      toast("Examples removed");
    } catch (e) {
      toast(repo.friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function addExample() {
    if (!userId) return;
    setBusy(true);
    const now = new Date().toISOString();
    try {
      const saved = await repo.saveProduct({
        ...SAMPLE,
        id: crypto.randomUUID(),
        promo: EMPTY_PROMO,
        template: "clean",
        imagePath: null,
        example: true,
        launchedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      putProduct(saved);
      router.push(`/product/${saved.id}`);
    } catch (e) {
      toast(repo.friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const emptyTitle = !loaded ? "Loading your catalog" : products.length ? "No products match" : "No products yet";
  const emptyText = products.length
    ? "Try another search or category."
    : "Your saved products appear here. Add the first one by photographing its box.";

  return (
    <section className="catalog-studio" aria-labelledby="h-catalog">
      {loadError && (
        <div className="notice warn">
          <span className="dot warn" />
          <p>{loadError}</p>
        </div>
      )}
      <div className="spread catalog-heading">
        <div>
          <p className="mono muted">Your workspace / Product library</p>
          <h1 id="h-catalog">Your range, together.</h1>
          <p className="catalog-lede">Find the right product. Keep your company identity consistent. Share with confidence.</p>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={copyCatalog} disabled={!loaded || !list.length}>
            Copy catalog list
          </button>
          <Link className="btn" href="/export">
            Catalogue PDF
          </Link>
          <Link className="btn primary" href="/new">
            New product
          </Link>
        </div>
      </div>

      {loaded && !company.name && (
        <div className="notice" style={{ marginTop: 16 }}>
          <span className="dot" />
          <p>
            Add your company name, logo and contacts so every circular carries your branding.{" "}
            <Link className="inline-link" href="/company">
              Set up company
            </Link>
          </p>
        </div>
      )}

      <div className="catalog-finder">
        <div className="finder-heading">
          <h2>Find a product</h2>
          <span className="muted">{loaded ? plural(products.length, "product") : "Loading your range"}</span>
        </div>
        <div className="toolbar">
        <label className="search" htmlFor="q">
          <span className="vis-hidden">Search products</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
          <input id="q" type="search" placeholder="Search by brand, composition or manufacturer" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      <div className="segments">
        <div className="seg-row">
          <span className="seg-label mono muted">Launch</span>
          <div className="chips" role="group" aria-label="Filter by new launch or existing">
            {LAUNCH_CHIPS.map(([k, label]) => (
              <button key={k} className="chip" type="button" aria-pressed={k === launch} onClick={() => setLaunch(k)}>
                {label}
                <b>{launchCounts[k]}</b>
              </button>
            ))}
          </div>
        </div>
        <div className="seg-row">
          <span className="seg-label mono muted">Category</span>
          <div className="chips" role="group" aria-label="Filter by category">
            {cats.map((c) => (
              <button key={c} className="chip" type="button" aria-pressed={c === activeCat} onClick={() => setCat(c)}>
                {c}
                <b>{c === "All" ? products.length : counts[c]}</b>
              </button>
            ))}
          </div>
        </div>
        {companies.length > 0 && (
          <div className="seg-row">
            <span className="seg-label mono muted">Company</span>
            <div className="chips" role="group" aria-label="Filter by company">
              <button className="chip" type="button" aria-pressed={activeCompany === "All"} onClick={() => setCompanyFilter("All")}>
                All
                <b>{products.length}</b>
              </button>
              {companies.map((c) => (
                <button key={c.key} className="chip" type="button" aria-pressed={c.key === activeCompany} onClick={() => setCompanyFilter(c.key)}>
                  {c.label}
                  <b>{c.count}</b>
                </button>
              ))}
            </div>
          </div>
        )}
        {filtered && (
          <p className="muted seg-summary" role="status">
            Showing {plural(list.length, "product")}.{" "}
            <button
              className="inline-link"
              type="button"
              onClick={() => {
                setCat("All");
                setCompanyFilter("All");
                setLaunch("all");
                setQuery("");
              }}
            >
              Clear filters
            </button>
          </p>
        )}
      </div>

      </div>
      <div className="catalog-results" aria-live="polite">
        <h2>{filtered ? "Matching products" : "All products"}</h2>
        <span className="muted">{loaded ? plural(list.length, "product") : "Loading…"}</span>
      </div>
      {hasExamples && (
        <div className="notice">
          <span className="dot" />
          <p>
            Products marked Example are samples to show how circulars look.{" "}
            <button className="inline-link danger" type="button" onClick={removeExamples} disabled={busy}>
              Remove examples
            </button>
          </p>
        </div>
      )}

      {!loaded ? (
        <div className="grid" aria-busy="true" aria-label="Loading your catalog">
          {[0, 1, 2, 3].map((k) => (
            <div key={k} className="skeleton" />
          ))}
        </div>
      ) : list.length > 0 ? (
        <div className="grid">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} logo={logo} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <svg className="empty-art" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M32 10 54 22 32 34 10 22Z" fill="currentColor" opacity=".25" />
            <path d="M10 22 32 34v22L10 44Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M54 22 32 34v22l22-12Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M32 10 54 22 32 34 10 22Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
          <h2>{emptyTitle}</h2>
          {loaded && <p className="muted">{emptyText}</p>}
          {loaded && !products.length && (
            <div className="row" style={{ justifyContent: "center" }}>
              <Link className="btn primary" href="/new">
                Photograph a box
              </Link>
              <button className="btn" type="button" onClick={addExample} disabled={busy || !userId}>
                See an example
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
