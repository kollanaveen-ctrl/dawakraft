import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AppBar, Brand } from "@/components/AppBar";
import { DataProvider } from "@/components/DataProvider";
import { DemoBanner } from "@/components/DemoBanner";
import { ToastProvider } from "@/components/Toast";

function BarPlaceholder() {
  return (
    <header className="bar">
      <div className="wrap">
        <Brand />
      </div>
    </header>
  );
}

// App screens are private tools: keep them out of search results.
export const metadata: Metadata = {
  title: "Your catalog",
  robots: { index: false, follow: false },
};

// Every signed-in screen shares the top bar and the loaded catalog.
// The Suspense placeholders let Next.js send the page frame instantly while the rest loads.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DataProvider>
        <Suspense fallback={<BarPlaceholder />}>
          <AppBar />
        </Suspense>
        <main id="main" className="wrap">
          <DemoBanner />
          <Suspense fallback={<p className="muted">Loading…</p>}>{children}</Suspense>
        </main>
      </DataProvider>
    </ToastProvider>
  );
}
