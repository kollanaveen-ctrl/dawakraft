import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

// The same three typefaces as the prototype. The CSS variables are also read by the circular renderer.
const display = Archivo({ variable: "--f-display", subsets: ["latin"], weight: ["500", "700", "800"] });
const body = Public_Sans({ variable: "--f-body", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ variable: "--f-mono", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = {
  title: "Dawakraft",
  description: "Photograph a medicine box and get a branded, compliance-checked product circular to share on WhatsApp.",
  applicationName: "Dawakraft",
  appleWebApp: { capable: true, title: "Dawakraft", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { apple: "/pwa-icon/180" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#142023" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
