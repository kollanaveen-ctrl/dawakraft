"use client";
import { useState } from "react";
import { AI_CATEGORY_BATCH, CATEGORIES } from "@/lib/constants";
import { parseImport, type ImportRow } from "@/lib/csv";
import * as repo from "@/lib/data/repo";
import { mrpText, plural } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useData } from "./DataProvider";
import { useToast } from "./Toast";

const PREVIEW_ROWS = 12;
const SORT_FALLBACK = "Couldn't sort the categories. Try again.";
const SORT_ERRORS: Record<string, string> = {
  not_configured: "AI sorting isn't set up yet (add your Claude key). You can still import; missing categories become Other.",
  not_signed_in: "Your sign-in expired. Reload the page and sign in again.",
  rate_limited: "AI is busy right now. Wait a minute, then try again.",
};
const COLUMNS: [keyof ImportRow, string][] = [
  ["name", "Name"],
  ["composition", "Composition"],
  ["form", "Form"],
  ["packSize", "Pack"],
  ["mrp", "MRP"],
  ["manufacturer", "Manufacturer"],
  ["category", "Category"],
];

function toProduct(r: ImportRow, createdAt: string): Product {
  return {
    id: crypto.randomUUID(),
    name: r.name,
    composition: r.composition || "",
    form: r.form || "",
    packSize: r.packSize || "",
    mrp: r.mrp ?? null,
    schedule: "",
    manufacturer: r.manufacturer || "",
    marketedBy: "",
    storage: "",
    category: r.category || "Other",
    scheme: "",
    highlight: "",
    template: "clean",
    imagePath: null,
    example: false,
    launchedAt: null, // imported lists are existing products
    createdAt,
    updatedAt: createdAt,
  };
}

export function ImportView() {
  const { putProducts } = useData();
  const toast = useToast();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [status, setStatus] = useState({ text: "", err: false });
  const [busy, setBusy] = useState(false);
  const missingCats = rows.some((r) => !r.category);

  function preview(source = text) {
    const res = parseImport(source);
    if (!res.ok) {
      setRows([]);
      return setStatus({ text: res.error, err: true });
    }
    setRows(res.rows);
    setStatus({ text: `${plural(res.rows.length, "product")} ready to import.`, err: false });
  }

  async function fillCategories() {
    const need = rows
      .map((r, i) => ({ i, name: r.name, composition: r.composition || "" }))
      .filter((x) => !rows[x.i].category)
      .slice(0, AI_CATEGORY_BATCH);
    if (!need.length) return;
    setBusy(true);
    setStatus({ text: "Sorting products into categories…", err: false });
    try {
      const res = await fetch("/api/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: need }),
      });
      const body = (await res.json().catch(() => null)) as { ok: boolean; data?: { i: number; category: string }[]; error?: string } | null;
      if (!res.ok || !body?.ok || !body.data) {
        setStatus({ text: SORT_ERRORS[body?.error ?? ""] ?? SORT_FALLBACK, err: true });
        return;
      }
      const found = new Map(body.data.filter((x) => (CATEGORIES as readonly string[]).includes(x.category)).map((x) => [x.i, x.category]));
      setRows((cur) => cur.map((r, i) => (!r.category && found.has(i) ? { ...r, category: found.get(i) } : r)));
      const n = found.size;
      setStatus({ text: `Filled ${n} categor${n === 1 ? "y" : "ies"}. Check them in the preview.`, err: false });
    } catch {
      setStatus({ text: SORT_FALLBACK, err: true });
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    setBusy(true);
    const now = Date.now();
    const list = rows.map((r, i) => toProduct(r, new Date(now - i).toISOString()));
    let done = 0;
    try {
      await repo.insertProducts(list, (saved, n) => {
        done = n;
        putProducts(saved);
        setStatus({ text: `Imported ${n} of ${list.length}…`, err: false });
      });
      setStatus({ text: `Imported ${plural(done, "product")}.`, err: false });
      setRows([]);
      toast("Import finished");
    } catch (e) {
      // Keep only the rows that weren't saved, so trying again doesn't create duplicates.
      setRows((cur) => cur.slice(done));
      setStatus({ text: `Imported ${done}. ${repo.friendlyError(e)} The rows still shown were not imported.`, err: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="h-import">
      <p className="mono muted">Import</p>
      <h1 id="h-import">Bring in your existing product list</h1>
      <div className="card stack" style={{ marginTop: 16 }}>
        <p className="muted">
          Paste rows from Excel or upload a CSV file. The first row must name the columns:{" "}
          <span className="mono" style={{ textTransform: "none" }}>name, composition, form, pack, mrp, manufacturer, category</span>. Only name is required.
        </p>
        <div className="row">
          <label className="btn">
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="vis-hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const content = await f.text();
                setText(content);
                preview(content);
              }}
            />
          </label>
        </div>
        <label className="field">
          Or paste here
          <textarea placeholder="name,composition,form,pack,mrp,manufacturer,category" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="row">
          <button className="btn" type="button" onClick={() => preview()} disabled={busy}>
            Preview rows
          </button>
          {missingCats && (
            <button className="btn" type="button" onClick={fillCategories} disabled={busy}>
              Fill missing categories with AI
            </button>
          )}
          {rows.length > 0 && (
            <button className="btn primary" type="button" onClick={doImport} disabled={busy}>
              Import {plural(rows.length, "product")}
            </button>
          )}
        </div>
        <p className={`status${status.err ? " err" : ""}`} aria-live="polite">{status.text}</p>
        {rows.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {COLUMNS.map(([, label]) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                  <tr key={i}>
                    {COLUMNS.map(([k]) => (
                      <td key={k}>{k === "mrp" ? (r.mrp ? mrpText(r.mrp) : "") : String(r[k] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > PREVIEW_ROWS && <p className="muted" style={{ padding: "8px 10px" }}>and {rows.length - PREVIEW_ROWS} more</p>}
          </div>
        )}
      </div>
    </section>
  );
}
