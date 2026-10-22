import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { RegisterSW } from "@/components/RegisterSW";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";
import "../styles/ai.css";
import "../styles/landing.css";

// Brand typefaces. The CSS variables are also read by the circular renderer.
const display = Bricolage_Grotesque({ variable: "--f-display", subsets: ["latin"], weight: ["500", "700", "800"] });
const body = Instrument_Sans({ variable: "--f-body", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = JetBrains_Mono({ variable: "--f-mono", subsets: ["latin"], weight: ["500"] });
// Stand-in for the printed catalogue's serif (Mencken Std); used only by the Catalogue card circular.
const serif = Source_Serif_4({
  variable: "--f-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  preload: false,
});
// Heavy italic wordmarks and condensed copy for the Promo circular, like Indian pharma visual aids.
const promo = Barlow({ variable: "--f-promo", subsets: ["latin"], weight: ["700", "800", "900"], style: ["normal", "italic"], preload: false });
const cond = Barlow_Condensed({ variable: "--f-cond", subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/icon.svg", apple: "/pwa-icon/180" },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", url: "/", title: SITE_TITLE, description: SITE_DESCRIPTION },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F4EE" },
    { media: "(prefers-color-scheme: dark)", color: "#0D1412" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable} ${mono.variable} ${serif.variable} ${promo.variable} ${cond.variable} antialiased`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
