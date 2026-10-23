"use client";
/* eslint-disable @next/next/no-img-element -- local object URLs from camera files cannot use the image optimizer */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { aiSummary, evidenceLine, mergeAiResult, type Evidence } from "@/lib/ai/box-read";
import type { BoxReadResponse } from "@/lib/ai/types";
import { requestCopy, requestPhoto } from "@/lib/ai/promo-client";
import { CATEGORIES, FORMS, MAX_AI_IMAGES, SCHEDULES, type FieldKey } from "@/lib/constants";
import { EMPTY_DRAFT, draftToFields, productToDraft } from "@/lib/data/mappers";
import * as repo from "@/lib/data/repo";
import { NO_ROTATION, type PackKind } from "@/lib/faces";
import { buildPackImage } from "@/lib/image/packshot";
import { sourceHasEnoughPixels, UNSUPPORTED_PHOTO_MESSAGE } from "@/lib/image/photo-policy";
import { aiImage, fileToImage, photoBlob, productImageBlob } from "@/lib/image/encode";
import { circularBlob } from "@/lib/circular/render";
import { fontsReady } from "@/lib/circular/draw";
import { PROMO_THEMES } from "@/lib/circular/promo/theme";
import { EMPTY_PROMO, claimsConfirmed, parsePromo, promoClaims, promoText, type Promo } from "@/lib/promo";
import { downloadBlob, shareImage } from "@/lib/share";
import { flyerIssues, initialFlyer, STUDIO_AI_ERRORS, studioIssues } from "@/lib/studio";
import type { DraftFields, Product } from "@/lib/types";
import { missingProductData, photoRequirements, usableViews, VIEW_LABELS, type PhotoView } from "@/lib/photo-batch";
import { CircularCanvas } from "./CircularCanvas";
import { primeMediaImage, useData, useMediaImage } from "./DataProvider";
import "@/styles/studio.css";

type Picture = { file: File; image: HTMLImageElement; url: string };
const SELECTS: Partial<Record<FieldKey, readonly string[]>> = { form: FORMS, category: CATEGORIES, schedule: SCHEDULES };
const BASIC: [FieldKey, string, number][] = [["name", "Brand name", 200], ["composition", "Composition & strength", 500], ["packSize", "Pack size", 120], ["mrp", "MRP (₹)", 12], ["manufacturer", "Manufacturer", 200], ["form", "Dosage form", 60]];

export function FlyerStudio({ product: initialProduct }: { product?: Product }) {
  const { company, userId, loaded, loadError, putProduct, setCompany } = useData();
  const logo = useMediaImage(company.logoPath);
  const [step, setStep] = useState(initialProduct ? 2 : 0);
  const storedImage = useMediaImage(initialProduct?.imagePath);
  const storedScene = useMediaImage(initialProduct?.promo.photoPath);
  const [sceneRemoved, setSceneRemoved] = useState(false);
  const factsChanged = useRef(!initialProduct);
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [views, setViews] = useState<PhotoView[]>([]);
  const [mixedProducts, setMixedProducts] = useState(false);
  const [analysed, setAnalysed] = useState(false);
  const urls = useRef<string[]>([]);
  const [photoError, setPhotoError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const variant = useRef(0);
  useEffect(() => { if (photoError) dialog.current?.showModal(); }, [photoError]);
  const [cut, setCut] = useState<HTMLCanvasElement | null>(null);
  const [fields, setFields] = useState<DraftFields>(() => initialProduct ? productToDraft(initialProduct) : { ...EMPTY_DRAFT, highlight: "" });
  const [evidence, setEvidence] = useState<Partial<Record<FieldKey, Evidence>>>({});
  const [low, setLow] = useState<Partial<Record<FieldKey, true>>>({});
  const [strength, setStrength] = useState("");
  const [confirmed, setConfirmed] = useState(Boolean(initialProduct));
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [promo, setPromo] = useState<Promo>(initialProduct?.promo ?? { ...EMPTY_PROMO, layout: "editorial", format: "story" });
  const [scene, setScene] = useState<{ blob: Blob; image: HTMLImageElement; ai: boolean } | null>(null);
  const [busy, setBusy] = useState("");
  const lock = useRef(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const id = useRef<string | null>(initialProduct?.id ?? null);
  const persisted = useRef<{ image: string; photo: string | null } | null>(initialProduct?.imagePath ? { image: initialProduct.imagePath, photo: initialProduct.promo.photoPath } : null);
  const uploadCache = useRef<{ cut?: HTMLCanvasElement; image?: string; blob?: Blob; photo?: string }>({});
  const createdAt = useRef<string | null>(initialProduct?.createdAt ?? null);
  const [review, setReview] = useState(false);
  const [copyReady, setCopyReady] = useState(Boolean(initialProduct));

  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);
  const brand = useMemo(() => ({ ...company, name: companyName ?? company.name }), [company, companyName]);
  const productFields = useMemo(() => draftToFields(fields), [fields]);
  const artwork = cut ?? (pictures.length ? null : storedImage);
  const sceneImage = scene?.image ?? (sceneRemoved ? null : storedScene);
  const issues = studioIssues(fields, confirmed, brand.name, strength);
  const missing = missingProductData(fields);
  const photoIssues = pictures.length ? photoRequirements(views, mixedProducts, false) : initialProduct?.imagePath ? [] : ["Upload product photos to get started."];

  const prepareIssues = [...new Set([...photoIssues, ...missing.map(label => `Add the ${label}.`), ...issues])];
  const exportIssues = [...(!copyReady ? ["Generate the combination-specific copy before exporting."] : []), ...issues, ...flyerIssues(promo), ...(!artwork ? ["The product photo is not ready. Add a photo or wait for it to load."] : []), ...(!sceneImage ? ["Add or generate a lifestyle photo to finish this reference-style flyer."] : []), ...(!review ? ["Confirm the final preview before exporting."] : [])];
  const claims = promoClaims(promo);
  const input = { product: productFields, company: brand, template: "promo" as const, image: artwork, logo, promo, photo: sceneImage };

  function message(text: string, isError = false) { setStatus(text); setError(isError); }
  function change() { setSavedId(null); setReview(false); }
  function updateField(key: FieldKey, value: string) {
    factsChanged.current = true; setCopyReady(false);
    if (["composition", "uses", "category", "form"].includes(key)) { setScene(null); setSceneRemoved(true); }
    setFields(f => ({ ...f, [key]: value })); setConfirmed(false); change();
    setLow(l => ({ ...l, [key]: undefined }));
  }
  function updatePromo(patch: Partial<Promo>) { setPromo(p => ({ ...p, ...patch, claimsCheckedFor: "" })); change(); }
  async function job(label: string, action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(label); message(label);
    try { await action(); } catch (e) { if (e instanceof Error && e.message === UNSUPPORTED_PHOTO_MESSAGE) setPhotoError(true); message(e instanceof Error ? e.message : "Something went wrong. Your work is still here; please retry.", true); }
    finally { lock.current = false; setBusy(""); }
  }
  function resetAnalysis() {
    setViews([]); setAnalysed(false); setMixedProducts(false); setCut(null);
    setConfirmed(false); setCopyReady(false); setEvidence({}); setLow({}); setStrength(""); change();
  }
  async function pick(files: File[]) {
    if (!files.length) return;
    await job("Opening your photos…", async () => {
      if (pictures.length + files.length > MAX_AI_IMAGES) throw new Error(`Upload up to ${MAX_AI_IMAGES} photos of one product. Remove an existing photo before adding another.`);
      const added: Picture[] = [];
      // Validate the whole selection before adding it; an unreadable file never leaves a partial batch.
      for (const file of files) {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image. Choose JPG, PNG or WebP photos.`);
        if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is over 20 MB. Export HEIC photos as JPEG if they do not open.`);
        const image = await fileToImage(file).catch(() => { throw new Error(UNSUPPORTED_PHOTO_MESSAGE); });
        if (!sourceHasEnoughPixels(image.naturalWidth, image.naturalHeight)) throw new Error(UNSUPPORTED_PHOTO_MESSAGE);
        added.push({ file, image, url: "" });
      }
      for (const p of added) { p.url = URL.createObjectURL(p.file); urls.current.push(p.url); }
      setPictures(p => [...p, ...added]); resetAnalysis();
      message(`${pictures.length + added.length} photos ready. AI will identify the views and check the product details first.`);
    });
  }
  async function analysePhotos() {
    if (!pictures.length) return;
    await job("Checking all photos, identifying pack views and reading the details…", async () => {
      resetAnalysis();
      const images = await Promise.all(pictures.map(async p => ({ ...await aiImage(p.file), role: "other" as const })));
      const res = await fetch("/api/read-box", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }), signal: AbortSignal.timeout(90_000) });
      const body = await res.json() as BoxReadResponse;
      if (!res.ok || !body.ok) throw new Error(STUDIO_AI_ERRORS[!body.ok ? body.error : "failed"] || "The label could not be read. Retry from Photos or enter the details below.");
      setStep(1);
      if (body.meta.mock) { message("AI is in sample mode, so no sample medicine details were inserted. Enter your pack’s real details and identify the photo views below.", true); return; }
      // A new reading must not keep an old AI value for a field now missing from the photos.
      const merged = mergeAiResult({ ...EMPTY_DRAFT, highlight: "", uses: fields.uses, scheme: fields.scheme }, body.data);
      const detected = usableViews(body.data.photoViews, pictures.length);
      if (detected.length !== pictures.length || detected.some(v => !v.usable || v.confidence !== "high")) throw new Error(UNSUPPORTED_PHOTO_MESSAGE);
      setViews(detected); setMixedProducts(Boolean(body.data.mixedProducts)); setAnalysed(true);
      factsChanged.current = true;
      setFields(merged.fields); setEvidence(merged.evidence); setLow({ ...merged.low, composition: true }); setStrength(merged.strengthOnFront ?? "");
      const requests = [...photoRequirements(detected, Boolean(body.data.mixedProducts), false), ...missingProductData(merged.fields).map(label => `Please add ${label}.`)];
      message(requests.length ? "Before creating the product image, please complete the requests below. You can add another photo or type missing details." : `${aiSummary(merged)} The photos and required details are ready to review.`);
    });
  }
  function identifyPhoto(index: number, view: PhotoView["view"], kind: PhotoView["kind"]) {
    setViews(current => [...current.filter(v => v.index !== index), { index, view, kind, confidence: current.find(v => v.index === index)?.confidence ?? "low", usable: current.find(v => v.index === index)?.usable ?? false, rotation: current.find(v => v.index === index)?.rotation ?? "0" }]);
    setCut(null); setConfirmed(false); change();
  }
  async function createProductImage() {
    if (issues.length || missing.length || photoIssues.length || mixedProducts) { message([...photoIssues, ...issues][0] || "Complete the missing product details first.", true); return; }
    if (!pictures.length && artwork) { openDesign(); return; }
    const best = (view: PhotoView["view"]) => views.find(v => v.view === view && v.confidence === "high" && v.usable);
    const front = best("front");
    if (!front) return;
    const side = best("side"), top = best("top"), pack = best("pack");
    const assembleFaces = front.kind === "box" && side?.kind === "box" && top?.kind === "box";
    await job("Preparing your original packaging without redrawing it…", async () => {
      const result = await buildPackImage({
        strict: true, front: pictures[front.index].file, side: side ? pictures[side.index].file : null,
        top: top ? pictures[top.index].file : null, pack: pack ? pictures[pack.index].file : null,
        packKind: (pack && ["strip", "bottle", "tube"].includes(pack.kind) ? pack.kind : "strip") as PackKind,
        rots: { ...NO_ROTATION, front: Number(front.rotation), side: Number(side?.rotation ?? 0), top: Number(top?.rotation ?? 0), pack: Number(pack?.rotation ?? 0) },
        removeBg: true, tol: 46, threeD: assembleFaces, notABox: !assembleFaces, cropped: false,
      });
      if (!result.ok || result.unfound?.length || result.packOk === false) throw new Error(UNSUPPORTED_PHOTO_MESSAGE);
      setCut(result.canvas);
      message(assembleFaces ? "Product image ready from your photographed faces. Check its edges before continuing." : "Original photo prepared. Its photographed shape and artwork are preserved; no missing sides were invented.");
    });
  }
  async function openDesign() {
    if (issues.length || missing.length || photoIssues.length || !artwork) { message([...photoIssues, ...issues][0] || "Complete the required details and product image first.", true); return; }
    setStep(2); change();
    await job("Writing combination-specific copy and creating the supporting visual…", async () => {
      let next = promo;
      if (factsChanged.current) {
        const result = await requestCopy({ ...productFields, name: fields.name.slice(0, 120), inferUses: true, format: promo.format ?? "story" });
        if (!result.ok) throw new Error(STUDIO_AI_ERRORS[result.error] || "The copywriter could not finish. Retry from product details.");
        if (result.meta.mock) throw new Error("The copywriter is in sample mode. Connect AI before generating the flyer.");
        next = parsePromo({ ...initialFlyer(fields), ...result.copy, theme: promo.theme, layout: promo.layout, format: promo.format ?? "story", usesCheckedFor: "" });
        setPromo(next); factsChanged.current = false; setCopyReady(true);
      }
      if (!sceneImage || next !== promo) {
        const result = await requestPhoto(photoRequest(next));
        if (!result.ok) throw new Error(STUDIO_AI_ERRORS[result.error] || "The supporting image could not be generated. Retry Generate photo.");
        const blob = await photoBlob(await (await fetch(result.dataUrl)).blob());
        setScene({ blob, image: await fileToImage(blob), ai: true }); setSceneRemoved(false);
        setPromo(p => ({ ...p, photoIsAi: true }));
      }
      message("Story draft ready. Check the suggested uses against your leaflet and review the original packaging before sharing.");
    });
  }
  function photoRequest(copy: Promo) {
    return { name: fields.name.slice(0, 120), composition: fields.composition, uses: [fields.uses, ...(copy.suggestedUses ?? [])].join("; ").slice(0, 200), category: fields.category, form: fields.form, visualBrief: copy.visualBrief, format: copy.format, variant: (variant.current++ % 21) };
  }
  async function makeScene(file?: File) {
    await job(file ? "Adding your lifestyle photo…" : "Creating a lifestyle photo… this can take a minute", async () => {
      let blob: Blob;
      if (file) blob = await photoBlob(file);
      else {
        const result = await requestPhoto(photoRequest(promo));
        if (!result.ok) throw new Error(STUDIO_AI_ERRORS[result.error] || "The photo could not be generated. Retry or upload one.");
        blob = await photoBlob(await (await fetch(result.dataUrl)).blob());
      }
      const image = await fileToImage(blob);
      setScene({ blob, image, ai: !file }); setSceneRemoved(false); updatePromo({ photoIsAi: !file });
      message("Photo added. Check its crop in the preview before exporting.");
    });
  }
  async function writeCopy() {
    await job("Drafting copy from your confirmed product information…", async () => {
      const result = await requestCopy({ ...productFields, name: fields.name.slice(0, 120), inferUses: true, format: promo.format ?? "story" });
      if (!result.ok) throw new Error(STUDIO_AI_ERRORS[result.error] || "Copy could not be generated. You can edit the text below.");
      if (result.meta.mock) throw new Error("The copywriter is in sample mode. Sample claims were not applied; your factual layout is unchanged.");
      updatePromo(parsePromo({ ...promo, ...result.copy, usesCheckedFor: "" })); setCopyReady(true); factsChanged.current = false;
      message("Draft copy added. Check every claim against your approved product information.");
    });
  }
  async function save() {
    if (exportIssues.length || !artwork || !userId) { message(exportIssues[0] || "Sign in before saving.", true); return; }
    await job("Saving the flyer and both photos…", async () => {
      id.current ??= crypto.randomUUID();
      const productId = id.current;
      // Keep successfully uploaded files for retry if the final save fails. Never claim a photo-less save succeeded.
      if (cut && (uploadCache.current.cut !== cut || !uploadCache.current.image)) {
        const imageBlob = await productImageBlob(cut);
        const imagePath = await repo.uploadMedia(userId, `products/${productId}`, imageBlob);
        uploadCache.current = { ...uploadCache.current, cut, image: imagePath };
        primeMediaImage(imagePath, await fileToImage(imageBlob));
      }
      const imagePath = cut ? uploadCache.current.image! : initialProduct!.imagePath!;
      if (scene && (uploadCache.current.blob !== scene.blob || !uploadCache.current.photo)) {
        const path = await repo.uploadMedia(userId, `promo/${productId}`, scene.blob);
        uploadCache.current = { ...uploadCache.current, blob: scene.blob, photo: path };
      }
      const photoPath = scene ? uploadCache.current.photo! : sceneRemoved ? null : initialProduct?.promo.photoPath ?? null;
      if (photoPath && scene) primeMediaImage(photoPath, scene.image);
      await repo.saveCompany(userId, brand); setCompany(brand);
      const now = new Date().toISOString();
      createdAt.current ??= now;
      const tidy = parsePromo({ ...promo, photoPath });
      if (claimsConfirmed(promo)) tidy.claimsCheckedFor = promoClaims(tidy).strong.length ? promoText(tidy) : "";
      const saved = await repo.saveProduct({ ...productFields, id: productId, template: "promo", promo: tidy, imagePath, example: false, launchedAt: initialProduct?.launchedAt ?? null, createdAt: createdAt.current, updatedAt: now });
      putProduct(saved); setSavedId(saved.id);
      const old = persisted.current; persisted.current = { image: imagePath, photo: photoPath };
      if (old) void repo.removeMedia([old.image, old.photo].filter((p): p is string => Boolean(p) && p !== imagePath && p !== photoPath)).catch(() => undefined);
      message("Saved with your product photo and flyer design. You can reopen it from My catalog.");
    });
  }
  async function exportFlyer(kind: "png" | "pdf" | "share") {
    if (exportIssues.length || !artwork) { message(exportIssues[0] || "Prepare a product photo first.", true); return; }
    await job("Preparing your download…", async () => {
      await fontsReady();
      const blob = await circularBlob(input);
      if (!blob) throw new Error("The image could not be exported. Please retry.");
      const name = fields.name.replace(/[^\p{L}\p{N}_-]/gu, "-") || "product";
      if (kind === "pdf") {
        const { jsPDF } = await import("jspdf");
        const story = promo.format === "story";
        const w = story ? 108 : 260, h = story ? 192 : 199.55;
        const pdf = new jsPDF({ orientation: story ? "portrait" : "landscape", unit: "mm", format: [w, h] });
        pdf.addImage(new Uint8Array(await blob.arrayBuffer()), "PNG", 0, 0, w, h);
        downloadBlob(pdf.output("blob"), `${name}-flyer.pdf`);
      } else if (kind === "share") {
        const outcome = await shareImage(blob, `${name}-flyer.png`, fields.name);
        if (outcome === "cancelled") { message("Sharing cancelled. Your flyer is still here."); return; }
        if (outcome === "unsupported") { downloadBlob(blob, `${name}-flyer.png`); message("Image downloaded. Attach it in WhatsApp; this browser cannot share files directly."); return; }
      } else downloadBlob(blob, `${name}-flyer.png`);
      message(kind === "share" ? "Flyer shared." : "Download ready. Your editable design is still here; save it to keep it in your catalog.");
    });
  }
  function field(key: FieldKey, label: string, max: number) {
    return <label className={`field ${key === "composition" || key === "uses" ? "studio-span" : ""}`} key={key}>
      <span>{label}{low[key] && <small className="studio-check">Check this</small>}</span>
      {SELECTS[key] ? <select value={fields[key]} onChange={e => updateField(key, e.target.value)}><option value="">Choose…</option>{SELECTS[key]!.map(v => <option key={v}>{v}</option>)}</select> : key === "composition" || key === "uses" ? <textarea rows={3} maxLength={max} value={fields[key]} onChange={e => updateField(key, e.target.value)} /> : <input value={fields[key]} maxLength={max} inputMode={key === "mrp" ? "decimal" : undefined} onChange={e => updateField(key, e.target.value)} />}
      {evidence[key] && <small className="muted">{evidenceLine(evidence[key])}</small>}
    </label>;
  }

  function photoTray() {
    return <div className="studio-batch">
      <div className="studio-dropzone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) void pick([...e.dataTransfer.files]); }}>
        <span className="studio-drop-mark" aria-hidden="true">＋</span>
        <strong>Upload all product photos</strong>
        <p>Drag photos here, or choose them together.</p>
        <div className="row"><label className="btn primary">Choose photos<input className="vis-hidden" aria-label="Upload all product photos" type="file" accept="image/*" multiple onChange={e => { void pick([...(e.target.files ?? [])]); e.target.value = ""; }} /></label><label className="btn">Take photo<input className="vis-hidden" aria-label="Take a product photo" type="file" accept="image/*" capture="environment" onChange={e => { void pick([...(e.target.files ?? [])]); e.target.value = ""; }} /></label></div>
        <small>{pictures.length} / {MAX_AI_IMAGES} photos · one product per batch</small>
      </div>
      {pictures.length > 0 && <div className="studio-batch-grid">{pictures.map((p, index) => {
        const detected = views.find(v => v.index === index);
        return <div className="studio-batch-photo" key={p.url}>
          <img src={p.url} alt={`Product photo ${index + 1}`} />
          <div><strong>Photo {index + 1}</strong><span>{detected ? `${VIEW_LABELS[detected.view]}${detected.confidence === "low" || !detected.usable ? " · check photo" : ""}` : "Waiting for photo check"}</span><button type="button" onClick={() => { setPictures(current => current.filter((_, i) => i !== index)); resetAnalysis(); }}>Remove photo {index + 1}</button></div>
          {step === 1 && <details><summary>{detected ? "Correct view" : "Identify view manually"}</summary><label className="field"><span>Photo {index + 1} view</span><select value={detected?.view ?? "other"} onChange={e => identifyPhoto(index, e.target.value as PhotoView["view"], detected?.kind ?? "box")}>{Object.entries(VIEW_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field"><span>Photo {index + 1} pack type</span><select value={detected?.kind ?? "box"} onChange={e => identifyPhoto(index, detected?.view ?? "other", e.target.value as PhotoView["kind"])}>{["box", "strip", "bottle", "tube", "other"].map(kind => <option key={kind}>{kind}</option>)}</select></label><label className="field"><span>Photo {index + 1} rotation</span><select value={detected?.rotation ?? "0"} onChange={e => { const rotation = e.target.value as PhotoView["rotation"]; setViews(current => current.map(v => v.index === index ? { ...v, rotation } : v)); setCut(null); change(); }}>{["0", "90", "180", "270"].map(rotation => <option key={rotation} value={rotation}>{rotation}° clockwise</option>)}</select></label></details>}
        </div>;
      })}</div>}
    </div>;
  }

  return <section className="studio" aria-labelledby="studio-title">
    <dialog ref={dialog} onClose={() => setPhotoError(false)} aria-labelledby="photo-error-title"><h2 id="photo-error-title">Photo not supported</h2><p>{UNSUPPORTED_PHOTO_MESSAGE}</p><p>Upload sharp, well-lit photos with every pack edge visible. Include the actual carton faces; artwork will not be recreated.</p><button type="button" className="btn primary" autoFocus onClick={() => dialog.current?.close()}>Choose better photos</button></dialog>
    <header className="studio-heading"><div><p className="studio-eyebrow">DAWAKRAFT / FLYER STUDIO</p><h1 id="studio-title">Your product. Beautifully presented.</h1><p>Start with a pack photo. Leave with a flyer you’re proud to share.</p></div><Link href="/catalog" className="btn ghost">My catalog ↗</Link></header>
    <ol className="studio-steps">{["Add photos", "Check details", "Create your flyer"].map((label, i) => <li key={label} aria-current={step === i ? "step" : undefined}><span>{step > i ? "✓" : `0${i + 1}`}</span>{label}</li>)}</ol>
    {loadError && <p role="alert" className="studio-message error">{loadError}</p>}
    <div className="studio-workspace">
      <div className="studio-controls">
        <fieldset disabled={Boolean(busy)}>
        {step === 0 && <>
          <div className="studio-section-title"><span>01</span><div><h2>All your product photos. One upload.</h2><p>Start with one clear product photo. Add a readable label photo only if details are missing.</p></div></div>
          {photoTray()}
          <p className="studio-tip">One sharp photo is enough to prepare the product image. Keep the whole pack visible against a plain contrasting background. Add up to {MAX_AI_IMAGES} photos if a label is hard to read. Side and top photos are optional; we never invent missing artwork.</p>
          <button type="button" className="btn primary studio-main-action" disabled={!pictures.length} onClick={() => void analysePhotos()}>Check all photos with AI →</button>
          <button type="button" className="btn ghost studio-main-action" disabled={!pictures.length && !initialProduct} onClick={() => { setStep(1); message("Enter the printed details and identify the photo views below before creating the product image."); }}>Enter details manually</button>
        </>}
        {step === 1 && <>
          <div className="studio-section-title"><span>02</span><div><h2>Let’s fill the gaps first.</h2><p>We check the photos and required details before creating your product image.</p></div></div>
          {(missing.length > 0 || photoIssues.length > 0 || !brand.name.trim()) && <div className="studio-requests" role="status"><h3>Here’s what we still need</h3><ul>{photoIssues.map(issue => <li key={issue}>{issue}</li>)}{missing.map(label => <li key={label}>Please add the {label} below, or upload a clearer label photo.</li>)}{!brand.name.trim() && <li>Add your company name below.</li>}</ul></div>}
          {pictures.length > 0 && photoTray()}
          {pictures.length > 0 && <button type="button" className="btn studio-main-action" onClick={() => void analysePhotos()}>{analysed ? "Read photos again" : "Check photos with AI"}</button>}
          <div className="studio-fields">{BASIC.map(([key, label, max]) => field(key, label, max))}{field("uses", "Approved indications (optional)", 140)}<label className="field studio-span"><span>Your company name</span><input maxLength={120} value={brand.name} onChange={e => { setCompanyName(e.target.value); change(); }} /></label></div>
          <details className="studio-details"><summary>More product details</summary><div className="studio-fields">{field("schedule", "Schedule on the pack", 10)}{field("category", "Product category", 60)}{field("storage", "Storage instructions", 200)}{field("marketedBy", "Marketed by", 200)}</div></details>

          <label className="studio-checkbox"><input type="checkbox" checked={confirmed} onChange={e => { setConfirmed(e.target.checked); change(); }} />I checked the name, composition, strength, price and pack size against the carton.</label>
          {pictures.length > 0 && <div className={`studio-requests ${prepareIssues.length ? "" : "studio-ready"}`} role="status" aria-live="polite"><h3>{prepareIssues.length ? "Before the product image can be prepared" : "Ready to prepare"}</h3>{prepareIssues.length ? <ul>{prepareIssues.map(issue => <li key={issue}>{issue}</li>)}</ul> : <p>We will preserve your original product photo. Side and top views are optional.</p>}</div>}
          {pictures.length > 0 && <button type="button" className="btn primary studio-main-action" disabled={issues.length > 0 || missing.length > 0 || photoIssues.length > 0} onClick={() => void createProductImage()}>{cut ? "Rebuild product image" : "Prepare original product image"}</button>}
          {artwork && <button type="button" className="btn primary studio-main-action" disabled={issues.length > 0 || missing.length > 0 || photoIssues.length > 0} onClick={openDesign}>Use this image & create flyer →</button>}
          <button type="button" className="btn ghost studio-main-action" onClick={() => setStep(0)}>← Back to photos</button>
        </>}
        {step === 2 && <>
          <div className="studio-section-title"><span>03</span><div><h2>Make it yours.</h2><p>Choose a composition. The details stay exact.</p></div></div>
          <div className="row"><button type="button" className="btn" aria-pressed={promo.format === "story"} onClick={() => updatePromo({ format: "story" })}>WhatsApp Story · 9:16</button><button type="button" className="btn" aria-pressed={promo.format !== "story"} onClick={() => updatePromo({ format: "landscape" })}>Landscape</button></div>
          <div className="studio-layouts">{(["editorial", "portrait"] as const).map(layout => <button type="button" key={layout} aria-pressed={promo.layout === layout} onClick={() => updatePromo({ layout })}><span className={`studio-mini ${layout}`} aria-hidden="true"><i /><b /><em /></span><strong>{layout === "editorial" ? "Signature" : "Portrait"}</strong><small>{layout === "editorial" ? "Full scene · bold headline" : "Framed image · clean contrast"}</small></button>)}</div>
          <div className="studio-swatches" aria-label="Flyer colours"><button type="button" aria-pressed={!promo.theme} onClick={() => updatePromo({ theme: "" })}>Match pack</button>{PROMO_THEMES.map(t => <button type="button" key={t.key} title={t.label} aria-label={t.label} aria-pressed={promo.theme === t.key} style={{ background: t.title }} onClick={() => updatePromo({ theme: t.key })} />)}</div>
          <div className="studio-tool"><h3>Lifestyle photo</h3><p>Add the human touch, like your reference flyers.</p><div className="row"><button type="button" className="btn primary" onClick={() => void makeScene()}>Generate photo</button><label className="btn">Upload photo<input className="vis-hidden" type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) void makeScene(file); e.target.value = ""; }} /></label>{(sceneImage || initialProduct?.promo.photoPath) && <button type="button" className="btn ghost" onClick={() => { setScene(null); setSceneRemoved(true); updatePromo({ photoIsAi: false }); }}>Remove</button>}</div><small>AI generation uses your connected account’s credits.</small></div>
          <details className="studio-details" open><summary>Headline & wording</summary><label className="field"><span>Headline</span><input maxLength={70} value={promo.headline} onChange={e => updatePromo({ headline: e.target.value })} /></label><label className="field"><span>Highlight banner</span><input maxLength={40} value={promo.banner} onChange={e => updatePromo({ banner: e.target.value })} /></label><label className="field"><span>Closing line</span><input maxLength={60} value={promo.tagline} onChange={e => updatePromo({ tagline: e.target.value })} /></label><button type="button" className="btn" onClick={() => void writeCopy()}>Draft copy with AI</button><small>AI explains the combination. Verify suggested uses against the leaflet.</small></details>
          <details className="studio-details"><summary>Supporting points & price ticket</summary>{promo.sections.map((s, i) => <div className="studio-copy-section" key={i}><label className="field"><span>Section {i + 1} title</span><input maxLength={40} value={s.title} onChange={e => updatePromo({ sections: promo.sections.map((v, n) => n === i ? { ...v, title: e.target.value } : v) })} /></label><label className="field"><span>Points (one per line, up to 3)</span><textarea rows={3} value={s.bullets.join("\n")} onChange={e => updatePromo({ sections: promo.sections.map((v, n) => n === i ? { ...v, bullets: e.target.value.split("\n").slice(0, 3).map(l => l.slice(0, 110)) } : v) })} /></label><button type="button" className="btn ghost" onClick={() => updatePromo({ sections: promo.sections.filter((_, n) => n !== i) })}>Remove section</button></div>)}{promo.sections.length < 3 && <button type="button" className="btn" onClick={() => updatePromo({ sections: [...promo.sections, { title: "", bullets: [] }] })}>Add a section</button>}<label className="field"><span>Indications (one per line)</span><textarea rows={3} value={promo.indications.join("\n")} onChange={e => updatePromo({ indications: e.target.value.split("\n").slice(0, 7).map(l => l.slice(0, 60)) })} /></label><label className="field"><span>Case size (optional)</span><input maxLength={20} value={promo.caseSize} onChange={e => updatePromo({ caseSize: e.target.value })} /></label></details>
          {Boolean(promo.suggestedUses?.length) && <div className="studio-requests"><h3>AI-suggested combination uses</h3><label className="field"><span>Suggested uses — edit or remove unverified items</span><textarea rows={3} value={promo.suggestedUses!.join("\n")} onChange={e => updatePromo({ suggestedUses: e.target.value.split("\n").map(v => v.trim().slice(0, 90)).filter(Boolean).slice(0, 3), usesCheckedFor: "" })} /></label><label className="studio-checkbox"><input type="checkbox" checked={promo.usesCheckedFor === promo.suggestedUses!.join(" | ")} onChange={e => updatePromo({ usesCheckedFor: e.target.checked ? promo.suggestedUses!.join(" | ") : "" })} />I checked these suggested uses against the product leaflet.</label></div>}
          {claims.strong.length > 0 && <label className="studio-checkbox"><input type="checkbox" checked={promo.claimsCheckedFor === promoText(promo)} onChange={e => { setPromo(p => ({ ...p, claimsCheckedFor: e.target.checked ? promoText(p) : "" })); change(); }} />I verified these claims against approved information: {claims.strong.join(", ")}.</label>}
          {flyerIssues(promo).map(issue => <p className="studio-issues" key={issue}>{issue}</p>)}
          <label className="studio-checkbox"><input type="checkbox" checked={review} onChange={e => setReview(e.target.checked)} />I compared the pack artwork with my original photos and reviewed all printed flyer details.</label>
          <div className="studio-export"><button type="button" className="btn primary" disabled={exportIssues.length > 0} onClick={() => void exportFlyer("png")}>Download image ↓</button><button type="button" className="btn" disabled={exportIssues.length > 0} onClick={() => void exportFlyer("pdf")}>PDF ↓</button><button type="button" className="btn" disabled={exportIssues.length > 0} onClick={() => void exportFlyer("share")}>Share</button></div>
          <button type="button" className="btn studio-main-action" disabled={exportIssues.length > 0 || !loaded || !userId} onClick={() => void save()}>{savedId ? "Save changes to catalog" : "Save to my catalog"}</button>
          {savedId && <Link className="btn ghost studio-main-action" href={`/product/${savedId}`}>Open saved flyer ↗</Link>}
          <button type="button" className="btn ghost studio-main-action" onClick={() => { setStep(1); change(); }}>← Edit product details</button>
        </>}
        </fieldset>
        {status && <p className={`studio-message ${error ? "error" : ""}`} role={error ? "alert" : "status"}>{busy && <span className="studio-spinner" aria-hidden="true" />}{status}</p>}
      </div>
      <aside className="studio-preview-area" aria-label="Live preview">
        <div className="studio-preview-bar"><span>{step === 2 ? "YOUR FLYER / LIVE PREVIEW" : "YOUR PRODUCT / PREVIEW"}</span><span>{step === 2 ? promo.format === "story" ? "1080 × 1920 · 9:16" : "1600 × 1228" : "Original packaging"}</span></div>
        <div className={`studio-paper ${step === 2 && promo.format === "story" ? "studio-story" : ""} ${step !== 2 ? "studio-product-preview" : ""}`}>
          {step === 2 ? <CircularCanvas {...input} width={promo.format === "story" ? 1080 : 1600} label="Your promotional flyer" /> : artwork ? <ProductPreview canvas={artwork} /> : pictures.length > 0 ? <img src={pictures[views.find(v => v.view === "front")?.index ?? 0].url} alt="Your original product photograph" /> : <div className="studio-empty"><div className="studio-box" aria-hidden="true"><span>YOUR<br />BRAND</span><i /></div><h3>A better first impression<br />starts with your product.</h3><p>Add a photo to see your product here.<br />We keep the real pack artwork intact.</p></div>}
        </div>
        <div className="studio-preview-caption"><span>{step === 2 ? "Exact details. Original pack. Your brand." : "Your photos become the product image in the flyer."}</span><span>{step === 2 ? promo.format === "story" ? "WhatsApp Story" : "Landscape visual aid" : "No design experience needed"}</span></div>
        {step === 2 && !sceneImage && <p className="studio-photo-nudge">Add or generate the lifestyle photo to complete this flyer. Downloads unlock when the design is ready.</p>}
      </aside>
    </div>
  </section>;
}

function ProductPreview({ canvas }: { canvas: HTMLCanvasElement | HTMLImageElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const out = ref.current; if (out) { out.width = canvas instanceof HTMLImageElement ? canvas.naturalWidth : canvas.width; out.height = canvas instanceof HTMLImageElement ? canvas.naturalHeight : canvas.height; out.getContext("2d")?.drawImage(canvas, 0, 0); } }, [canvas]);
  return <canvas ref={ref} role="img" aria-label="Prepared product photo — check its edges" />;
}
