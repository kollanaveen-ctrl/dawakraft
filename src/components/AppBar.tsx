"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { demoMode } from "@/lib/config";
import { signOut } from "@/lib/data/repo";
import { Logo } from "./Logo";

type NavItem = { href: string; label: string; icon: ReactNode; primary?: boolean };

const icon = (d: string) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const NAV: NavItem[] = [
  { href: "/catalog", label: "My catalog", icon: icon("M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z") },
  { href: "/new", label: "New", icon: icon("M12 5v14M5 12h14"), primary: true },
  { href: "/import", label: "Import", icon: icon("M12 4v11m0 0-4-4m4 4 4-4M5 20h14") },
  { href: "/company", label: "Company", icon: icon("M4 20V8l8-4 8 4v12M9 20v-6h6v6") },
];

/** Logo linking to the public home page. */
export function Brand() {
  return (
    <Link href="/" className="brand">
      <Logo />
    </Link>
  );
}

export function AppBar() {
  const path = usePathname();
  const router = useRouter();
  const isCurrent = (href: string) => path === href || path.startsWith(href + "/") || (href === "/catalog" && path.startsWith("/product"));

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <header className="bar app-bar">
        <div className="wrap">
          <Brand />
          <nav className="tabs tabs-desktop" aria-label="Sections">
            {NAV.map((t) => (
              <Link key={t.href} className={`tab${t.primary ? " primary" : ""}`} href={t.href} aria-current={isCurrent(t.href) ? "page" : undefined}>
                {t.primary ? "New product" : t.label}
              </Link>
            ))}
            {!demoMode && (
              <button className="tab" type="button" onClick={handleSignOut}>
                Sign out
              </button>
            )}
          </nav>
        </div>
      </header>
      <nav className="bottom-nav" aria-label="Sections">
        {NAV.map((t) => (
          <Link key={t.href} href={t.href} className={t.primary ? "new" : undefined} aria-current={isCurrent(t.href) ? "page" : undefined}>
            {t.icon}
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
