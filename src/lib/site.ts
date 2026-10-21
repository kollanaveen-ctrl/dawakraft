// Public site details used for SEO (canonical URLs, sitemap, social cards).

export const SITE_NAME = "Dawakraft";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://dawakraft.vercel.app").replace(/\/$/, "");

export const SITE_TITLE = "Dawakraft: medicine box photo to compliant product circular";

export const SITE_DESCRIPTION =
  "Photograph a medicine carton and get a branded, compliance-checked product circular for WhatsApp in minutes. Built for pharma distributors, PCD companies and medical agents in India.";

/** App screens are private tools: never indexed. */
export const PRIVATE_PATHS = ["/catalog", "/new", "/product", "/company", "/import", "/login", "/auth", "/api"];
