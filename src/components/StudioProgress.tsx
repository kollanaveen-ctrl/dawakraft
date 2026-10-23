"use client";

import { useEffect, useState } from "react";

/** Indeterminate activity: never presents an invented completion percentage. */
export function StudioProgress({ label }: { label: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return <aside className="studio-progress" role="status" aria-live="polite" aria-atomic="true">
    <span className="studio-progress-orbit" aria-hidden="true">✦</span>
    <div className="studio-progress-copy"><span className="studio-progress-eyebrow">Working on your product</span><strong>{label}</strong><p>Your original packaging stays unchanged. Keep this page open.</p><div className="studio-progress-track" aria-hidden="true"><i /></div><small aria-hidden="true">{seconds}s elapsed · {seconds >= 60 ? "Still working — detailed images can take longer." : "AI image generation may take a minute or more."}</small></div>
  </aside>;
}
