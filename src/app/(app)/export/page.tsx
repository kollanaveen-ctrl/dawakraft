import type { Metadata } from "next";
import { CatalogueExport } from "@/components/CatalogueExport";

export const metadata: Metadata = { title: "Catalogue PDF" };

export default function ExportPage() {
  return <CatalogueExport />;
}
