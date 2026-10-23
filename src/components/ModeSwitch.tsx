import Link from "next/link";

/** Navigation between the public website and the working studio, not a cosmetic toggle. */
export function ModeSwitch({ mode }: { mode: "website" | "app" }) {
  return <nav className="mode-switch" aria-label="Experience mode">
    <Link href="/" aria-current={mode === "website" ? "page" : undefined}>Website</Link>
    <Link href="/catalog" aria-current={mode === "app" ? "page" : undefined}>Studio app <span aria-hidden="true">↗</span></Link>
  </nav>;
}
