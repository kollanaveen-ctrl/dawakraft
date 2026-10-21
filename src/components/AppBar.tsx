"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { demoMode } from "@/lib/config";
import { signOut } from "@/lib/data/repo";

const TABS = [
  { href: "/", label: "Catalog" },
  { href: "/import", label: "Import" },
  { href: "/company", label: "Company" },
] as const;

export function Brand() {
  return (
    <div className="brand">
      <div className="mark" aria-hidden="true">
        <span />
      </div>
      <div className="wordmark">
        Dawakraft<small>Box to circular</small>
      </div>
    </div>
  );
}

export function AppBar() {
  const path = usePathname();
  const router = useRouter();
  const isCurrent = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="bar">
      <div className="wrap">
        <Brand />
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <Link key={t.href} className="tab" href={t.href} aria-current={isCurrent(t.href) ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
          <Link className="tab primary" href="/new" aria-current={isCurrent("/new") ? "page" : undefined}>
            New product
          </Link>
          {!demoMode && (
            <button className="tab" type="button" onClick={handleSignOut}>
              Sign out
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
