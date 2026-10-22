"use client";
// The Promo editor's AI helpers: "Write copy with AI" (headline, banner, ingredient points,
// indications from the product's own composition and uses) and "Make a photo with AI"
// (a lifestyle scene for the right half). Sample results from the free mock are labelled.
import { useState } from "react";
import { type CopyResult, type PromoAiError, requestCopy, requestPhoto } from "@/lib/ai/promo-client";
import type { PromoCopy } from "@/lib/ai/types";
import { demoMode } from "@/lib/config";
import type { Product } from "@/lib/types";
import { DemoUnlock } from "./DemoUnlock";

type Props = {
  product: Product;
  /** Applies the AI's words onto the editor's latest draft (not a copy taken before the request). */
  onCopy: (copy: PromoCopy) => void;
  onPhoto: (blob: Blob, isAi: boolean) => Promise<void>;
};

const FALLBACK = "The AI couldn't help this time. Try again, or type the text yourself.";
const ERRORS: Partial<Record<PromoAiError | "demo_online", string>> = {
  not_configured: "AI isn't set up yet. Type the text yourself.",
  photo_unavailable: "AI photos need the Gemini AI. Upload a photo instead, or keep the colour background.",
  not_signed_in: "Your sign-in expired. Reload the page and sign in again.",
  demo_online: "AI on the online demo needs the demo passcode (until sign-in is added). Enter it below.",
  rate_limited: "AI is busy right now. Wait a minute, then try again.",
  out_of_credits: "The AI credits have run out. Type the text yourself, and ask the organisers for more credits.",
  refused: "The AI declined this one. Type the text yourself.",
  network: "No connection. Check the internet and try again.",
};

type Job = "copy" | "photo";

export function PromoAiTools({ product, onCopy, onPhoto }: Props) {
  const [busy, setBusy] = useState<Job | null>(null);
  const [status, setStatus] = useState({ text: "", err: false });
  const [unlockFor, setUnlockFor] = useState<Job | null>(null);
  const [unlockKey, setUnlockKey] = useState(0);

  function fail(error: PromoAiError, job: Job) {
    const code = demoMode && error === "not_signed_in" ? "demo_online" : error;
    if (code === "demo_online") {
      setUnlockFor(job);
      setUnlockKey((k) => k + 1);
    }
    setStatus({ text: ERRORS[code] ?? FALLBACK, err: true });
  }

  async function writeCopy() {
    setBusy("copy");
    setStatus({ text: "Writing the copy… this takes about 10 seconds.", err: false });
    const res: CopyResult = await requestCopy({
      name: product.name || "Product",
      composition: product.composition,
      form: product.form,
      uses: product.uses,
      category: product.category,
      schedule: product.schedule,
    });
    setBusy(null);
    if (!res.ok) return fail(res.error, "copy");
    setUnlockFor(null);
    // The AI writes the words; the photo, colours, case size and references stay as they were.
    onCopy(res.copy);
    const found = [...res.claims.banned, ...res.claims.strong];
    const note = found.length ? ` Check these words: ${found.join(", ")}.` : "";
    setStatus({
      text: res.meta.mock
        ? "Sample copy (demo): these are placeholder words, not written for your product. Edit them below."
        : `Copy written from the composition and uses. Read every line and edit it before sharing.${note}`,
      err: false,
    });
  }

  async function makePhoto() {
    setBusy("photo");
    setStatus({ text: "Making the photo… this can take up to a minute.", err: false });
    const res = await requestPhoto({ name: product.name, uses: product.uses, category: product.category, form: product.form });
    if (!res.ok) {
      setBusy(null);
      return fail(res.error, "photo");
    }
    setUnlockFor(null);
    try {
      const blob = await (await fetch(res.dataUrl)).blob();
      await onPhoto(blob, true);
      // The editor reports the result under its own Save button.
      setStatus({ text: "", err: false });
    } catch {
      setStatus({ text: "The photo was made but couldn't be added. Try again, or upload a photo instead.", err: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card stack">
      <div>
        <h2>AI helpers</h2>
        <p className="muted">
          The copywriter uses only this product&apos;s composition and uses, and avoids claim words. The photo is a made-up scene (never your pack), labelled
          on the circular as AI-generated. Each photo costs about ₹7 in AI credits.
        </p>
      </div>
      <div className="row">
        <button className="btn primary" type="button" disabled={busy !== null} onClick={writeCopy}>
          {busy === "copy" ? "Writing…" : "Write copy with AI"}
        </button>
        <button className="btn" type="button" disabled={busy !== null} onClick={makePhoto}>
          {busy === "photo" ? "Making the photo…" : "Make a photo with AI"}
        </button>
      </div>
      <p className={`status${status.err ? " err" : ""}`} role="status">
        {status.text}
      </p>
      {unlockFor && <DemoUnlock key={unlockKey} onUnlocked={unlockFor === "copy" ? writeCopy : makePhoto} />}
    </div>
  );
}
