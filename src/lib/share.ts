"use client";
// Downloading, sharing and copying from the browser.

export function whatsappLink(text: string): string {
  return "https://wa.me/?text=" + encodeURIComponent(text);
}

export type ShareOutcome = "shared" | "cancelled" | "unsupported";

/**
 * On phones, open the share sheet with the circular image and message together,
 * so the user can pick WhatsApp. Returns "unsupported" where files can't be shared.
 */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  if (typeof navigator.canShare !== "function" || !navigator.canShare({ files: [file] })) return "unsupported";
  try {
    await navigator.share({ files: [file], text });
    return "shared";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

/** iPhones and iPads don't save downloads to Photos; we show the image to press and hold instead. */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Copy text; resolves false if the browser blocked it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
